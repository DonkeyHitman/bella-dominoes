import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { BoardState, DominoTile, PayoutResult, TurnSnapshot } from "../types/game";
import { dealValidFourPlayerHands, determineStartingPlayer, getPlayableMovesForHand } from "../engine/deck";
import { createInitialBoardState, placeTileOnBoard } from "../engine/boardLayoutEngine";
import { analyzeCounterfactualBlock } from "../engine/counterfactualAnalyzer";
import { calculateBlockedGamePayout, calculateNormalFinishPayout } from "../engine/payoutCalculator";

const prisma = new PrismaClient();

const BOT_EAST_TIEN = { id: "bot-3", name: "Bot Tiến", avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Tien" };
const BOT_NORTH_VUONG = { id: "bot-2", name: "Bot Vượng", avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Vuong" };
const BOT_WEST_TUAN = { id: "bot-1", name: "Bot Tuấn", avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Tuan" };

interface RoomSession {
  roomId: string;
  ownerId: string | null; // Tracks who created the table
  seats: string[];
  roundNumber: number;
  previousWinnerId: string | null;
  hands: Record<string, DominoTile[]>;
  board: BoardState;
  activeTurnPlayerId: string | null;
  mustPlaySixSix: boolean;
  consecutivePasses: number;
  lastPlacerId: string | null;
  precedingSnapshot: TurnSnapshot | null;
  latestSnapshot: TurnSnapshot | null;
}

export class RoomManager {
  private io: Server;
  private rooms = new Map<string, RoomSession>();

  constructor(io: Server) { this.io = io; }

  public registerSocket(socket: Socket): void {
    socket.on("room:join", async ({ roomId, playerId }) => {
      socket.data.playerId = playerId;
      socket.join(roomId);

      const isMainClub = roomId === "main-club";
      let room = this.rooms.get(roomId);

      if (isMainClub) {
        for (const bot of [BOT_EAST_TIEN, BOT_NORTH_VUONG, BOT_WEST_TUAN]) {
          await prisma.player.upsert({
            where: { id: bot.id },
            update: { avatarUrl: bot.avatarUrl },
            create: { id: bot.id, name: bot.name, avatarUrl: bot.avatarUrl, credits: 0, gamesPlayed: 0, gamesWon: 0 },
          }).catch(() => {});
        }

        const expectedSeats = [playerId, BOT_EAST_TIEN.id, BOT_NORTH_VUONG.id, BOT_WEST_TUAN.id];
        const needsReset = !room || room.seats.length !== 4 || room.seats.some((s, i) => s !== expectedSeats[i]);

        if (!room || needsReset) {
          room = this.createEmptyRoomState(roomId, expectedSeats, null);
          this.rooms.set(roomId, room);
          this.startNewRound(room);
        } else {
          this.broadcastRoomState(room);
        }
      } else {
        if (!room) {
          // Creator becomes the owner
          room = this.createEmptyRoomState(roomId, [playerId], playerId);
          this.rooms.set(roomId, room);
          this.broadcastRoomState(room);
        } else {
          if (!room.seats.includes(playerId) && room.seats.length < 4) {
            room.seats.push(playerId);
            if (room.seats.length === 4) {
              this.startNewRound(room);
              return; 
            }
          }
          this.broadcastRoomState(room);
        }
      }
    });

    // Room Destruction Event (Only owner can destroy)
    socket.on("room:destroy", ({ roomId, playerId }) => {
      const room = this.rooms.get(roomId);
      if (room && room.ownerId === playerId) {
        this.io.to(roomId).emit("room:destroyed", { message: "The table owner has permanently closed this room." });
        this.rooms.delete(roomId);
        this.io.in(roomId).socketsLeave(roomId);
      }
    });

    socket.on("game:playTile", async ({ roomId, playerId, tileId, targetEnd }) => {
      const room = this.rooms.get(roomId);
      if (!room || room.activeTurnPlayerId !== playerId || socket.data.playerId !== playerId) return;
      await this.executeMove(room, playerId, tileId, targetEnd);
    });

    socket.on("game:passTurn", async ({ roomId, playerId }) => {
      const room = this.rooms.get(roomId);
      if (!room || room.activeTurnPlayerId !== playerId || socket.data.playerId !== playerId) return;
      await this.executePass(room, playerId);
    });

    socket.on("room:nextRound", ({ roomId }) => {
      const room = this.rooms.get(roomId);
      if (room && room.activeTurnPlayerId === null && room.seats.length === 4) {
        this.startNewRound(room);
      }
    });

    socket.on("chat:emoji", ({ roomId, playerId, emoji }) => {
      this.io.to(roomId).emit("chat:emoji", { playerId, emoji });
    });

    socket.on("chat:message", ({ roomId, sender, text }) => {
      this.io.to(roomId).emit("chat:message", { sender, text });
    });
  }

  private createEmptyRoomState(roomId: string, seats: string[], ownerId: string | null): RoomSession {
    return {
      roomId,
      ownerId,
      seats,
      roundNumber: 0,
      previousWinnerId: null,
      hands: {},
      board: createInitialBoardState(),
      activeTurnPlayerId: null,
      mustPlaySixSix: false,
      consecutivePasses: 0,
      lastPlacerId: null,
      precedingSnapshot: null,
      latestSnapshot: null,
    };
  }

  private getNextPlayerId(room: RoomSession, currentId: string): string {
    const seatIdx = room.seats.indexOf(currentId);
    if (seatIdx === -1) return room.seats[0];
    return room.seats[(seatIdx + 1) % 4];
  }

  private isTableDeadlocked(room: RoomSession): boolean {
    const boardEnds = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;
    if (!boardEnds) return false;

    for (const pid of room.seats) {
      const hand = room.hands[pid] || [];
      if (hand.length > 0) {
        const { moves } = getPlayableMovesForHand(hand, boardEnds, false);
        if (moves.length > 0) return false;
      }
    }
    return true;
  }

  private async executeMove(room: RoomSession, playerId: string, tileId: string, targetEnd: "root" | "left" | "right") {
    const hand = room.hands[playerId] || [];
    const boardEnds = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;

    const { moves } = getPlayableMovesForHand(hand, boardEnds, room.mustPlaySixSix);
    const chosen = moves.find((m) => m.tile.id === tileId && m.targetEnd === targetEnd);
    if (!chosen) return;

    const nextPlayerId = this.getNextPlayerId(room, playerId);

    room.precedingSnapshot = room.latestSnapshot;
    room.latestSnapshot = {
      playerId,
      handBeforeMove: [...hand],
      boardEndsBeforeMove: boardEnds ? { ...boardEnds } : null,
      movePlayed: chosen,
      nextPlayerId,
      nextPlayerHand: [...(room.hands[nextPlayerId] || [])],
      allHandsAtTurn: JSON.parse(JSON.stringify(room.hands)),
    };
    room.lastPlacerId = playerId;
    room.consecutivePasses = 0;
    room.mustPlaySixSix = false;

    room.board = placeTileOnBoard(room.board, chosen.tile, chosen.targetEnd);
    room.hands[playerId] = hand.filter((t) => t.id !== tileId);

    if (room.hands[playerId].length === 0) {
      const payout = calculateNormalFinishPayout(room.hands);
      await this.commitRoundSettlement(room, payout);
      return;
    }

    const boardEndsCurrent = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;

    if (boardEndsCurrent && this.isTableDeadlocked(room)) {
      const blockerId = room.lastPlacerId || playerId;
      const snapshotP = room.precedingSnapshot ?? room.latestSnapshot!;
      const cf = analyzeCounterfactualBlock(snapshotP, blockerId, room.hands, boardEndsCurrent);
      const payout = calculateBlockedGamePayout(room.hands, blockerId, cf);
      await this.commitRoundSettlement(room, payout);
      return;
    }

    room.activeTurnPlayerId = nextPlayerId;
    this.broadcastRoomState(room);

    if (nextPlayerId.startsWith("bot-")) {
      setTimeout(() => this.processBotTurn(room), 1200);
    }
  }

  private async executePass(room: RoomSession, playerId: string) {
    room.consecutivePasses += 1;
    this.io.to(room.roomId).emit("game:pass", { playerId, message: "Passed!" });

    const boardEnds = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;

    if ((room.consecutivePasses >= 4 || (boardEnds && this.isTableDeadlocked(room))) && room.lastPlacerId && boardEnds) {
      const blockerId = room.lastPlacerId;
      const snapshotP = room.precedingSnapshot ?? room.latestSnapshot!;
      const cf = analyzeCounterfactualBlock(snapshotP, blockerId, room.hands, boardEnds);
      const payout = calculateBlockedGamePayout(room.hands, blockerId, cf);
      await this.commitRoundSettlement(room, payout);
      return;
    }

    const nextPlayerId = this.getNextPlayerId(room, playerId);
    room.activeTurnPlayerId = nextPlayerId;
    this.broadcastRoomState(room);

    if (nextPlayerId.startsWith("bot-")) {
      setTimeout(() => this.processBotTurn(room), 1200);
    }
  }

  private startNewRound(room: RoomSession): void {
    room.roundNumber += 1;
    room.board = createInitialBoardState();
    room.consecutivePasses = 0;
    room.lastPlacerId = null;
    room.precedingSnapshot = null;
    room.latestSnapshot = null;

    const deal = dealValidFourPlayerHands(room.seats);
    room.hands = deal.hands;

    if (deal.redealCount > 0) {
      this.io.to(room.roomId).emit("game:announcement", { text: "4+ Doubles Dealt — Reshuffling!" });
    }

    const starter = determineStartingPlayer(room.roundNumber, room.hands, room.previousWinnerId);
    room.activeTurnPlayerId = starter.starterId;
    room.mustPlaySixSix = starter.mustPlaySixSix;
    this.broadcastRoomState(room);

    if (room.activeTurnPlayerId.startsWith("bot-")) {
      setTimeout(() => this.processBotTurn(room), 1200);
    }
  }

  private async processBotTurn(room: RoomSession): Promise<void> {
    const botId = room.activeTurnPlayerId;
    if (!botId || !botId.startsWith("bot-")) return;

    const hand = room.hands[botId] || [];
    const boardEnds = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;

    const { moves } = getPlayableMovesForHand(hand, boardEnds, room.mustPlaySixSix);

    if (moves.length > 0) {
      const chosenMove = moves.sort((a, b) => b.tile.pipSum - a.tile.pipSum)[0];
      await this.executeMove(room, botId, chosenMove.tile.id, chosenMove.targetEnd);
    } else {
      await this.executePass(room, botId);
    }
  }

  private async commitRoundSettlement(room: RoomSession, payout: PayoutResult): Promise<void> {
    room.previousWinnerId = payout.winnerId;
    room.activeTurnPlayerId = null;

    await prisma.$transaction(
      room.seats.map((pid) =>
        prisma.player.updateMany({
          where: { id: pid },
          data: {
            credits: { increment: payout.creditChanges[pid] ?? 0 },
            gamesPlayed: { increment: 1 },
            gamesWon: { increment: pid === payout.winnerId ? 1 : 0 },
          },
        })
      )
    );

    this.broadcastRoomState(room);
    this.io.to(room.roomId).emit("game:settled", payout);
  }

  private broadcastRoomState(room: RoomSession): void {
    const opponentTileCounts: Record<string, number> = {};
    for (const pid of room.seats) {
      opponentTileCounts[pid] = room.hands[pid] ? room.hands[pid].length : 0;
    }

    const socketsInRoom = this.io.sockets.adapter.rooms.get(room.roomId);
    if (!socketsInRoom) return;

    for (const socketId of Array.from(socketsInRoom)) {
      const client = this.io.sockets.sockets.get(socketId);
      const viewerId = client?.data?.playerId;
      client?.emit("game:state", {
        roomId: room.roomId,
        roundNumber: room.roundNumber,
        seats: room.seats,
        board: room.board,
        activeTurnPlayerId: room.activeTurnPlayerId,
        mustPlaySixSix: room.mustPlaySixSix,
        myHand: viewerId ? room.hands[viewerId] ?? [] : [],
        opponentTileCounts,
      });
    }
  }
}
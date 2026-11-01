import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { BoardState, DominoTile, PayoutResult, TurnSnapshot } from "../types/game";
import { dealValidFourPlayerHands, determineStartingPlayer, getPlayableMovesForHand } from "../engine/deck";
import { createInitialBoardState, placeTileOnBoard } from "../engine/boardLayoutEngine";
import { analyzeCounterfactualBlock } from "../engine/counterfactualAnalyzer";
import { calculateBlockedGamePayout, calculateNormalFinishPayout } from "../engine/payoutCalculator";

const prisma = new PrismaClient();

interface SeatObject {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface RoomSession {
  roomId: string;
  ownerId: string | null;
  seats: SeatObject[];
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

  constructor(io: Server) { 
    this.io = io; 
  }

  public registerSocket(socket: Socket): void {
    socket.on("room:join", async ({ roomId, playerId }) => {
      const cleanId = playerId ? playerId.toLowerCase().trim() : "";
      socket.data.playerId = cleanId;
      socket.join(roomId);

      let room = this.rooms.get(roomId);
      if (!room) {
        room = this.createEmptyRoomState(roomId, cleanId);
        this.rooms.set(roomId, room);
      }

      this.broadcastRoomState(room);
    });

    socket.on("seat:claim", ({ roomId, seatName, email, avatar }) => {
      if (!email) return;
      
      let room = this.rooms.get(roomId);
      if (!room) {
        room = this.createEmptyRoomState(roomId, null);
        this.rooms.set(roomId, room);
      }

      const cleanEmail = email.toLowerCase().trim();
      socket.data.playerId = cleanEmail;
      const safeAvatar = avatar && avatar.length < 45000 ? avatar : "";

      room.seats.forEach(s => {
        if (s.email && s.email.toLowerCase().trim() === cleanEmail) {
          s.email = "";
          s.avatar = "";
        }
      });

      const targetSeat = room.seats.find(s => s.name === seatName);
      if (targetSeat && targetSeat.email === "") {
        targetSeat.email = cleanEmail;
        targetSeat.avatar = safeAvatar;
      }

      this.broadcastRoomState(room);
    });

    socket.on("seat:leave", ({ roomId, email }) => {
      if (!email) return;
      const room = this.rooms.get(roomId);
      if (!room) return;

      const cleanEmail = email.toLowerCase().trim();
      room.seats.forEach(s => {
        if (s.email && s.email.toLowerCase().trim() === cleanEmail) {
          s.email = "";
          s.avatar = "";
        }
      });

      this.broadcastRoomState(room);
    });

    socket.on("game:deal", ({ roomId }) => {
      const room = this.rooms.get(roomId);
      if (!room) return;

      const allOccupied = room.seats.every(s => s.email !== "");
      if (allOccupied && !room.activeTurnPlayerId) {
        this.startNewRound(room);
      }
    });

    socket.on("game:playTile", async ({ roomId, playerId, tileId, targetEnd }) => {
      try {
        const room = this.rooms.get(roomId);
        const cleanId = (playerId || socket.data.playerId || "").toLowerCase().trim();
        if (!room || !room.activeTurnPlayerId) return;
        if (room.activeTurnPlayerId.toLowerCase().trim() !== cleanId) return;

        await this.executeMove(room, cleanId, tileId, targetEnd);
      } catch (err) {
        console.error("[game:playTile Error]:", err);
      }
    });

    socket.on("game:passTurn", async ({ roomId, playerId }) => {
      try {
        const room = this.rooms.get(roomId);
        const cleanId = (playerId || socket.data.playerId || "").toLowerCase().trim();
        if (!room || !room.activeTurnPlayerId) return;
        if (room.activeTurnPlayerId.toLowerCase().trim() !== cleanId) return;

        await this.executePass(room, cleanId);
      } catch (err) {
        console.error("[game:passTurn Error]:", err);
      }
    });

    socket.on("disconnect", () => {});
  }

  private createEmptyRoomState(roomId: string, ownerId: string | null): RoomSession {
    return {
      roomId,
      ownerId,
      seats: [
        { id: "player-a", name: "PLAYER A", email: "", avatar: "" },
        { id: "player-b", name: "PLAYER B", email: "", avatar: "" },
        { id: "player-c", name: "PLAYER C", email: "", avatar: "" },
        { id: "player-d", name: "PLAYER D", email: "", avatar: "" },
      ],
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

  private startNewRound(room: RoomSession): void {
    room.roundNumber += 1;
    room.board = createInitialBoardState();
    room.consecutivePasses = 0;
    room.lastPlacerId = null;

    const playerEmails = room.seats.map(s => s.email.toLowerCase().trim());
    const deal = dealValidFourPlayerHands(playerEmails);
    
    room.hands = {};
    for (const [k, v] of Object.entries(deal.hands)) {
      room.hands[k.toLowerCase().trim()] = v;
    }

    const starter = determineStartingPlayer(room.roundNumber, room.hands, room.previousWinnerId);
    room.activeTurnPlayerId = starter.starterId.toLowerCase().trim();
    room.mustPlaySixSix = starter.mustPlaySixSix;

    this.broadcastRoomState(room);
    this.io.to(room.roomId).emit("game:dealt", {});
  }

  private async executeMove(room: RoomSession, playerId: string, tileId: string, targetEnd: "root" | "left" | "right") {
    const cleanId = playerId.toLowerCase().trim();
    const hand = room.hands[cleanId] || [];
    const boardEnds = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;

    const { moves } = getPlayableMovesForHand(hand, boardEnds, room.mustPlaySixSix);
    
    let chosen = moves.find((m) => m.tile.id === tileId && m.targetEnd === targetEnd);
    if (!chosen) {
      chosen = moves.find((m) => m.tile.id === tileId);
    }
    if (!chosen && room.mustPlaySixSix && moves.length === 1) {
      chosen = moves[0];
    }

    if (!chosen) {
      console.log(`[Move Rejected] Tile ${tileId} on ${targetEnd} not in legal moves.`);
      return;
    }

    const actualTileId = chosen.tile.id;
    const nextPlayerId = this.getNextPlayerId(room, cleanId);

    room.precedingSnapshot = room.latestSnapshot;
    room.latestSnapshot = {
      playerId: cleanId,
      handBeforeMove: [...hand],
      boardEndsBeforeMove: boardEnds ? { ...boardEnds } : null,
      movePlayed: chosen,
      nextPlayerId,
      nextPlayerHand: [...(room.hands[nextPlayerId] || [])],
      allHandsAtTurn: JSON.parse(JSON.stringify(room.hands)),
    };
    room.lastPlacerId = cleanId;
    room.consecutivePasses = 0;
    room.mustPlaySixSix = false;

    room.board = placeTileOnBoard(room.board, chosen.tile, chosen.targetEnd);
    room.hands[cleanId] = hand.filter((t) => t.id !== actualTileId);

    if (room.hands[cleanId].length === 0) {
      const payout = calculateNormalFinishPayout(room.hands);
      await this.commitRoundSettlement(room, payout);
      return;
    }

    const boardEndsCurrent = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;

    if (boardEndsCurrent && this.isTableDeadlocked(room)) {
      const blockerId = room.lastPlacerId || cleanId;
      const snapshotP = room.precedingSnapshot ?? room.latestSnapshot!;
      const cf = analyzeCounterfactualBlock(snapshotP, blockerId, room.hands, boardEndsCurrent);
      const payout = calculateBlockedGamePayout(room.hands, blockerId, cf);
      await this.commitRoundSettlement(room, payout);
      return;
    }

    room.activeTurnPlayerId = nextPlayerId;
    this.broadcastRoomState(room);
  }

  private async executePass(room: RoomSession, playerId: string) {
    const cleanId = playerId.toLowerCase().trim();
    room.consecutivePasses += 1;
    this.io.to(room.roomId).emit("game:pass", { playerId: cleanId, message: "Passed!" });

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

    room.activeTurnPlayerId = this.getNextPlayerId(room, cleanId);
    this.broadcastRoomState(room);
  }

  private getNextPlayerId(room: RoomSession, currentId: string): string {
    const seatEmails = room.seats.map(s => s.email.toLowerCase().trim());
    const seatIdx = seatEmails.indexOf(currentId.toLowerCase().trim());
    if (seatIdx === -1) return seatEmails[0];
    return seatEmails[(seatIdx + 1) % 4];
  }

  private isTableDeadlocked(room: RoomSession): boolean {
    const boardEnds = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;
    if (!boardEnds) return false;

    for (const s of room.seats) {
      const pid = s.email.toLowerCase().trim();
      const hand = room.hands[pid] || [];
      if (hand.length > 0) {
        const { moves } = getPlayableMovesForHand(hand, boardEnds, false);
        if (moves.length > 0) return false;
      }
    }
    return true;
  }

  private async commitRoundSettlement(room: RoomSession, payout: PayoutResult): Promise<void> {
    room.previousWinnerId = payout.winnerId;
    room.activeTurnPlayerId = null;
    this.broadcastRoomState(room);
    this.io.to(room.roomId).emit("game:settled", payout);
  }

  private broadcastRoomState(room: RoomSession): void {
    const opponentTileCounts: Record<string, number> = {};
    for (const s of room.seats) {
      const email = s.email.toLowerCase().trim();
      if (email) {
        opponentTileCounts[email] = room.hands[email] ? room.hands[email].length : 0;
      }
    }

    const boardEnds = room.board.leftEnd && room.board.rightEnd
      ? { left: room.board.leftEnd.openPip, right: room.board.rightEnd.openPip }
      : null;

    const socketsInRoom = this.io.sockets.adapter.rooms.get(room.roomId);
    if (!socketsInRoom) return;

    for (const socketId of Array.from(socketsInRoom)) {
      const client = this.io.sockets.sockets.get(socketId);
      const viewerEmail = client?.data?.playerId ? client.data.playerId.toLowerCase().trim() : "";
      const myHand = viewerEmail ? room.hands[viewerEmail] ?? [] : [];
      const { moves: myLegalMoves } = getPlayableMovesForHand(myHand, boardEnds, room.mustPlaySixSix);

      client?.emit("game:state", {
        roomId: room.roomId,
        roundNumber: room.roundNumber,
        seats: room.seats,
        board: room.board,
        activeTurnPlayerId: room.activeTurnPlayerId,
        mustPlaySixSix: room.mustPlaySixSix,
        isDealt: room.activeTurnPlayerId !== null,
        dealingLocked: room.activeTurnPlayerId !== null,
        myHand,
        myLegalMoves,
        opponentTileCounts,
      });
    }
  }
}
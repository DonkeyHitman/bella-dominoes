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
    socket.on("room:join", async ({ roomId, playerId, playerName }) => {
      socket.data.playerId = playerId;
      socket.join(roomId);

      let room = this.rooms.get(roomId);

      if (!room) {
        room = this.createEmptyRoomState(roomId, playerId);
        this.rooms.set(roomId, room);
      }

      this.broadcastRoomState(room);
    });

    socket.on("seat:claim", ({ roomId, seatName, email, avatar, name }) => {
      if (!email) return; // Safeguard against empty emails
      
      let room = this.rooms.get(roomId);
      if (!room) {
        room = this.createEmptyRoomState(roomId, null);
        this.rooms.set(roomId, room);
      }

      const cleanEmail = email.toLowerCase().trim();

      // Remove this user from any other seat first (allows switching)
      room.seats.forEach(s => {
        if (s.email && s.email.toLowerCase().trim() === cleanEmail) {
          s.email = "";
          s.avatar = "";
        }
      });

      // Assign to target seat if available
      const targetSeat = room.seats.find(s => s.name === seatName);
      if (targetSeat && targetSeat.email === "") {
        targetSeat.email = cleanEmail;
        targetSeat.avatar = avatar || "";
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

    socket.on("game:deal", ({ roomId, email }) => {
      const room = this.rooms.get(roomId);
      if (!room) return;

      const allOccupied = room.seats.every(s => s.email !== "");
      if (allOccupied && !room.activeTurnPlayerId) {
        this.startNewRound(room);
      }
    });

    socket.on("disconnect", () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
    });
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

    const playerEmails = room.seats.map(s => s.email);
    const deal = dealValidFourPlayerHands(playerEmails);
    room.hands = deal.hands;

    const starter = determineStartingPlayer(room.roundNumber, room.hands, room.previousWinnerId);
    room.activeTurnPlayerId = starter.starterId;
    room.mustPlaySixSix = starter.mustPlaySixSix;

    this.broadcastRoomState(room);
    this.io.to(room.roomId).emit("game:dealt", {
      myHand: []
    });
  }

  private broadcastRoomState(room: RoomSession): void {
    const opponentTileCounts: Record<string, number> = {};
    for (const s of room.seats) {
      if (s.email) {
        opponentTileCounts[s.email] = room.hands[s.email] ? room.hands[s.email].length : 0;
      }
    }

    const socketsInRoom = this.io.sockets.adapter.rooms.get(room.roomId);
    if (!socketsInRoom) return;

    for (const socketId of Array.from(socketsInRoom)) {
      const client = this.io.sockets.sockets.get(socketId);
      const viewerEmail = client?.data?.playerId;
      
      client?.emit("game:state", {
        roomId: room.roomId,
        roundNumber: room.roundNumber,
        seats: room.seats,
        board: room.board,
        activeTurnPlayerId: room.activeTurnPlayerId,
        mustPlaySixSix: room.mustPlaySixSix,
        isDealt: room.activeTurnPlayerId !== null,
        dealingLocked: room.activeTurnPlayerId !== null,
        myHand: viewerEmail ? room.hands[viewerEmail] ?? [] : [],
        opponentTileCounts,
      });
    }
  }
}
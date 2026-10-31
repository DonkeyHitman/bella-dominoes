"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { BoardState, DominoTile as DominoTileType, PayoutResult } from "../../../types/game";
import { createInitialBoardState } from "../../../engine/boardLayoutEngine";
import { getPlayableMovesForHand } from "../../../engine/deck";
import { GameBoardCanvas } from "../../../components/GameBoardCanvas";
import { PlayerPod, PlayerProfileSummary } from "../../../components/PlayerPod";
import { PlayerHand } from "../../../components/PlayerHand";
import { ControlTray } from "../../../components/ControlTray";
import { SettlementModal } from "../../../components/SettlementModal";
import { FastForward, LogOut } from "lucide-react";

const BOT_META: Record<string, { name: string; seed: string }> = {
  "bot-3": { name: "Bot Tiến", seed: "Tien" },
  "bot-2": { name: "Bot Vượng", seed: "Vuong" },
  "bot-1": { name: "Bot Tuấn", seed: "Tuan" },
};

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = String(params?.roomId || "main-club");
  const socketRef = useRef<Socket | null>(null);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [rosterMap, setRosterMap] = useState<Record<string, PlayerProfileSummary>>({});
  const [seats, setSeats] = useState<string[]>([]);
  const [board, setBoard] = useState<BoardState>(() => createInitialBoardState());
  const [myHand, setMyHand] = useState<DominoTileType[]>([]);
  const [opponentCounts, setOpponentCounts] = useState<Record<string, number>>({});
  const [activeTurnPlayerId, setActiveTurnPlayerId] = useState<string | null>(null);
  const [mustPlaySixSix, setMustPlaySixSix] = useState(false);
  const [isMagnifying, setIsMagnifying] = useState(false);
  const [pendingTile, setPendingTile] = useState<DominoTileType | null>(null);
  const [settlement, setSettlement] = useState<PayoutResult | null>(null);
  const [chatLog, setChatLog] = useState<Array<{ sender: string; text: string }>>([]);

  const fetchRoster = () => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) {
          const m: Record<string, PlayerProfileSummary> = {};
          list.forEach((p) => {
            m[p.id] = { ...p, remainingTiles: 7, isTurn: false };
          });
          setRosterMap(m);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const savedId = localStorage.getItem("bella_dominoes_player_id");
    if (!savedId) {
      router.push("/");
      return;
    }
    setMyPlayerId(savedId);

    const savedAvatar = localStorage.getItem(`bella_avatar_${savedId}`);
    if (savedAvatar) setCustomAvatar(savedAvatar);

    fetchRoster();

    const socket = io();
    socketRef.current = socket;
    socket.emit("room:join", { roomId, playerId: savedId });

    socket.on("game:state", (data) => {
      if (Array.isArray(data.seats)) setSeats(data.seats);
      if (data.board) setBoard(data.board);
      setActiveTurnPlayerId(data.activeTurnPlayerId);
      setMustPlaySixSix(Boolean(data.mustPlaySixSix));
      if (Array.isArray(data.myHand)) setMyHand(data.myHand);
      if (data.opponentTileCounts) {
        setOpponentCounts({ ...data.opponentTileCounts });
      }
    });

    socket.on("game:settled", (p) => {
      setSettlement(p);
      fetchRoster();
    });
    socket.on("chat:message", (msg) => setChatLog((prev) => [...prev, msg]));

    return () => {
      socket.disconnect();
    };
  }, [roomId, router]);

  const handleAvatarUpdate = (newUrl: string) => {
    setCustomAvatar(newUrl);
    if (myPlayerId) {
      localStorage.setItem(`bella_avatar_${myPlayerId}`, newUrl);
    }
  };

  const handleLeaveTable = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    router.push("/");
  };

  const boardEnds = useMemo(() => {
    if (!board.leftEnd || !board.rightEnd) return null;
    return { left: board.leftEnd.openPip, right: board.rightEnd.openPip };
  }, [board]);

  const evaluation = useMemo(
    () => getPlayableMovesForHand(myHand, boardEnds, mustPlaySixSix),
    [myHand, boardEnds, mustPlaySixSix]
  );

  const handlePlay = (tile: DominoTileType) => {
    if (!socketRef.current || !myPlayerId || activeTurnPlayerId !== myPlayerId) return;
    if (evaluation.ambiguousTileIds.has(tile.id)) {
      setPendingTile(tile);
      return;
    }
    const move = evaluation.moves.find((m) => m.tile.id === tile.id);
    if (!move) return;
    socketRef.current.emit("game:playTile", {
      roomId,
      playerId: myPlayerId,
      tileId: tile.id,
      targetEnd: move.targetEnd,
    });
  };

  const handlePass = () => {
    if (!socketRef.current || !myPlayerId || activeTurnPlayerId !== myPlayerId) return;
    socketRef.current.emit("game:passTurn", { roomId, playerId: myPlayerId });
  };

  const handleResolve = (targetEnd: "left" | "right") => {
    if (!pendingTile || !socketRef.current || !myPlayerId) return;
    socketRef.current.emit("game:playTile", {
      roomId,
      playerId: myPlayerId,
      tileId: pendingTile.id,
      targetEnd,
    });
    setPendingTile(null);
  };

  const opponentsAroundTable = useMemo(() => {
    const myIdx = myPlayerId && seats.includes(myPlayerId) ? seats.indexOf(myPlayerId) : 0;
    const rightId = seats.length === 4 ? seats[(myIdx + 1) % 4] : "bot-3";
    const topId = seats.length === 4 ? seats[(myIdx + 2) % 4] : "bot-2";
    const leftId = seats.length === 4 ? seats[(myIdx + 3) % 4] : "bot-1";

    return [
      {
        id: rightId,
        defaultName: BOT_META[rightId]?.name ?? "Bot Tiến",
        seed: BOT_META[rightId]?.seed ?? "Tien",
        pos: "right-[calc(50%-730px)] top-1/2 -translate-y-1/2",
        orient: "vertical" as const,
      },
      {
        id: topId,
        defaultName: BOT_META[topId]?.name ?? "Bot Vượng",
        seed: BOT_META[topId]?.seed ?? "Vuong",
        pos: "top-4 left-1/2 -translate-x-1/2",
        orient: "horizontal" as const,
      },
      {
        id: leftId,
        defaultName: BOT_META[leftId]?.name ?? "Bot Tuấn",
        seed: BOT_META[leftId]?.seed ?? "Tuan",
        pos: "left-[calc(50%-730px)] top-1/2 -translate-y-1/2",
        orient: "vertical" as const,
      },
    ];
  }, [seats, myPlayerId]);

  // Comprehensive player names lookup mapping all IDs (human UUIDs + bots) to their display names
  const playerNames = useMemo(() => {
    const m: Record<string, string> = {
      "bot-3": "Bot Tiến",
      "bot-2": "Bot Vượng",
      "bot-1": "Bot Tuấn",
    };
    Object.entries(rosterMap).forEach(([id, p]) => {
      m[id] = p.name;
    });
    if (myPlayerId && rosterMap[myPlayerId]) {
      m[myPlayerId] = rosterMap[myPlayerId].name;
    }
    return m;
  }, [rosterMap, myPlayerId]);

  const myBase = myPlayerId ? rosterMap[myPlayerId] : null;
  const myAvatarUrl =
    customAvatar ||
    myBase?.avatarUrl ||
    `https://api.dicebear.com/9.x/adventurer/svg?seed=${myPlayerId || "John"}`;

  const isMyTurn = activeTurnPlayerId === myPlayerId;
  const hasNoMoves = evaluation.playableTileIds.size === 0;

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden flex items-center justify-center select-none">
      {/* Leave Table Button in Top-Left Corner */}
      <div className="fixed top-6 left-8 z-50">
        <button
          onClick={handleLeaveTable}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/95 hover:bg-slate-800 text-rose-400 border border-rose-500/40 rounded-2xl shadow-2xl backdrop-blur-md transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          title="Leave Table & Return to Lobby"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-black tracking-wide text-white">Leave Table</span>
        </button>
      </div>

      {!isMagnifying &&
        opponentsAroundTable.map((seat) => {
          const base = rosterMap[seat.id] || {
            id: seat.id,
            name: seat.defaultName,
            avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${seat.seed}`,
            credits: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            remainingTiles: 7,
            isTurn: false,
          };
          const liveTileCount =
            typeof opponentCounts[seat.id] === "number" ? opponentCounts[seat.id] : 7;

          return (
            <PlayerPod
              key={seat.id}
              positionClass={seat.pos}
              orientation={seat.orient}
              player={{
                ...base,
                remainingTiles: liveTileCount,
                isTurn: activeTurnPlayerId === seat.id,
              }}
              isRoundOver={Boolean(settlement)}
            />
          );
        })}

      {!isMagnifying && myPlayerId && (
        <PlayerPod
          positionClass="bottom-32 left-1/2 -translate-x-1/2"
          orientation="horizontal"
          isMe={true}
          onAvatarUpdate={handleAvatarUpdate}
          player={{
            id: myPlayerId,
            name: myBase?.name ?? "John",
            avatarUrl: myAvatarUrl,
            credits: myBase?.credits ?? 0,
            gamesPlayed: myBase?.gamesPlayed ?? 0,
            gamesWon: myBase?.gamesWon ?? 0,
            remainingTiles: myHand.length,
            isTurn: isMyTurn,
          }}
          isRoundOver={Boolean(settlement)}
        />
      )}

      <GameBoardCanvas
        board={board}
        playerCount={seats.length}
        isMagnifying={isMagnifying}
        pendingAmbiguousTile={pendingTile}
        onResolveAmbiguousEnd={handleResolve}
      />

      {/* Turn Banner & Direct Pass Button Overlay */}
      {isMyTurn && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 animate-bounce">
          <div className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase rounded-full shadow-lg tracking-wider">
            {hasNoMoves ? "No Valid Moves Available!" : "Your Turn — Double-click tile to play"}
          </div>
          {hasNoMoves && (
            <button
              onClick={handlePass}
              className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase rounded-full shadow-2xl transition animate-pulse cursor-pointer border-2 border-white"
            >
              <FastForward className="w-4 h-4" />
              <span>Pass Turn</span>
            </button>
          )}
        </div>
      )}

      {!isMagnifying && myPlayerId && (
        <PlayerHand
          hand={myHand}
          playableTileIds={evaluation.playableTileIds}
          ambiguousTileIds={evaluation.ambiguousTileIds}
          isMyTurn={isMyTurn}
          playerName={myBase?.name ?? "John"}
          credits={myBase?.credits ?? 0}
          onQuickPlayTile={handlePlay}
          onPassTurn={handlePass}
          hasPlayableMoves={!hasNoMoves}
        />
      )}

      <ControlTray
        onMagnifyChange={setIsMagnifying}
        onSendEmoji={(emoji) =>
          socketRef.current?.emit("chat:emoji", { roomId, playerId: myPlayerId, emoji })
        }
        onSendChat={(msg) =>
          socketRef.current?.emit("chat:message", {
            roomId,
            sender: rosterMap[myPlayerId || ""]?.name || "Player",
            text: msg,
          })
        }
        chatLog={chatLog}
      />

      <SettlementModal
        payout={settlement}
        playerNames={playerNames}
        onNextRound={() => {
          setSettlement(null);
          socketRef.current?.emit("room:nextRound", { roomId });
        }}
      />
    </div>
  );
}

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
import { SettlementModal } from "../../../components/SettlementModal";
import { FastForward, LogOut, Copy, Check, MessageSquare } from "lucide-react";

const BOT_META: Record<string, { name: string; seed: string }> = {
  "bot-3": { name: "Bot Tiến", seed: "Tien" },
  "bot-2": { name: "Bot Vượng", seed: "Vuong" },
  "bot-1": { name: "Bot Tuấn", seed: "Tuan" },
};

const QUICK_EMOJIS = ["👍", "😂", "🔥", "😡", "🎲", "👏"];

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
  const [pendingTile, setPendingTile] = useState<DominoTileType | null>(null);
  const [settlement, setSettlement] = useState<PayoutResult | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [chatLog, setChatLog] = useState<Array<{ sender: string; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
      router.push(`/?invite=${roomId}`);
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

    socket.on("room:destroyed", (data) => {
      alert(data.message);
      window.location.href = "/";
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, router]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatLog]);

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

  const handleCopyInvite = () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current || !myPlayerId) return;
    
    socketRef.current.emit("chat:message", {
      roomId,
      sender: rosterMap[myPlayerId]?.name || "Player",
      text: chatInput.trim(),
    });
    
    setChatInput("");
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
    const useBots = roomId === "main-club";

    const rightId = seats[(myIdx + 1) % 4] || (useBots ? "bot-3" : "empty-1");
    const topId = seats[(myIdx + 2) % 4] || (useBots ? "bot-2" : "empty-2");
    const leftId = seats[(myIdx + 3) % 4] || (useBots ? "bot-1" : "empty-3");

    // Symmetrical positioning around the relative flex container
    return [
      {
        id: rightId,
        defaultName: rightId.startsWith("bot-") ? BOT_META[rightId]?.name ?? "Bot Tiến" : "Player",
        seed: rightId.startsWith("bot-") ? BOT_META[rightId]?.seed ?? "Tien" : rightId,
        pos: "right-8 top-1/2 -translate-y-1/2", 
        orient: "vertical" as const,
      },
      {
        id: topId,
        defaultName: topId.startsWith("bot-") ? BOT_META[topId]?.name ?? "Bot Vượng" : "Player",
        seed: topId.startsWith("bot-") ? BOT_META[topId]?.seed ?? "Vuong" : topId,
        pos: "top-8 left-1/2 -translate-x-1/2",
        orient: "horizontal" as const,
      },
      {
        id: leftId,
        defaultName: leftId.startsWith("bot-") ? BOT_META[leftId]?.name ?? "Bot Tuấn" : "Player",
        seed: leftId.startsWith("bot-") ? BOT_META[leftId]?.seed ?? "Tuan" : leftId,
        pos: "left-8 top-1/2 -translate-y-1/2",
        orient: "vertical" as const,
      },
    ];
  }, [seats, myPlayerId, roomId]);

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
  const myName = myBase?.name ?? "John";
  const myAvatarUrl =
    customAvatar ||
    myBase?.avatarUrl ||
    `https://api.dicebear.com/9.x/adventurer/svg?seed=${myPlayerId || "John"}`;

  const isMyTurn = activeTurnPlayerId === myPlayerId;
  const hasNoMoves = evaluation.playableTileIds.size === 0;

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden flex select-none">
      
      {/* Main Playable Area */}
      <div className="relative flex-1 h-full">
        
        {/* Game Board: Shielded in absolute layer to guarantee geometric center */}
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <GameBoardCanvas
            board={board}
            playerCount={seats.length}
            isMagnifying={false}
            pendingAmbiguousTile={pendingTile}
            onResolveAmbiguousEnd={handleResolve}
          />
        </div>

        {/* Opponent Pods */}
        {opponentsAroundTable.map((seat) => {
          if (seat.id.startsWith("empty-")) {
            return (
              <div
                key={seat.id}
                className={`absolute ${seat.pos} w-28 h-32 border-2 border-dashed border-slate-700/50 bg-slate-900/30 rounded-2xl flex flex-col items-center justify-center z-10`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800/50 mb-2 flex items-center justify-center">
                  <span className="text-xl animate-pulse">⏳</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase text-center tracking-wider">
                  Waiting<br />for Player
                </span>
              </div>
            );
          }

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
              positionClass={`${seat.pos} z-10`}
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

        {/* My Pod */}
        {myPlayerId && (
          <PlayerPod
            positionClass="bottom-32 left-1/2 -translate-x-1/2 z-10"
            orientation="horizontal"
            isMe={true}
            onAvatarUpdate={handleAvatarUpdate}
            player={{
              id: myPlayerId,
              name: myName,
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

        {/* Turn Action Banner */}
        {isMyTurn && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 animate-bounce">
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

        {/* Player Hand */}
        {myPlayerId && (
          <div className="absolute bottom-0 w-full z-40">
            <PlayerHand
              hand={myHand}
              playableTileIds={evaluation.playableTileIds}
              ambiguousTileIds={evaluation.ambiguousTileIds}
              isMyTurn={isMyTurn}
              playerName={myName}
              credits={myBase?.credits ?? 0}
              onQuickPlayTile={handlePlay}
              onPassTurn={handlePass}
              hasPlayableMoves={!hasNoMoves}
            />
          </div>
        )}

        <SettlementModal
          payout={settlement}
          playerNames={playerNames}
          onNextRound={() => {
            setSettlement(null);
            socketRef.current?.emit("room:nextRound", { roomId });
          }}
        />
      </div>

      {/* Right Sidebar: Table Controls + Chat */}
      <div className="w-48 h-full bg-slate-900/95 border-l border-slate-800/80 backdrop-blur-md flex flex-col shadow-2xl z-50 shrink-0">
        
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="mb-4 text-center">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-bold mb-0.5">Active Table</span>
            <span className="text-sm font-black text-amber-400 break-words leading-tight">{roomId}</span>
          </div>
          
          <div className="flex flex-col gap-2">
            <button
              onClick={handleCopyInvite}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] font-bold text-amber-400 rounded-lg transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className={copied ? "text-emerald-400" : ""}>{copied ? "Copied!" : "Copy Link"}</span>
            </button>

            <button
              onClick={handleLeaveTable}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">Leave Table</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-black text-amber-400 text-xs tracking-wide">Table Chat</span>
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-700">
          {chatLog.length === 0 && (
            <div className="text-center text-[10px] text-slate-500 italic mt-6">No messages yet. Say hello!</div>
          )}
          {chatLog.map((msg, i) => {
            const isMe = msg.sender === myName;
            return (
              <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[9px] text-slate-500 font-bold mb-0.5 ml-1">{msg.sender}</span>
                <div className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold max-w-[95%] break-words shadow-sm ${
                  isMe 
                    ? "bg-amber-500 text-slate-950 rounded-br-none" 
                    : "bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none"
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-900">
          <div className="flex justify-between gap-1 mb-2">
            {QUICK_EMOJIS.map(emoji => (
              <button 
                key={emoji} 
                onClick={() => setChatInput(prev => prev + emoji)}
                className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition text-xs flex-1 flex items-center justify-center hover:scale-105 active:scale-95 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="flex gap-1.5">
            <input 
              type="text"
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              placeholder="Type..." 
              className="flex-1 min-w-0 bg-slate-950 border border-slate-700 text-white text-[11px] px-2 py-2 rounded-lg outline-none focus:border-amber-500 transition shadow-inner" 
            />
            <button 
              type="submit" 
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-2 rounded-lg font-bold text-[11px] transition shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
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
import { FastForward, LogOut, Copy, Check, MessageSquare, Globe } from "lucide-react";

const BOT_META: Record<string, { name: string; seed: string }> = {
  "bot-3": { name: "Bot Tiến", seed: "Tien" },
  "bot-2": { name: "Bot Vượng", seed: "Vuong" },
  "bot-1": { name: "Bot Tuấn", seed: "Tuan" },
};

const QUICK_EMOJIS = ["👍", "😂", "🔥", "😡", "🎲", "👏"];

const t = {
  en: {
    activeTable: "Active Table",
    copyLink: "Copy Link",
    copied: "Copied!",
    leaveTable: "Leave Table",
    tableChat: "Table Chat",
    noMessages: "No messages yet. Say hello!",
    typePlaceholder: "Type...",
    send: "Send",
    waitingForPlayer: "Waiting\nfor Player",
    yourTurn: "Your Turn — Double-click tile to play",
    noMoves: "No Valid Moves Available!",
    passTurn: "Pass Turn",
  },
  vi: {
    activeTable: "Bàn Hiện Tại",
    copyLink: "Sao Chép Liên Kết",
    copied: "Đã Sao Chép!",
    leaveTable: "Rời Bàn",
    tableChat: "Trò Chuyện Bàn",
    noMessages: "Chưa có tin nhắn. Gửi lời chào nhé!",
    typePlaceholder: "Nhập tin nhắn...",
    send: "Gửi",
    waitingForPlayer: "Đang Chờ\nNgười Chơi",
    yourTurn: "Lượt của bạn — Nhấp đúp quân cờ để đánh",
    noMoves: "Không có nước đi hợp lệ!",
    passTurn: "Bỏ Lượt",
  },
};

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = String(params?.roomId || "main-club");
  const socketRef = useRef<Socket | null>(null);

  const [lang, setLang] = useState<"en" | "vi">("en");
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

  const strings = t[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("bella_lang") as "en" | "vi";
    if (savedLang) setLang(savedLang);

    const savedId = localStorage.getItem("bella_dominoes_player_id");
    const savedName = localStorage.getItem("bella_display_name");
    const savedEmail = localStorage.getItem("bella_email");

    if (!savedId || !savedName || !savedEmail) {
      router.push(`/?invite=${roomId}`);
      return;
    }

    if (typeof window !== "undefined" && screen.orientation && "lock" in screen.orientation) {
      (screen.orientation as any).lock("landscape").catch(() => {});
    }
    
    setMyPlayerId(savedId);
    const savedAvatar = localStorage.getItem(`bella_avatar_${savedId}`);
    if (savedAvatar) setCustomAvatar(savedAvatar);

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

    const socket = io();
    socketRef.current = socket;
    socket.emit("room:join", { roomId, playerId: savedId });

    socket.on("game:state", (data) => {
      if (Array.isArray(data.seats)) setSeats(data.seats);
      if (data.board) setBoard(data.board);
      setActiveTurnPlayerId(data.activeTurnPlayerId);
      setMustPlaySixSix(Boolean(data.mustPlaySixSix));
      if (Array.isArray(data.myHand)) setMyHand(data.myHand);
      if (data.opponentTileCounts) setOpponentCounts({ ...data.opponentTileCounts });
    });

    socket.on("game:settled", (p) => setSettlement(p));
    
    socket.on("room:destroyed", (data) => {
      alert(data.message);
      window.location.href = "/";
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, router]);

  const toggleLanguage = () => {
    const next = lang === "en" ? "vi" : "en";
    setLang(next);
    localStorage.setItem("bella_lang", next);
  };

  const handleAvatarUpdate = (newUrl: string) => {
    setCustomAvatar(newUrl);
    if (myPlayerId) localStorage.setItem(`bella_avatar_${myPlayerId}`, newUrl);
  };

  const handleLeaveTable = () => {
    socketRef.current?.disconnect();
    router.push("/");
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current || !myPlayerId) return;
    const currentName = rosterMap[myPlayerId]?.name || "John";
    socketRef.current.emit("chat:message", { roomId, sender: currentName, text: chatInput.trim() });
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
    socketRef.current.emit("game:playTile", { roomId, playerId: myPlayerId, tileId: tile.id, targetEnd: move.targetEnd });
  };

  const handlePass = () => {
    if (!socketRef.current || !myPlayerId || activeTurnPlayerId !== myPlayerId) return;
    socketRef.current.emit("game:passTurn", { roomId, playerId: myPlayerId });
  };

  const handleResolve = (targetEnd: "left" | "right") => {
    if (!pendingTile || !socketRef.current || !myPlayerId) return;
    socketRef.current.emit("game:playTile", { roomId, playerId: myPlayerId, tileId: pendingTile.id, targetEnd });
    setPendingTile(null);
  };

  const opponentsAroundTable = useMemo(() => {
    const myIdx = myPlayerId && seats.includes(myPlayerId) ? seats.indexOf(myPlayerId) : 0;
    const useBots = roomId === "main-club";

    // Ensure bot fallbacks are correctly assigned when seats array is sparse or missing entries
    const rightId = seats[(myIdx + 1) % 4] || (useBots ? "bot-3" : "empty-1");
    const topId = seats[(myIdx + 2) % 4] || (useBots ? "bot-2" : "empty-2");
    const leftId = seats[(myIdx + 3) % 4] || (useBots ? "bot-1" : "empty-3");

    return [
      { 
        id: rightId, 
        pos: "right-20 top-1/2 -translate-y-1/2", 
        orient: "vertical" as const,
        defaultName: rightId.startsWith("bot-") ? BOT_META[rightId]?.name ?? "Bot Tiến" : "Player", 
        seed: rightId.startsWith("bot-") ? BOT_META[rightId]?.seed ?? "Tien" : "Player" 
      },
      { 
        id: topId, 
        pos: "top-8 left-1/2 -translate-x-1/2", 
        orient: "horizontal" as const,
        defaultName: topId.startsWith("bot-") ? BOT_META[topId]?.name ?? "Bot Vượng" : "Player", 
        seed: topId.startsWith("bot-") ? BOT_META[topId]?.seed ?? "Vuong" : "Player" 
      },
      { 
        id: leftId, 
        pos: "left-8 top-1/2 -translate-y-1/2", 
        orient: "vertical" as const,
        defaultName: leftId.startsWith("bot-") ? BOT_META[leftId]?.name ?? "Bot Tuấn" : "Player", 
        seed: leftId.startsWith("bot-") ? BOT_META[leftId]?.seed ?? "Tuan" : "Player" 
      }
    ];
  }, [seats, myPlayerId, roomId]);

const myBase = myPlayerId ? rosterMap[myPlayerId] : null;
  const savedDisplayName = typeof window !== "undefined" ? localStorage.getItem("bella_display_name") : null;
  const myName = myBase?.name ?? savedDisplayName ?? "John";
  const myAvatarUrl = customAvatar || myBase?.avatarUrl || `https://api.dicebear.com/9.x/adventurer/svg?seed=${myPlayerId || "John"}`;
  const playerNames = useMemo(() => {
    const m: Record<string, string> = { "bot-3": "Bot Tiến", "bot-2": "Bot Vượng", "bot-1": "Bot Tuấn" };
    Object.entries(rosterMap).forEach(([id, p]) => { m[id] = p.name; });
    if (myPlayerId) m[myPlayerId] = myName;
    return m;
  }, [rosterMap, myPlayerId, myName]);

  

  const isMyTurn = activeTurnPlayerId === myPlayerId;
  const hasNoMoves = evaluation.playableTileIds.size === 0;

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden flex select-none">
      
      {/* Mobile Portrait Lock Overlay */}
      <div className="hidden portrait:flex fixed inset-0 z-[999] bg-slate-950 flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 animate-bounce">
          <span className="text-3xl">🔄</span>
        </div>
        <h2 className="text-xl font-black text-white tracking-wide mb-2 uppercase">
          Rotate Your Device
        </h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          B.E.L.L.A. Dominoes Table requires <span className="text-amber-400 font-bold">Landscape Mode</span> for the best 4-player board experience.
        </p>
      </div>

      {/* Main Playable Area */}
      <div className="relative flex-1 h-full">
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <GameBoardCanvas
            board={board}
            playerCount={seats.length}
            isMagnifying={false}
            pendingAmbiguousTile={pendingTile}
            onResolveAmbiguousEnd={handleResolve}
          />
        </div>

        {opponentsAroundTable.map((seat) => {
          if (seat.id.startsWith("empty-")) {
            return (
              <div key={seat.id} className={`absolute ${seat.pos} w-28 h-32 border-2 border-dashed border-slate-700/50 bg-slate-900/30 rounded-2xl flex flex-col items-center justify-center z-10`}>
                <div className="w-10 h-10 rounded-full bg-slate-800/50 mb-2 flex items-center justify-center">
                  <span className="text-xl animate-pulse">⏳</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase text-center tracking-wider whitespace-pre-line">
                  {strings.waitingForPlayer}
                </span>
              </div>
            );
          }

          const base = rosterMap[seat.id] || {
            id: seat.id, name: seat.defaultName, avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${seat.seed}`,
            credits: 0, gamesPlayed: 0, gamesWon: 0, remainingTiles: 7, isTurn: false,
          };
          const liveTileCount = typeof opponentCounts[seat.id] === "number" ? opponentCounts[seat.id] : 7;

          return (
            <PlayerPod
              key={seat.id}
              positionClass={`${seat.pos} z-10`}
              orientation={seat.orient}
              player={{ ...base, remainingTiles: liveTileCount, isTurn: activeTurnPlayerId === seat.id }}
              isRoundOver={Boolean(settlement)}
            />
          );
        })}

        {myPlayerId && (
          <PlayerPod
            positionClass="bottom-32 left-1/2 -translate-x-1/2 z-10"
            orientation="horizontal"
            isMe={true}
            onAvatarUpdate={handleAvatarUpdate}
            player={{
              id: myPlayerId, name: myName, avatarUrl: myAvatarUrl,
              credits: myBase?.credits ?? 0, gamesPlayed: myBase?.gamesPlayed ?? 0, gamesWon: myBase?.gamesWon ?? 0,
              remainingTiles: myHand.length, isTurn: isMyTurn,
            }}
            isRoundOver={Boolean(settlement)}
          />
        )}

        {isMyTurn && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 animate-bounce">
            <div className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase rounded-full shadow-lg tracking-wider">
              {hasNoMoves ? strings.noMoves : strings.yourTurn}
            </div>
            {hasNoMoves && (
              <button
                onClick={handlePass}
                className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase rounded-full shadow-2xl transition animate-pulse cursor-pointer border-2 border-white"
              >
                <FastForward className="w-4 h-4" />
                <span>{strings.passTurn}</span>
              </button>
            )}
          </div>
        )}

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

      {/* Right Sidebar: Controls + Language Toggle + Chat */}
      <div className="w-48 h-full bg-slate-900/95 border-l border-slate-800/80 backdrop-blur-md flex flex-col shadow-2xl z-50 shrink-0">
        
        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{strings.activeTable}</span>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded border border-slate-700 transition cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              <span>{lang === "en" ? "🇻🇳 VI" : "🇬🇧 EN"}</span>
            </button>
          </div>
          <span className="text-xs font-black text-amber-400 break-words leading-tight text-center">{roomId}</span>
          
          <div className="flex flex-col gap-1.5 mt-1">
            <button
              onClick={handleCopyInvite}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] font-bold text-amber-400 rounded-lg transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className={copied ? "text-emerald-400" : ""}>{copied ? strings.copied : strings.copyLink}</span>
            </button>

            <button
              onClick={handleLeaveTable}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">{strings.leaveTable}</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-black text-amber-400 text-xs tracking-wide">{strings.tableChat}</span>
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-700">
          {chatLog.length === 0 && (
            <div className="text-center text-[10px] text-slate-500 italic mt-6">{strings.noMessages}</div>
          )}
          {chatLog.map((msg, i) => {
            const isMe = msg.sender === myName;
            return (
              <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[9px] text-slate-500 font-bold mb-0.5 ml-1">{msg.sender}</span>
                <div className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold max-w-[95%] break-words shadow-sm ${
                  isMe ? "bg-amber-500 text-slate-950 rounded-br-none" : "bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none"
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
              placeholder={strings.typePlaceholder} 
              className="flex-1 min-w-0 bg-slate-950 border border-slate-700 text-white text-[11px] px-2 py-2 rounded-lg outline-none focus:border-amber-500 transition shadow-inner" 
            />
            <button 
              type="submit" 
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-2 rounded-lg font-bold text-[11px] transition shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0"
            >
              {strings.send}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
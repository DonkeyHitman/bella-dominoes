"use client";
import React, { useRef, useState } from "react";
import { Camera, Info } from "lucide-react";

export interface PlayerProfileSummary {
  id: string;
  name: string;
  avatarUrl: string;
  credits: number;
  gamesPlayed: number;
  gamesWon: number;
  remainingTiles: number;
  isTurn: boolean;
  activeEmoji?: string;
  activeChatBubble?: string;
}

export const PlayerPod: React.FC<{
  player: PlayerProfileSummary;
  positionClass: string;
  orientation?: "horizontal" | "vertical";
  isRoundOver?: boolean;
  isMe?: boolean;
  onAvatarUpdate?: (newUrl: string) => void;
}> = ({ player, positionClass, orientation = "vertical", isRoundOver, isMe, onAvatarUpdate }) => {
  const [showInfo, setShowInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const winRate =
    player.gamesPlayed > 0
      ? ((player.gamesWon / player.gamesPlayed) * 100).toFixed(0)
      : "0";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result && onAvatarUpdate) {
        onAvatarUpdate(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`fixed z-30 flex flex-col items-center ${positionClass}`}>
      {/* Speech Bubbles / Emojis */}
      {player.activeEmoji && (
        <div className="text-4xl animate-bounce mb-1 drop-shadow-md">
          {player.activeEmoji}
        </div>
      )}
      {player.activeChatBubble && (
        <div className="bg-white text-slate-950 text-xs font-bold px-3 py-1 rounded-2xl shadow-xl mb-1 truncate max-w-[150px] border border-slate-300">
          {player.activeChatBubble}
        </div>
      )}

      {/* Main Pod Card */}
      <div
        className={`flex ${
          orientation === "vertical" ? "flex-col items-center" : "flex-row items-center"
        } gap-2.5 p-2.5 rounded-2xl backdrop-blur-md transition-all duration-300 shadow-2xl ${
          player.isTurn
            ? "bg-slate-900/95 border-2 border-emerald-400 ring-4 ring-emerald-500/30 scale-105"
            : "bg-slate-900/85 border border-slate-700/80 hover:border-slate-500"
        }`}
      >
        {/* Avatar + Turn Badge + Upload Trigger for Human Player */}
        <div className="relative group">
          <div
            className={`w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border-2 ${
              player.isTurn ? "border-emerald-400" : "border-slate-600"
            }`}
          >
            <img
              src={player.avatarUrl}
              alt={player.name}
              className="w-full h-full object-cover aspect-square"
            />
          </div>

          {isMe && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition cursor-pointer"
                title="Upload square avatar image"
              >
                <Camera className="w-4 h-4 text-amber-400 mb-0.5" />
                <span className="text-[9px] font-bold">Edit</span>
              </button>
            </>
          )}

          {player.isTurn && !isRoundOver && (
            <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-emerald-500 text-slate-950 font-black text-[9px] uppercase rounded-full shadow animate-pulse">
              Turn
            </span>
          )}
          {isRoundOver && (
            <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] uppercase rounded-full shadow">
              End
            </span>
          )}
          {!isMe && (
            <button
              onClick={() => setShowInfo((p) => !p)}
              className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 flex items-center justify-center border border-slate-900 transition"
            >
              <Info className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Player Name & Bankroll */}
        <div className="text-center min-w-[70px]">
          <p className="text-xs font-bold text-white truncate max-w-[90px]">
            {player.name}
          </p>
          <p
            className={`text-[11px] font-black ${
              player.credits >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {player.credits >= 0 ? `+${player.credits}` : player.credits} Cr
          </p>
        </div>

        {/* Remaining Tiles Display */}
        <div className="flex flex-col items-center gap-1 bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-xl">
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              {isRoundOver ? "Left" : "Tiles"}
            </span>
            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-xs font-black rounded border border-amber-500/30">
              {player.remainingTiles}
            </span>
          </div>

          <div className="flex items-center gap-0.5 pt-0.5">
            {Array.from({ length: Math.min(player.remainingTiles, 7) }).map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-4 rounded-[2px] bg-gradient-to-b from-[#FDFBF7] to-[#DDD7CD] border border-stone-400 shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                title={`${player.remainingTiles} tiles remaining`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Info Popover */}
      {showInfo && (
        <div className="mt-2 bg-slate-950 border border-slate-800 p-3 rounded-xl text-center text-xs w-44 shadow-2xl backdrop-blur-md">
          <p className="font-bold text-white">{player.name}</p>
          <p className="text-slate-400 mt-1">
            {player.gamesPlayed} Played • {winRate}% Win Rate
          </p>
        </div>
      )}
    </div>
  );
};

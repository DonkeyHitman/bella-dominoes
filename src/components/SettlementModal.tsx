"use client";
import React, { useState } from "react";
import { Eye, Trophy } from "lucide-react";
import { PayoutResult } from "../types/game";

export const SettlementModal: React.FC<{
  payout: PayoutResult | null;
  playerNames: Record<string, string>;
  onNextRound: () => void;
}> = ({ payout, playerNames, onNextRound }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!payout) return null;

  const isBlocked = payout.mode === "BLOCKED_GAME";

  if (isMinimized) {
    return (
      <div className="fixed top-6 right-8 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/95 hover:bg-slate-800 text-amber-400 border border-amber-500/50 rounded-2xl shadow-2xl backdrop-blur-md transition-all transform hover:scale-105 active:scale-95"
        >
          <Trophy className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-xs font-black tracking-wide text-white">View Results / Next Round</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4 transition-all">
      <div className="relative max-w-md w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-white text-center">
        {/* Single Clean Inspect Board Button */}
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          title="Inspect Game Board"
        >
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>Inspect Board</span>
        </button>

        <h3 className="text-2xl font-black text-amber-400 mt-2">
          {isBlocked ? "Game Locked / Blocked!" : "Round Over"}
        </h3>
        <p className="text-xs text-slate-300 mt-1 px-4">{payout.summaryText}</p>

        {payout.pipTotals && (
          <div className="mt-3 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <p className="font-bold text-slate-300 mb-1">Remaining Hand Pips at Lock:</p>
            <div className="flex justify-around">
              {Object.entries(payout.pipTotals).map(([pid, pips]) => (
                <div key={pid} className="text-center">
                  <span className="block text-white font-semibold">{playerNames[pid] ?? pid}</span>
                  <span className="text-amber-400 font-bold">{pips} pips</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="my-4 space-y-2">
          {Object.entries(payout.creditChanges).map(([pid, delta]) => (
            <div
              key={pid}
              className="flex justify-between items-center bg-slate-800/90 border border-slate-700/50 px-4 py-2.5 rounded-xl text-sm"
            >
              <span className="font-semibold">{playerNames[pid] ?? pid}</span>
              <span
                className={`font-black ${
                  delta > 0
                    ? "text-emerald-400"
                    : delta < 0
                    ? "text-rose-400"
                    : "text-slate-400"
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} Cr
              </span>
            </div>
          ))}
        </div>

        {/* Single Deal Next Round Button */}
        <button
          onClick={onNextRound}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black rounded-xl shadow-lg transition"
        >
          Deal Next Round
        </button>
      </div>
    </div>
  );
};

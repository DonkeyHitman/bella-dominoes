"use client";
import React, { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";

export const RankingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/players")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const sorted = data.sort((a, b) => b.credits - a.credits || b.gamesWon - a.gamesWon);
            setPlayers(sorted);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="relative max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <Trophy className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-black text-amber-400">Player Rankings & Performance</h2>
        </div>

        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {players.map((p, idx) => {
            const winRate = p.gamesPlayed > 0 ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(0) : "0";
            return (
              <div
                key={p.id}
                className="flex items-center justify-between p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                      idx === 0
                        ? "bg-amber-400 text-slate-950"
                        : idx === 1
                        ? "bg-slate-300 text-slate-950"
                        : idx === 2
                        ? "bg-amber-700 text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-white">{p.name}</p>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700">
                        {p.email}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {p.gamesPlayed} Played • {p.gamesWon} Won ({winRate}%)
                    </p>
                  </div>
                </div>
                <span
                  className={`font-black text-sm ${
                    p.credits >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {p.credits >= 0 ? `+${p.credits}` : p.credits} Pts
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

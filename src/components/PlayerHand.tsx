"use client";
import React from "react";
import { DominoTile as DominoTileType } from "../types/game";
import { DominoTile } from "./DominoTile";
import { FastForward } from "lucide-react";

export const PlayerHand: React.FC<{
  hand: DominoTileType[];
  playableTileIds: Set<string>;
  ambiguousTileIds: Set<string>;
  isMyTurn: boolean;
  playerName: string;
  credits: number;
  onQuickPlayTile: (tile: DominoTileType) => void;
  onPassTurn?: () => void;
  hasPlayableMoves: boolean;
}> = ({
  hand,
  playableTileIds,
  ambiguousTileIds,
  isMyTurn,
  playerName,
  credits,
  onQuickPlayTile,
  onPassTurn,
  hasPlayableMoves,
}) => {
  // Show pass button if it's your turn and you have no playable moves
  const showPassButton = isMyTurn && (!hasPlayableMoves || playableTileIds.size === 0);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
      {/* Turn indicator & Manual Pass Button Banner */}
      {isMyTurn && (
        <div className="mb-2 flex items-center gap-3 animate-bounce">
          <div className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase rounded-full shadow-lg tracking-wider">
            Your Turn — Double-click tile to play
          </div>
          {showPassButton && onPassTurn && (
            <button
              onClick={onPassTurn}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase rounded-full shadow-lg transition animate-pulse cursor-pointer border border-rose-300"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Pass Turn</span>
            </button>
          )}
        </div>
      )}

      {/* Hand Rack Container */}
      <div className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2">
        {hand.map((tile) => {
          const isPlayable = playableTileIds.has(tile.id);
          const isAmbiguous = ambiguousTileIds.has(tile.id);

          return (
            <div
              key={tile.id}
              onClick={() => {
                if (isMyTurn && isPlayable) {
                  onQuickPlayTile(tile);
                }
              }}
              className={`transition-all transform ${
                isMyTurn && isPlayable
                  ? "cursor-pointer hover:-translate-y-2 hover:ring-2 hover:ring-amber-400 rounded-xl"
                  : "opacity-75 cursor-not-allowed"
              } ${isAmbiguous ? "ring-2 ring-cyan-400 animate-pulse" : ""}`}
            >
              <DominoTile tile={tile} orientation="vertical" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

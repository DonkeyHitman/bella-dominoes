"use client";
import React from "react";
import { DominoTile as DominoTileType, PipValue } from "../types/game";

export const PIP_COLORS: Record<PipValue, string> = {
  6: "#EAB308", 5: "#171717", 4: "#2563EB", 3: "#881337", 2: "#16A34A", 1: "#171717", 0: "transparent",
};

const POSITIONS: Record<PipValue, number[]> = {
  0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

const PipHalf: React.FC<{ value: PipValue }> = ({ value }) => (
  <div className="grid grid-cols-3 grid-rows-3 gap-1 p-1.5 w-full h-full place-items-center">
    {Array.from({ length: 9 }).map((_, i) => (
      <span
        key={i}
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: POSITIONS[value].includes(i) ? PIP_COLORS[value] : "transparent" }}
      />
    ))}
  </div>
);

export const DominoTile: React.FC<{
  tile: DominoTileType;
  orientation?: "vertical" | "horizontal";
  isPlayable?: boolean;
  isAmbiguous?: boolean;
  inHand?: boolean;
  onSelect?: (t: DominoTileType) => void;
  onDoubleClick?: (t: DominoTileType) => void;
}> = ({ tile, orientation = "vertical", isPlayable = true, isAmbiguous = false, inHand = false, onSelect, onDoubleClick }) => {
  const isVert = orientation === "vertical";
  return (
    <div
      onClick={() => isPlayable && onSelect?.(tile)}
      onDoubleClick={() => isPlayable && onDoubleClick?.(tile)}
      style={{
        opacity: inHand && !isPlayable ? 0.45 : 1,
        filter: inHand && !isPlayable ? "grayscale(100%)" : "none",
        pointerEvents: inHand && !isPlayable ? "none" : "auto",
        transform: inHand ? (isPlayable ? "translateY(-6px)" : "translateY(4px)") : "none",
      }}
      className={`relative select-none rounded-lg bg-[#FDFBF7] border border-stone-300 shadow-[0_4px_8px_rgba(0,0,0,0.45)] transition-all ${
        isVert ? "w-12 h-24 flex flex-col" : "w-24 h-12 flex flex-row"
      } ${inHand && isPlayable ? "cursor-pointer hover:-translate-y-3 ring-2 ring-amber-400" : ""} ${
        isAmbiguous ? "ring-2 ring-cyan-400 animate-pulse" : ""
      }`}
    >
      <div className="flex-1 flex items-center justify-center"><PipHalf value={tile.left} /></div>
      <div className={`relative flex items-center justify-center bg-neutral-700 ${isVert ? "h-[2px] w-full" : "w-[2px] h-full"}`}>
        <span className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-300 to-amber-700 border border-amber-900 shadow-sm z-10" />
      </div>
      <div className="flex-1 flex items-center justify-center"><PipHalf value={tile.right} /></div>
    </div>
  );
};
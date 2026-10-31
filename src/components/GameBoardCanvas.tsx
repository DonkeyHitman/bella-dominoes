"use client";
import React from "react";
import { BoardState, DominoTile as DominoTileType } from "../types/game";
import { DominoTile } from "./DominoTile";

export const GameBoardCanvas: React.FC<{
  board: BoardState;
  playerCount: number;
  isMagnifying: boolean;
  pendingAmbiguousTile: DominoTileType | null;
  onResolveAmbiguousEnd: (end: "left" | "right") => void;
}> = ({ board, playerCount, isMagnifying, pendingAmbiguousTile, onResolveAmbiguousEnd }) => {
  const scale = isMagnifying ? 1.35 : board.camera.scale;
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4">
      <div className="relative w-full max-w-[1120px] h-[600px] rounded-[180px] p-5 bg-gradient-to-b from-[#4A1C11] via-[#321109] to-[#240B05] shadow-2xl border-4 border-[#5C2416]">
        <div className="relative w-full h-full rounded-[160px] bg-[radial-gradient(ellipse_at_center,#15803d_0%,#166534_55%,#14532d_100%)] shadow-inner flex items-center justify-center overflow-hidden">
          <div className="pointer-events-none select-none text-center opacity-15 absolute">
            <h2 className="text-4xl font-black tracking-widest text-emerald-100 uppercase">bella-dominoes</h2>
            <p className="text-xs tracking-[0.3em] text-emerald-200 mt-1">4-PLAYER BLOCK CLUB</p>
          </div>

          {/* Root board container centered on the table felt */}
          <div
            style={{
              transform: `scale(${scale}) translate3d(${board.camera.offsetX}px, ${board.camera.offsetY}px, 0)`,
              transformOrigin: "center center",
              transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            className="absolute left-1/2 top-1/2 flex items-center justify-center pointer-events-auto"
          >
            {board.placedTiles.map((pt) => (
              <div
                key={pt.tile.id}
                style={{
                  position: "absolute",
                  left: `${pt.x}px`,
                  top: `${pt.y}px`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <DominoTile
                  tile={pt.tile}
                  orientation={pt.rotation === 0 || pt.rotation === 180 ? "horizontal" : "vertical"}
                />
              </div>
            ))}

            {pendingAmbiguousTile && board.leftEnd && (
              <button
                onClick={() => onResolveAmbiguousEnd("left")}
                style={{
                  position: "absolute",
                  left: `${board.leftEnd.attachX}px`,
                  top: `${board.leftEnd.attachY}px`,
                  transform: "translate(-50%, -50%)",
                }}
                className="w-14 h-14 rounded-full bg-cyan-400/40 border-2 border-cyan-300 animate-ping z-20 cursor-pointer"
              />
            )}
            {pendingAmbiguousTile && board.rightEnd && (
              <button
                onClick={() => onResolveAmbiguousEnd("right")}
                style={{
                  position: "absolute",
                  left: `${board.rightEnd.attachX}px`,
                  top: `${board.rightEnd.attachY}px`,
                  transform: "translate(-50%, -50%)",
                }}
                className="w-14 h-14 rounded-full bg-amber-400/40 border-2 border-amber-300 animate-ping z-20 cursor-pointer"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
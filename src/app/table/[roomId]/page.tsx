"use client";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { User, LogOut, ArrowRightLeft, Play, Trophy, RotateCcw } from "lucide-react";

// Original Color-Coded Pip Palette (6: Yellow, 5: Black, 4: Royal Blue, 3: Burgundy, 2: Green, 1: Black)
const PIP_COLORS: Record<number, string> = {
  6: "bg-amber-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] border border-amber-500/40",
  5: "bg-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]",
  4: "bg-blue-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]",
  3: "bg-rose-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]",
  2: "bg-emerald-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]",
  1: "bg-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]",
  0: "bg-transparent",
};

// 3x3 Grid Matrix for Standard Domino Pip Positions
const PIP_POSITIONS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function PipHalf({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const safeVal = typeof value === "number" && value >= 0 && value <= 6 ? value : 0;
  const activeIndices = PIP_POSITIONS[safeVal] || [];
  const pipColor = PIP_COLORS[safeVal] || PIP_COLORS[1];

  const dotSize =
    size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2";

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-0.5 p-1 w-full h-full place-items-center">
      {Array.from({ length: 9 }).map((_, idx) => (
        <div
          key={idx}
          className={`rounded-full transition-transform ${dotSize} ${
            activeIndices.includes(idx) ? pipColor : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function DominoTileUI({
  tile,
  horizontal = false,
  size = "md",
  onClick,
  disabled = false,
  highlight = false,
}: {
  tile: any;
  horizontal?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  // Support pipA/pipB (from src/types/game.ts) as well as any fallback keys
  const pipA = tile?.pipA ?? tile?.high ?? tile?.left ?? tile?.v1 ?? 0;
  const pipB = tile?.pipB ?? tile?.low ?? tile?.right ?? tile?.v2 ?? 0;

  const dimensions = horizontal
    ? size === "sm"
      ? "w-14 h-7 flex-row"
      : size === "lg"
      ? "w-24 h-12 flex-row"
      : "w-20 h-10 flex-row"
    : size === "sm"
    ? "w-7 h-14 flex-col"
    : size === "lg"
    ? "w-14 h-28 flex-col"
    : "w-11 h-22 flex-col";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center justify-between bg-gradient-to-br from-[#fdfbf7] via-[#f5f0e6] to-[#e6dec8] rounded-xl border-2 ${
        highlight
          ? "border-amber-400 ring-2 ring-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.5)] -translate-y-1.5"
          : "border-[#d5cbb4] shadow-[0_5px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.9)]"
      } ${
        !disabled && onClick
          ? "hover:-translate-y-2 hover:border-amber-400 cursor-pointer active:scale-95"
          : "cursor-default"
      } transition-all duration-150 select-none overflow-hidden ${dimensions}`}
    >
      <div className="flex-1 w-full h-full flex items-center justify-center">
        <PipHalf value={pipA} size={size} />
      </div>

      {/* Brass/Dark Center Divider Bar */}
      <div
        className={
          horizontal
            ? "w-[2px] h-4/5 bg-slate-800/75 rounded-full"
            : "h-[2px] w-4/5 bg-slate-800/75 rounded-full"
        }
      />

      <div className="flex-1 w-full h-full flex items-center justify-center">
        <PipHalf value={pipB} size={size} />
      </div>
    </button>
  );
}

export default function GameTable() {
  const params = useParams();
  const roomId = (params?.roomId as string) || "main-club";
  const router = useRouter();

  const [seats, setSeats] = useState([
    { id: "player-a", name: "PLAYER A", email: "", avatar: "" },
    { id: "player-b", name: "PLAYER B", email: "", avatar: "" },
    { id: "player-c", name: "PLAYER C", email: "", avatar: "" },
    { id: "player-d", name: "PLAYER D", email: "", avatar: "" },
  ]);
  const [board, setBoard] = useState<any>(null);
  const [myHand, setMyHand] = useState<any[]>([]);
  const [opponentTileCounts, setOpponentTileCounts] = useState<Record<string, number>>({});
  const [isDealt, setIsDealt] = useState(false);
  const [dealingLocked, setDealingLocked] = useState(false);
  const [activeTurnPlayerId, setActiveTurnPlayerId] = useState<string | null>(null);
  const [mustPlaySixSix, setMustPlaySixSix] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<any>(null);

  const [myEmail, setMyEmail] = useState("");
  const [myName, setMyName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const email = localStorage.getItem("bella_email") || "";
    const name = localStorage.getItem("bella_display_name") || "";
    const avatar = localStorage.getItem("bella_avatar") || "";

    setMyEmail(email);
    setMyName(name);
    setMyAvatar(avatar);

    if (!email) {
      router.push("/");
    }
  }, [router]);

  const currentSeat = seats.find(
    (s) => s.email && myEmail && s.email.toLowerCase().trim() === myEmail.toLowerCase().trim()
  );
  const allSeatsOccupied = seats.every((s) => s.email !== "");

  useEffect(() => {
    if (!myEmail) return;

    const socket = io();
    socketRef.current = socket;

    socket.emit("room:join", { roomId, playerId: myEmail, playerName: myName });

    socket.on("game:state", (data) => {
      if (Array.isArray(data.seats)) setSeats(data.seats);
      if (data.board) setBoard(data.board);
      if (Array.isArray(data.myHand)) setMyHand(data.myHand);
      if (data.opponentTileCounts) setOpponentTileCounts(data.opponentTileCounts);
      if (data.activeTurnPlayerId !== undefined) setActiveTurnPlayerId(data.activeTurnPlayerId);
      if (data.mustPlaySixSix !== undefined) setMustPlaySixSix(data.mustPlaySixSix);
      if (data.isDealt !== undefined) setIsDealt(data.isDealt);
      if (data.dealingLocked !== undefined) setDealingLocked(data.dealingLocked);
    });

    socket.on("game:dealt", (data) => {
      setSettlement(null);
      setIsDealt(true);
      setDealingLocked(true);
      if (Array.isArray(data?.myHand) && data.myHand.length > 0) {
        setMyHand(data.myHand);
      }
      socket.emit("room:join", { roomId, playerId: myEmail, playerName: myName });
    });

    socket.on("game:settled", (payout) => {
      setSettlement(payout);
      setIsDealt(false);
      setDealingLocked(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, myEmail, myName]);

  const handleClaimSeat = (seatName: string) => {
    if (!myEmail) {
      router.push("/");
      return;
    }
    socketRef.current?.emit("seat:claim", {
      roomId,
      seatName,
      email: myEmail,
      avatar: myAvatar,
      name: myName,
    });
  };

  const handleLeaveSeat = () => {
    socketRef.current?.emit("seat:leave", { roomId, email: myEmail });
  };

  const handleDealClick = () => {
    if (dealingLocked || !allSeatsOccupied) return;
    setSettlement(null);
    setDealingLocked(true);
    socketRef.current?.emit("game:deal", { roomId, email: myEmail });
  };

  const handlePlayTile = (tile: any, targetEnd?: "left" | "right" | "root") => {
    if (!isMyTurn) return;
    const isBoardEmpty = !board?.tiles || board.tiles.length === 0;
    const endToPlay = isBoardEmpty ? "root" : targetEnd || "right";

    socketRef.current?.emit("game:playTile", {
      roomId,
      playerId: myEmail,
      tileId: tile.id,
      targetEnd: endToPlay,
    });
    setSelectedTileId(null);
  };

  const handlePassTurn = () => {
    socketRef.current?.emit("game:passTurn", { roomId, playerId: myEmail });
  };

  const isMyTurn =
    Boolean(activeTurnPlayerId) &&
    Boolean(myEmail) &&
    activeTurnPlayerId!.toLowerCase().trim() === myEmail.toLowerCase().trim();

  // Rotate seats relative to viewer so viewer's claimed seat is always at the BOTTOM (South),
  // and the other 3 seats sit at Right (East), Top (North), and Left (West) around the casino felt table.
  const mySeatIndex = seats.findIndex(
    (s) => s.email && myEmail && s.email.toLowerCase().trim() === myEmail.toLowerCase().trim()
  );
  const baseIdx = mySeatIndex !== -1 ? mySeatIndex : 0;

  const bottomSeat = seats[baseIdx];
  const rightSeat = seats[(baseIdx + 1) % 4];
  const topSeat = seats[(baseIdx + 2) % 4];
  const leftSeat = seats[(baseIdx + 3) % 4];

  const renderPlayerPod = (seat: typeof seats[0], positionLabel: string) => {
    if (!seat) return null;
    const isMySeat =
      seat.email && myEmail && seat.email.toLowerCase().trim() === myEmail.toLowerCase().trim();
    const isOccupied = seat.email !== "";
    const isTurn =
      activeTurnPlayerId &&
      seat.email &&
      activeTurnPlayerId.toLowerCase().trim() === seat.email.toLowerCase().trim();
    const tileCount = seat.email
      ? opponentTileCounts[seat.email.toLowerCase().trim()] ?? 7
      : 0;

    return (
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${
          isTurn
            ? "bg-amber-950/90 border-amber-400 ring-4 ring-amber-400/30 scale-105"
            : isMySeat
            ? "bg-slate-900/95 border-amber-500/80"
            : isOccupied
            ? "bg-slate-900/90 border-slate-700"
            : "bg-slate-900/75 border-dashed border-emerald-500/60"
        }`}
      >
        {/* Avatar Circle + Tile Count Badge */}
        <div className="relative">
          <div
            className={`w-12 h-12 rounded-full overflow-hidden border-2 flex items-center justify-center bg-slate-800 ${
              isTurn ? "border-amber-400" : isMySeat ? "border-amber-500" : "border-slate-600"
            }`}
          >
            {seat.avatar ? (
              <img src={seat.avatar} alt={seat.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-slate-500" />
            )}
          </div>
          {isOccupied && isDealt && (
            <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow border border-slate-900">
              {tileCount}
            </div>
          )}
        </div>

        {/* Player Info & Seat Controls */}
        <div className="flex flex-col min-w-[110px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {seat.name}
            </span>
            {isTurn && (
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 animate-pulse">
                Turn
              </span>
            )}
          </div>

          <span className="text-xs font-extrabold text-white truncate max-w-[120px]">
            {isOccupied ? seat.email.split("@")[0] : "Open Seat"}
          </span>

          {/* Claim / Switch / Leave Buttons prior to Deal */}
          {!isDealt && (
            <div className="mt-1.5">
              {isMySeat ? (
                <button
                  onClick={handleLeaveSeat}
                  className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-rose-500/30 transition flex items-center justify-center gap-1"
                >
                  <LogOut className="w-3 h-3" /> Leave
                </button>
              ) : !isOccupied ? (
                <button
                  onClick={() => handleClaimSeat(seat.name)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition shadow flex items-center justify-center gap-1"
                >
                  {currentSeat ? (
                    <>
                      <ArrowRightLeft className="w-3 h-3" /> Switch
                    </>
                  ) : (
                    "Claim Seat"
                  )}
                </button>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 uppercase">Occupied</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const boardTiles: any[] = board?.tiles || [];
  const selectedTile = myHand.find((t) => t.id === selectedTileId);

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col justify-between p-3 md:p-5 select-none overflow-hidden">
      {/* Header Bar */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center bg-slate-900/90 border border-slate-800 px-5 py-3 rounded-2xl shadow-lg z-20">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base md:text-lg font-black tracking-wide text-amber-400">
              B.E.L.L.A. Dominoes Club
            </h1>
            <p className="text-[11px] text-slate-400">
              Table: <span className="text-white font-bold">{roomId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDealt && isMyTurn && (
            <button
              onClick={handlePassTurn}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition"
            >
              Pass Turn
            </button>
          )}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            {myAvatar ? (
              <img src={myAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-xs font-bold">{myName || myEmail?.split("@")[0] || "Guest"}</span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="bg-slate-800 hover:bg-slate-700 text-rose-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition"
          >
            Lobby
          </button>
        </div>
      </div>

      {/* Main Casino Arena with 4 Directional Pods Around the Oval Green Felt Table */}
      <div className="relative w-full max-w-6xl mx-auto my-2 flex-1 flex flex-col items-center justify-between gap-3">
        {/* TOP SEAT (North / Partner) */}
        <div className="z-20">{renderPlayerPod(topSeat, "TOP")}</div>

        {/* MIDDLE SECTION: LEFT POD + OVAL CASINO FELT TABLE + RIGHT POD */}
        <div className="w-full flex-1 flex items-center justify-between gap-2 md:gap-4 my-1">
          {/* LEFT SEAT (West) */}
          <div className="z-20 hidden lg:block">{renderPlayerPod(leftSeat, "LEFT")}</div>

          {/* OVAL CASINO GREEN FELT TABLE WITH WOODEN RAIL */}
          <div className="relative flex-1 min-h-[300px] md:min-h-[360px] rounded-[140px] border-[14px] border-[#3d2314] shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_0_50px_rgba(0,0,0,0.75)] bg-[radial-gradient(ellipse_at_center,#1b6b45_0%,#0f4d30_65%,#082e1c_100%)] flex flex-col items-center justify-center p-6 overflow-hidden">
            {/* Inner Gold Pinstripe on Felt */}
            <div className="absolute inset-3 rounded-[125px] border border-amber-300/20 pointer-events-none" />

            {/* Pre-Deal / Waiting Overlay */}
            {!isDealt ? (
              <div className="z-10 flex flex-col items-center text-center max-w-md bg-slate-950/75 backdrop-blur-md border border-emerald-500/30 px-8 py-6 rounded-3xl shadow-2xl">
                {settlement ? (
                  <div className="flex flex-col items-center mb-4">
                    <Trophy className="w-8 h-8 text-amber-400 mb-1" />
                    <h2 className="text-base font-black text-amber-400 uppercase tracking-wider">
                      Round Complete!
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Winner: <span className="font-bold text-white">{settlement.winnerId?.split("@")[0] || "N/A"}</span>
                    </p>
                  </div>
                ) : null}

                {!allSeatsOccupied ? (
                  <>
                    <p className="text-sm font-black uppercase tracking-wider text-emerald-300 mb-1">
                      Waiting for Players ({seats.filter((s) => s.email !== "").length} / 4)
                    </p>
                    <p className="text-xs text-slate-300">
                      Click <span className="text-emerald-400 font-bold">Claim Seat</span> on any open seat around the table.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-3">
                      All 4 Seats Claimed!
                    </p>
                    <button
                      onClick={handleDealClick}
                      disabled={dealingLocked}
                      className="bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-sm uppercase tracking-wider px-8 py-3.5 rounded-2xl shadow-xl transition flex items-center gap-2 active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      {dealingLocked ? "Dealing Tiles..." : "Deal Dominoes"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* Active Dominoes Chain on the Felt */
              <div className="z-10 w-full h-full flex flex-col items-center justify-center">
                {/* Status Banner on Felt */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-black uppercase tracking-widest text-amber-300">
                    {isMyTurn
                      ? mustPlaySixSix
                        ? "Your Turn — Must Play [6|6]"
                        : "Your Turn — Select a Tile Below"
                      : `Waiting on ${activeTurnPlayerId?.split("@")[0] || "Player"}...`}
                  </span>
                </div>

                {/* Played Dominoes Chain */}
                {boardTiles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs font-bold text-emerald-200/70 uppercase tracking-wider">
                      {mustPlaySixSix
                        ? "Round 1 starts with Double-Six [6 | 6]"
                        : "Board is empty — Play the starting tile"}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-wrap gap-1.5 max-w-full px-4 py-3 overflow-x-auto">
                    {boardTiles.map((placed: any, idx: number) => {
                      const tileObj = placed.tile || placed;
                      const isDouble =
                        (tileObj.pipA ?? tileObj.high) === (tileObj.pipB ?? tileObj.low);
                      return (
                        <DominoTileUI
                          key={tileObj.id || idx}
                          tile={tileObj}
                          horizontal={!isDouble}
                          size="sm"
                          disabled
                        />
                      );
                    })}
                  </div>
                )}

                {/* Left / Right End Placement Buttons when user selects a tile in hand */}
                {isMyTurn && selectedTile && boardTiles.length > 0 && (
                  <div className="mt-4 flex items-center gap-4 bg-slate-950/85 px-5 py-2.5 rounded-2xl border border-amber-400/50 shadow-xl">
                    <span className="text-xs font-bold text-slate-300">
                      Play [{selectedTile.pipA}|{selectedTile.pipB}] on:
                    </span>
                    <button
                      onClick={() => handlePlayTile(selectedTile, "left")}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl transition"
                    >
                      Left End ({board?.leftEnd?.openPip ?? ""})
                    </button>
                    <button
                      onClick={() => handlePlayTile(selectedTile, "right")}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase px-3 py-1.5 rounded-xl transition"
                    >
                      Right End ({board?.rightEnd?.openPip ?? ""})
                    </button>
                    <button
                      onClick={() => setSelectedTileId(null)}
                      className="text-xs text-slate-400 hover:text-white font-bold px-2"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SEAT (East) */}
          <div className="z-20 hidden lg:block">{renderPlayerPod(rightSeat, "RIGHT")}</div>
        </div>

        {/* Mobile Row for Left/Right Seats on smaller screens */}
        <div className="w-full flex lg:hidden justify-between gap-2 z-20">
          {renderPlayerPod(leftSeat, "LEFT")}
          {renderPlayerPod(rightSeat, "RIGHT")}
        </div>

        {/* BOTTOM SEAT (South / Viewer) */}
        <div className="z-20">{renderPlayerPod(bottomSeat, "BOTTOM")}</div>
      </div>

      {/* Bottom Player Hand Rack with Glossy Ivory Color-Coded Domino Tiles */}
      <div className="w-full max-w-4xl mx-auto bg-slate-900/95 border border-slate-800 rounded-3xl px-6 py-4 shadow-2xl flex flex-col items-center z-20">
        <div className="flex items-center justify-between w-full mb-2.5">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Your Hand ({myHand.length} Tiles)
          </span>
          {isMyTurn && (
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              {boardTiles.length === 0
                ? "Click a tile to play on the board"
                : "Click a tile to choose Left or Right end"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 min-h-[92px]">
          {isDealt && myHand.length > 0 ? (
            myHand.map((tile) => {
              const isSelected = selectedTileId === tile.id;
              return (
                <DominoTileUI
                  key={tile.id}
                  tile={tile}
                  horizontal={false}
                  size="md"
                  disabled={!isMyTurn}
                  highlight={isSelected}
                  onClick={() => {
                    if (!isMyTurn) return;
                    if (!boardTiles || boardTiles.length === 0) {
                      handlePlayTile(tile, "root");
                    } else {
                      setSelectedTileId(isSelected ? null : tile.id);
                    }
                  }}
                />
              );
            })
          ) : (
            <p className="text-xs text-slate-500 font-semibold">
              {isDealt ? "Synchronizing tiles..." : "Claim your seat and click Deal Dominoes to begin."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
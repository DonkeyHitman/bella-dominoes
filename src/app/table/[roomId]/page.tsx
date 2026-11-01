"use client";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { User, LogOut, ArrowRightLeft, Play } from "lucide-react";

export default function GameTable() {
  const params = useParams();
  const roomId = params?.roomId as string || "main-club";
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

  const currentSeat = seats.find(s => s.email && myEmail && s.email.toLowerCase() === myEmail.toLowerCase());
  const allSeatsOccupied = seats.every(s => s.email !== "");

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
      if (data.isDealt !== undefined) setIsDealt(data.isDealt);
      if (data.dealingLocked !== undefined) setDealingLocked(data.dealingLocked);
    });

    socket.on("game:dealt", (data) => {
      setIsDealt(true);
      setDealingLocked(true);
      if (Array.isArray(data.myHand)) setMyHand(data.myHand);
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
    socketRef.current?.emit("seat:claim", { roomId, seatName, email: myEmail, avatar: myAvatar, name: myName });
  };

  const handleLeaveSeat = () => {
    socketRef.current?.emit("seat:leave", { roomId, email: myEmail });
  };

  const handleDealClick = () => {
    if (dealingLocked || !allSeatsOccupied) return;
    setDealingLocked(true);
    socketRef.current?.emit("game:deal", { roomId, email: myEmail });
  };

  const handlePlayTile = (tileId: string, targetEnd: "left" | "right" | "root") => {
    socketRef.current?.emit("game:playTile", { roomId, playerId: myEmail, tileId, targetEnd });
  };

  const handlePassTurn = () => {
    socketRef.current?.emit("game:passTurn", { roomId, playerId: myEmail });
  };

  const isMyTurn = activeTurnPlayerId && myEmail && activeTurnPlayerId.toLowerCase() === myEmail.toLowerCase();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 select-none">
      
      {/* Top Bar */}
      <div className="w-full max-w-5xl flex justify-between items-center bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-lg font-black tracking-wide text-amber-400">B.E.L.L.A. Dominoes Table</h1>
          <p className="text-xs text-slate-400">Room: <span className="text-white font-bold">{roomId}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            {myAvatar ? (
              <img src={myAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-xs font-bold">{myName || myEmail || "Guest"}</span>
          </div>
          <button 
            onClick={() => router.push("/")}
            className="bg-slate-800 hover:bg-slate-700 text-rose-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition"
          >
            Lobby
          </button>
        </div>
      </div>

      {/* Main Table Layout */}
      <div className="w-full max-w-5xl my-6 flex flex-col items-center justify-center flex-1 gap-6">
        
        {/* Seats Grid */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4">
          {seats.map((seat) => {
            const isMySeat = seat.email && myEmail && seat.email.toLowerCase() === myEmail.toLowerCase();
            const isOccupied = seat.email !== "";
            const isTurn = activeTurnPlayerId && seat.email && activeTurnItemMatch(activeTurnPlayerId, seat.email);
            const tileCount = seat.email ? opponentTileCounts[seat.email] ?? 0 : 0;

            return (
              <div 
                key={seat.id}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-between transition ${
                  isTurn 
                    ? "bg-amber-500/20 border-amber-400 ring-4 ring-amber-500/40 shadow-xl" 
                    : isMySeat 
                    ? "bg-amber-500/10 border-amber-500 shadow-lg" 
                    : isOccupied 
                    ? "bg-slate-900/80 border-slate-800" 
                    : "bg-slate-900/40 border-slate-700/60 hover:border-emerald-500/60"
                }`}
              >
                <div className="flex justify-between w-full items-center mb-2">
                  <div className="text-[10px] font-black text-slate-300">{seat.name}</div>
                  {isOccupied && isDealt && (
                    <div className="bg-slate-800 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-700">
                      {tileCount} tiles
                    </div>
                  )}
                </div>
                
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden mb-3 shadow-inner">
                  {seat.avatar ? (
                    <img src={seat.avatar} alt="Player" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-600" />
                  )}
                </div>

                <div className="text-center mb-3">
                  <div className="text-xs font-bold truncate max-w-[120px]">
                    {isOccupied && seat.email ? seat.email.split("@")[0] : "Open Seat"}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider mt-0.5">
                    {isMySeat ? (
                      <span className="text-amber-400">Your Seat</span>
                    ) : isOccupied ? (
                      <span className="text-rose-400">Occupied</span>
                    ) : (
                      <span className="text-emerald-400">Available</span>
                    )}
                  </div>
                </div>

                {/* Seat Actions */}
                <div className="w-full">
                  {isMySeat && !isDealt ? (
                    <button 
                      onClick={handleLeaveSeat}
                      className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-black uppercase tracking-wider py-2 rounded-xl border border-rose-500/30 transition flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3 h-3" /> Leave Seat
                    </button>
                  ) : !isOccupied && !isDealt ? (
                    <button 
                      onClick={() => handleClaimSeat(seat.name)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider py-2 rounded-xl transition shadow-md"
                    >
                      Claim Seat
                    </button>
                  ) : currentSeat && !isOccupied && !isDealt ? (
                    <button 
                      onClick={() => handleClaimSeat(seat.name)}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-black uppercase tracking-wider py-2 rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Switch Seat
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Central Game Board Area */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[220px] shadow-2xl">
          {!allSeatsOccupied ? (
            <div className="text-center">
              <p className="text-sm font-bold text-slate-400 mb-1">Waiting for all 4 seats to be filled...</p>
              <p className="text-xs text-slate-500">Current Occupants: {seats.filter(s => s.email !== "").length} / 4</p>
            </div>
          ) : !isDealt ? (
            <div className="flex flex-col items-center">
              <p className="text-sm font-bold text-amber-400 mb-4">All 4 Seats Occupied! Ready to Deal.</p>
              <button
                onClick={handleDealClick}
                disabled={dealingLocked}
                className="bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-wider px-8 py-4 rounded-2xl shadow-xl transition flex items-center gap-2 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" /> {dealingLocked ? "Dealing..." : "Deal Dominoes"}
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <div className="flex justify-between w-full mb-3 items-center px-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  {isMyTurn ? "Your Turn to Play!" : "Game in Progress"}
                </span>
                {isMyTurn && (
                  <button 
                    onClick={handlePassTurn}
                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-3 py-1 rounded-xl text-xs font-bold border border-rose-500/30 transition"
                  >
                    Pass Turn
                  </button>
                )}
              </div>

              {/* Polished Board Container */}
              <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 min-h-[140px] flex items-center justify-center flex-wrap gap-3 shadow-inner overflow-x-auto">
                {board?.tiles && board.tiles.length > 0 ? (
                  board.tiles.map((t: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 hover:border-amber-500/50 px-4 py-3 rounded-2xl shadow-xl flex flex-col items-center justify-center transition transform hover:-translate-y-0.5"
                    >
                      <div className="text-xs font-black text-amber-400 tracking-widest">{t.high}</div>
                      <div className="w-6 h-[1px] bg-slate-700 my-1"></div>
                      <div className="text-xs font-black text-amber-400 tracking-widest">{t.low}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 font-medium">Board is empty. Play the starting tile.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Player's Dealt Hand (Clean Original Styling) */}
        {isDealt && (
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col items-center">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Your Hand</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {myHand && myHand.length > 0 ? (
                myHand.map((tile) => (
                  <button
                    key={tile.id}
                    onClick={() => handlePlayTile(tile.id, "right")}
                    disabled={!isMyTurn}
                    className="bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 hover:border-amber-500 px-5 py-4 rounded-2xl shadow-lg transition flex flex-col items-center justify-center gap-1.5 active:scale-95 group"
                  >
                    <span className="text-sm font-black text-amber-400 group-hover:scale-110 transition">{tile.high}</span>
                    <div className="w-8 h-[1px] bg-slate-700"></div>
                    <span className="text-sm font-black text-amber-400 group-hover:scale-110 transition">{tile.low}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500">No tiles in hand.</p>
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

function activeTurnItemMatch(turnId: string, email: string): boolean {
  return turnId.toLowerCase().trim() === email.toLowerCase().trim();
}
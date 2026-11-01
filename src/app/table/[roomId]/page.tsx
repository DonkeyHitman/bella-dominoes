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
  const [board, setBoard] = useState<any[]>([]);
  const [myHand, setMyHand] = useState<any[]>([]);
  const [isDealt, setIsDealt] = useState(false);
  const [dealingLocked, setDealingLocked] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 select-none">
      
      {/* Top Bar */}
      <div className="w-full max-w-4xl flex justify-between items-center bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg">
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
      <div className="w-full max-w-4xl my-6 flex flex-col items-center justify-center flex-1">
        
        {/* Seat Selection / Display Grid */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {seats.map((seat) => {
            const isMySeat = seat.email && myEmail && seat.email.toLowerCase() === myEmail.toLowerCase();
            const isOccupied = seat.email !== "";

            return (
              <div 
                key={seat.id}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-between transition ${
                  isMySeat 
                    ? "bg-amber-500/10 border-amber-500 shadow-lg ring-2 ring-amber-500/30" 
                    : isOccupied 
                    ? "bg-slate-900/80 border-slate-800" 
                    : "bg-slate-900/40 border-slate-700/60 hover:border-emerald-500/60"
                }`}
              >
                <div className="text-xs font-black text-slate-300 mb-2">{seat.name}</div>
                
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden mb-3">
                  {seat.avatar ? (
                    <img src={seat.avatar} alt="Player" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-slate-600" />
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
                  {isMySeat ? (
                    <button 
                      onClick={handleLeaveSeat}
                      className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-black uppercase tracking-wider py-2 rounded-xl border border-rose-500/30 transition flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3 h-3" /> Leave Seat
                    </button>
                  ) : !isOccupied ? (
                    <button 
                      onClick={() => handleClaimSeat(seat.name)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider py-2 rounded-xl transition shadow-md"
                    >
                      Claim Seat
                    </button>
                  ) : currentSeat ? (
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

        {/* Central Table / Deal Action Area */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[180px]">
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
            <div className="text-center">
              <p className="text-sm font-black text-emerald-400 mb-2">Game in Progress</p>
              <p className="text-xs text-slate-400">Tiles have been dealt to players' hands.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
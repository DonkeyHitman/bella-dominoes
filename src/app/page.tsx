"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, User, CheckCircle2 } from "lucide-react";

export default function SingleTableLobby() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  // Hardcoded seat status tracking for the 4 fixed players
  const [seats, setSeats] = useState([
    { id: "player-a", name: "PLAYER A", email: "caonhavu@gmail.com", avatar: "" },
    { id: "player-b", name: "PLAYER B", email: "", avatar: "" },
    { id: "player-c", name: "PLAYER C", email: "", avatar: "" },
    { id: "player-d", name: "PLAYER D", email: "tracy@example.com", avatar: "" },
  ]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("bella_email");
    const savedSeat = localStorage.getItem("bella_display_name");
    const savedAvatar = localStorage.getItem("bella_avatar");

    if (savedEmail && savedSeat && savedAvatar) {
      setEmail(savedEmail);
      setSelectedSeat(savedSeat);
      setAvatarUrl(savedAvatar);
      setIsRegistered(true);
    }
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      localStorage.setItem("bella_avatar", result);
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !avatarUrl || !selectedSeat) return;

    localStorage.setItem("bella_email", email.trim().toLowerCase());
    localStorage.setItem("bella_display_name", selectedSeat);
    localStorage.setItem("bella_dominoes_player_id", selectedSeat.toLowerCase().replace(/\s+/g, '-'));
    setIsRegistered(true);
  };

  const handleJoinTable = () => {
    router.push("/table/main-club");
  };

  const allSeatsOccupied = seats.every(s => s.email !== "");

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 select-none font-sans text-white">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center border border-amber-500/20 mb-3 shadow-inner">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-black tracking-wide">B.E.L.L.A. Dominoes Club</h1>
          <p className="text-amber-400/80 text-[10px] font-bold tracking-widest uppercase mt-1">Single Active Table Lobby</p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 mb-6">
          
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center mb-2 shadow-inner">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-slate-500" />
              )}
            </div>
            <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold px-4 py-2 rounded-xl border border-slate-700 transition flex items-center gap-2 shadow-sm">
              <Upload className="w-3.5 h-3.5" />
              Upload Photo (Required)
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          {/* Email Input */}
          <div className="mb-4">
            <div className="flex justify-between items-end mb-1.5">
              <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Email Address</label>
              <span className="text-[9px] text-rose-400 uppercase font-bold tracking-wider">Required</span>
            </div>
            <input 
              type="email" 
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl outline-none focus:border-amber-500 transition"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider py-3 rounded-xl shadow-lg transition active:scale-[0.98]"
          >
            {isRegistered ? "Registration Updated" : "Register Credentials"}
          </button>
        </form>

        {/* Select Your Seat Section */}
        <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 mb-6">
          <label className="block text-center text-xs text-slate-300 font-bold tracking-widest uppercase mb-4">Select Your Seat</label>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            {seats.map((seat) => {
              const isSelected = selectedSeat === seat.name;
              const isOccupied = seat.email !== "";

              return (
                <div 
                  key={seat.id}
                  onClick={() => !isOccupied && isRegistered && setSelectedSeat(seat.name)}
                  className={`p-3 rounded-2xl border transition flex flex-col justify-between ${
                    isSelected 
                      ? "bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/30" 
                      : isOccupied 
                      ? "bg-slate-900/40 border-slate-800 opacity-70 cursor-not-allowed" 
                      : "bg-slate-900 border-slate-700 hover:border-emerald-500 cursor-pointer"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-white">{seat.name}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider">
                    {isSelected ? (
                      <span className="text-amber-400">Your Seat</span>
                    ) : isOccupied ? (
                      <span className="text-rose-400">Occupied</span>
                    ) : (
                      <span className="text-emerald-400">Open - Claim</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            Game will begin automatically once all four seats (A, B, C, D) are occupied by registered human players.
          </p>
        </div>

        {/* Join Table Action */}
        <button 
          onClick={handleJoinTable}
          disabled={!isRegistered || !allSeatsOccupied}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-2xl shadow-xl transition"
        >
          {allSeatsOccupied ? "Join Deployed Table" : "Waiting For All 4 Players..."}
        </button>

      </div>
    </div>
  );
}
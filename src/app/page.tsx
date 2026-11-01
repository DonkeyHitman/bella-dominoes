"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, User, ArrowRight } from "lucide-react";

export default function SimplifiedLobby() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("bella_email");
    const savedName = localStorage.getItem("bella_display_name");
    const savedAvatar = localStorage.getItem("bella_avatar");

    if (savedEmail && savedName && savedAvatar) {
      setEmail(savedEmail);
      setDisplayName(savedName);
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
    if (!email.trim() || !displayName.trim() || !avatarUrl) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();

    localStorage.setItem("bella_email", cleanEmail);
    localStorage.setItem("bella_display_name", cleanName);
    localStorage.setItem("bella_dominoes_player_id", cleanName.toLowerCase().replace(/\s+/g, '-'));
    setIsRegistered(true);
  };

  const handleEnterTable = () => {
    router.push("/table/main-club");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 select-none font-sans text-white">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center border border-amber-500/20 mb-3 shadow-inner">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-black tracking-wide">B.E.L.L.A. Dominoes Club</h1>
          <p className="text-amber-400/80 text-[10px] font-bold tracking-widest uppercase mt-1">Player Registration</p>
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
              Upload Avatar Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          {/* Display Name Input */}
          <div className="mb-4">
            <label className="block text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1.5">Display Name</label>
            <input 
              type="text" 
              required
              autoComplete="off"
              placeholder="e.g. John Vu"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1.5">Email Address</label>
            <input 
              type="email" 
              required
              autoComplete="off"
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
            {isRegistered ? "Credentials Updated" : "Save Credentials"}
          </button>
        </form>

        {/* Enter Table Action */}
        <button 
          onClick={handleEnterTable}
          disabled={!isRegistered}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-2xl shadow-xl transition flex items-center justify-center gap-2"
        >
          Enter Dominoes Table <ArrowRight className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}
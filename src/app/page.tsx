"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";

export default function LobbyPage() {
  const router = useRouter();
  
  const [displayName, setDisplayName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  
  const [createTableName, setCreateTableName] = useState("");
  const [joinTableName, setJoinTableName] = useState("");
  const [myTables, setMyTables] = useState<string[]>([]);

  useEffect(() => {
    const savedName = localStorage.getItem("bella_display_name");
    const savedEmail = localStorage.getItem("bella_email");
    const savedId = localStorage.getItem("bella_dominoes_player_id");
    
    if (savedName && savedEmail && savedId) {
      setDisplayName(savedName);
      setEmailAddress(savedEmail);
      setIsRegistered(true);
    }
    
    const savedTables = JSON.parse(localStorage.getItem("bella_my_tables") || "[]");
    setMyTables(savedTables);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !emailAddress.trim()) return;
    
    const cleanName = displayName.trim();
    const cleanEmail = emailAddress.trim().toLowerCase();
    
    const existingId = localStorage.getItem("bella_dominoes_player_id");
    const playerId = existingId || `player-${cleanEmail.replace(/[^a-z0-9]/g, "")}`;

    localStorage.setItem("bella_display_name", cleanName);
    localStorage.setItem("bella_email", cleanEmail);
    localStorage.setItem("bella_dominoes_player_id", playerId);

    try {
      await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playerId, name: cleanName, email: cleanEmail }),
      });
    } catch {
      // Fallback gracefully if /api/players is GET-only
    }

    setIsRegistered(true);
  };

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTableName.trim() || !isRegistered) return;
    
    const newTableId = createTableName.trim().toLowerCase().replace(/\s+/g, '-');
    const updatedTables = myTables.includes(newTableId) ? myTables : [...myTables, newTableId];
    
    setMyTables(updatedTables);
    localStorage.setItem("bella_my_tables", JSON.stringify(updatedTables));
    router.push(`/table/${newTableId}`);
  };

  const handleJoinTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinTableName.trim() || !isRegistered) return;
    
    const targetTableId = joinTableName.trim().toLowerCase().replace(/\s+/g, '-');
    router.push(`/table/${targetTableId}`);
  };

  const handleDeleteTable = (tableId: string) => {
    const updatedTables = myTables.filter(id => id !== tableId);
    setMyTables(updatedTables);
    localStorage.setItem("bella_my_tables", JSON.stringify(updatedTables));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-slate-800/80 rounded-2xl flex items-center justify-center border border-amber-500/20 mb-4 shadow-inner">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">B.E.L.L.A. Dominoes Club</h1>
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">4-Player Block Dominoes Arena</p>
        </div>

        {/* Registration Section */}
        <form onSubmit={handleRegister} className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80 mb-6">
          <div className="mb-4">
            <div className="flex justify-between items-end mb-1.5">
              <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Display Name</label>
              <span className="text-[9px] text-rose-400/80 uppercase font-bold tracking-wider">Required</span>
            </div>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl outline-none focus:border-amber-500 transition"
            />
          </div>
          <div className="mb-5">
            <div className="flex justify-between items-end mb-1.5">
              <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Email Address</label>
              <span className="text-[9px] text-rose-400/80 uppercase font-bold tracking-wider">Required</span>
            </div>
            <input 
              type="email" 
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl outline-none focus:border-amber-500 transition"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider py-3 rounded-xl shadow-lg transition active:scale-[0.98]"
          >
            {isRegistered ? "Profile Updated" : "Register"}
          </button>
        </form>

        {/* Action Sections (Disabled if not registered) */}
        <div className={`transition-opacity duration-300 ${isRegistered ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          
          {/* Create Table */}
          <form onSubmit={handleCreateTable} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 mb-4">
            <label className="block text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-2">Create A Table</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="New Table Name"
                value={createTableName}
                onChange={(e) => setCreateTableName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm px-3 py-2 rounded-xl outline-none focus:border-emerald-500 transition"
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md whitespace-nowrap">
                + Create Custom Table
              </button>
            </div>
          </form>

          {/* Join Table */}
          <form onSubmit={handleJoinTable} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 mb-6">
            <label className="block text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-2">Join An Active Table</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type Table Name"
                value={joinTableName}
                onChange={(e) => setJoinTableName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm px-3 py-2 rounded-xl outline-none focus:border-blue-500 transition"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-2 rounded-xl transition shadow-md whitespace-nowrap">
                Join Table
              </button>
            </div>
          </form>

          {/* My Created Tables */}
          {isRegistered && myTables.length > 0 && (
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
              <label className="block text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-2">My Created Tables</label>
              {myTables.map(tableId => (
                <div key={tableId} className="flex justify-between items-center p-3.5 bg-slate-950 border border-slate-800 rounded-xl mb-2 last:mb-0">
                  <span className="text-amber-400 font-bold text-sm truncate pr-4">{tableId}</span>
                  <button 
                    onClick={() => handleDeleteTable(tableId)} 
                    className="text-rose-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg transition shrink-0"
                    title="Delete Table Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
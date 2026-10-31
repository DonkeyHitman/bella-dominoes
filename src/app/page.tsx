"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, UserCheck, LogIn, PlusCircle, Trash2, Play } from "lucide-react";
import { io } from "socket.io-client";
import { RankingsModal } from "../components/RankingsModal";

export default function LobbyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("caonhavu@gmail.com");
  const [displayName, setDisplayName] = useState("John");
  const [tableId, setTableId] = useState("");
  const [isRankingsOpen, setIsRankingsOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [myTables, setMyTables] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("invite");
    if (inviteCode) {
      setTableId(inviteCode);
    }

    const savedTables = JSON.parse(localStorage.getItem("bella_my_tables") || "[]");
    setMyTables(savedTables);

    const savedId = localStorage.getItem("bella_dominoes_player_id");
    if (savedId) {
      fetch("/api/players")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const found = data.find((p) => p.id === savedId && !p.id.startsWith("bot-"));
            if (found) {
              setEmail(found.email || "caonhavu@gmail.com");
              setDisplayName(found.name || "John");
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleRegisterOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    const userEmail = email.trim() || "caonhavu@gmail.com";
    const name = displayName.trim() || "John";

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, name }),
    });
    const player = await res.json();

    localStorage.setItem("bella_dominoes_player_id", player.id);
    setSuccessMessage("Profile registered successfully!");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCreateTable = async () => {
    const customTable = tableId.trim()
      ? tableId.trim().toLowerCase().replace(/\s+/g, "-")
      : "table-" + Math.random().toString(36).substring(2, 7);

    setTableId(customTable);

    // Save this table as owned by me
    const updatedTables = Array.from(new Set([...myTables, customTable]));
    setMyTables(updatedTables);
    localStorage.setItem("bella_my_tables", JSON.stringify(updatedTables));

    const userEmail = email.trim() || "caonhavu@gmail.com";
    const name = displayName.trim() || "John";

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, name }),
    });
    const player = await res.json();

    localStorage.setItem("bella_dominoes_player_id", player.id);
    router.push(`/table/${customTable}`);
  };

  const handleJoinTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const userEmail = email.trim() || "caonhavu@gmail.com";
    const name = displayName.trim() || "John";

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, name }),
    });
    const player = await res.json();

    localStorage.setItem("bella_dominoes_player_id", player.id);
    const targetTable = tableId.trim() ? tableId.trim().toLowerCase().replace(/\s+/g, "-") : "main-club";
    router.push(`/table/${targetTable}`);
  };

  const handleDeleteTable = (targetTable: string) => {
    const savedId = localStorage.getItem("bella_dominoes_player_id");
    if (savedId) {
      // Temporarily connect to tell the server to wipe out the room
      const tempSocket = io();
      tempSocket.emit("room:destroy", { roomId: targetTable, playerId: savedId });
      setTimeout(() => tempSocket.disconnect(), 1500);
    }

    const updated = myTables.filter(t => t !== targetTable);
    setMyTables(updated);
    localStorage.setItem("bella_my_tables", JSON.stringify(updated));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 select-none relative">
      {tableId && !myTables.includes(tableId) && (
        <div className="absolute top-10 text-emerald-400 font-bold bg-emerald-500/10 px-6 py-2 rounded-full border border-emerald-500/20 animate-pulse">
          You've been invited to table: {tableId}. Register or Join below!
        </div>
      )}

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative mt-8">
        <h1 className="text-3xl font-black text-amber-400 text-center tracking-wide">
          bella-dominoes
        </h1>
        <p className="text-xs text-slate-400 text-center mt-1 mb-6">
          4-Player Live Block Dominoes Club
        </p>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl text-center animate-pulse">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleJoinTable} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              User ID / Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. caonhavu@gmail.com"
              required
              className="w-full p-3 bg-slate-800/90 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm outline-none transition font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Gameplay Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John"
              required
              className="w-full p-3 bg-slate-800/90 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm outline-none transition font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Table Name / Code
            </label>
            <input
              type="text"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              placeholder="e.g. friday-night (leave blank for random)"
              className="w-full p-3 bg-slate-800/90 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm outline-none transition font-semibold"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Max 4 active players per table. Additional players enter a waiting queue.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              type="button"
              onClick={handleRegisterOnly}
              className="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs rounded-xl shadow transition cursor-pointer flex flex-col items-center justify-center gap-1"
            >
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span>Register</span>
            </button>

            <button
              type="button"
              onClick={handleCreateTable}
              className="py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex flex-col items-center justify-center gap-1"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Table</span>
            </button>

            <button
              type="submit"
              className="py-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex flex-col items-center justify-center gap-1"
            >
              <LogIn className="w-4 h-4" />
              <span>Join Table</span>
            </button>
          </div>
        </form>

        {/* Owned Tables List */}
        {myTables.length > 0 && (
          <div className="mt-8 border-t border-slate-800 pt-5">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">My Active Tables</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
              {myTables.map(tId => (
                <div key={tId} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 shadow-inner">
                  <span className="text-sm font-bold text-amber-400 truncate w-32">{tId}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => router.push(`/table/${tId}`)} 
                      className="flex items-center gap-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors font-bold"
                    >
                      <Play className="w-3 h-3" /> Join
                    </button>
                    <button 
                      onClick={() => handleDeleteTable(tId)} 
                      className="flex items-center gap-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg transition-colors font-bold"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <button
            onClick={() => setIsRankingsOpen(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span>View Player Rankings</span>
          </button>
        </div>
      </div>

      <RankingsModal isOpen={isRankingsOpen} onClose={() => setIsRankingsOpen(false)} />
    </main>
  );
}
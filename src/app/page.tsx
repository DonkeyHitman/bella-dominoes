"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Globe, Plus, Users, Play, Trash2, ShieldCheck, Sparkles } from "lucide-react";

const t = {
  en: {
    title: "B.E.L.L.A. Dominoes Club",
    subtitle: "4-Player Block Dominoes Arena",
    registerTitle: "Player Profile Registration",
    nameLabel: "Display Name",
    emailLabel: "Email Address",
    registerBtn: "Register / Update Profile",
    playMainClub: "Play Main Club (with Bots)",
    createTable: "Create Custom Table",
    tableNamePlaceholder: "Table Name (optional)",
    myTables: "My Created Tables",
    noTables: "No custom tables created yet.",
    joinTable: "Join Table",
    destroyTable: "Delete Room",
    langToggle: "🇻🇳 Tiếng Việt",
    successRegistered: "Profile registered successfully!",
    successExisting: "Logged in with existing profile!",
  },
  vi: {
    title: "Câu Lạc Bộ Domino B.E.L.L.A.",
    subtitle: "Đấu Trường Domino 4 Người Chơi",
    registerTitle: "Đăng Ký Hồ Sơ Người Chơi",
    nameLabel: "Tên Hiển Thị",
    emailLabel: "Địa Chỉ Email",
    registerBtn: "Đăng Ký / Cập Nhật Hồ Sơ",
    playMainClub: "Chơi Bàn Chính (với Bot)",
    createTable: "Tạo Bàn Riêng",
    tableNamePlaceholder: "Tên Bàn (tuỳ chọn)",
    myTables: "Bàn Do Bạn Tạo",
    noTables: "Chưa có bàn riêng nào được tạo.",
    joinTable: "Vào Bàn",
    destroyTable: "Xóa Bàn",
    langToggle: "🇬🇧 English",
    successRegistered: "Đăng ký hồ sơ thành công!",
    successExisting: "Đã đăng nhập bằng hồ sơ hiện có!",
  },
};

export default function LobbyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteRoomId = searchParams.get("invite");

  const [lang, setLang] = useState<"en" | "vi">("en");
  const [displayName, setDisplayName] = useState("John");
  const [email, setEmail] = useState("caonhavu@gmail.com");
  const [tableId, setTableId] = useState(inviteRoomId || "");
  const [myTables, setMyTables] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const strings = t[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("bella_lang") as "en" | "vi";
    if (savedLang) setLang(savedLang);

    const savedTables = localStorage.getItem("bella_my_tables");
    if (savedTables) {
      try { setMyTables(JSON.parse(savedTables)); } catch {}
    }
  }, []);

  const toggleLanguage = () => {
    const next = lang === "en" ? "vi" : "en";
    setLang(next);
    localStorage.setItem("bella_lang", next);
  };

  const handleRegisterOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    const userEmail = email.trim() || "caonhavu@gmail.com";
    const name = displayName.trim() || "John";

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, name }),
    });
    
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      if (data.playerId) {
        localStorage.setItem("bella_dominoes_player_id", data.playerId);
        setSuccessMessage(strings.successExisting);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
      return;
    }

    localStorage.setItem("bella_dominoes_player_id", data.id);
    setSuccessMessage(strings.successRegistered);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCreateTable = () => {
    const customTable = tableId.trim()
      ? tableId.trim().toLowerCase().replace(/\s+/g, "-")
      : "table-" + Math.random().toString(36).substring(2, 7);

    setTableId(customTable);
    const updatedTables = Array.from(new Set([...myTables, customTable]));
    setMyTables(updatedTables);
    localStorage.setItem("bella_my_tables", JSON.stringify(updatedTables));
    
    router.push(`/table/${customTable}`);
  };

  const handleDestroyTable = (targetRoomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const socket = (window as any).bellaSocket;
    if (socket) {
      socket.emit("room:destroy", { roomId: targetRoomId, playerId: localStorage.getItem("bella_dominoes_player_id") });
    }
    const updated = myTables.filter(t => t !== targetRoomId);
    setMyTables(updated);
    localStorage.setItem("bella_my_tables", JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none relative">
      
      {/* Language Toggle Header */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl border border-slate-800 shadow-lg transition cursor-pointer"
        >
          <Globe className="w-4 h-4" />
          <span>{strings.langToggle}</span>
        </button>
      </div>

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{strings.title}</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">{strings.subtitle}</p>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center rounded-xl animate-fade-in">
            {successMessage}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleRegisterOnly} className="space-y-4 mb-6">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{strings.nameLabel}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-amber-500 transition shadow-inner"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{strings.emailLabel}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3.5 py-2.5 rounded-xl outline-none focus:border-amber-500 transition shadow-inner"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{strings.registerBtn}</span>
          </button>
        </form>

        <hr className="border-slate-800 my-6" />

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => router.push("/table/main-club")}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{strings.playMainClub}</span>
          </button>

          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              placeholder={strings.tableNamePlaceholder}
              className="flex-1 bg-slate-950 border border-slate-800 text-white text-xs px-3 py-2.5 rounded-xl outline-none focus:border-amber-500 transition shadow-inner"
            />
            <button
              onClick={handleCreateTable}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{strings.createTable}</span>
            </button>
          </div>
        </div>

        {/* My Created Tables Section */}
        {myTables.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{strings.myTables}</h3>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {myTables.map((tName) => (
                <div
                  key={tName}
                  onClick={() => router.push(`/table/${tName}`)}
                  className="flex items-center justify-between p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl cursor-pointer transition group"
                >
                  <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300">{tName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">{strings.joinTable}</span>
                    <button
                      onClick={(e) => handleDestroyTable(tName, e)}
                      title={strings.destroyTable}
                      className="p-1 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
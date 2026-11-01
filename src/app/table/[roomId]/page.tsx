"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Sparkles, ArrowRight, Camera, Check } from "lucide-react";

export default function LobbyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("bella_email") || "";
    const savedName = localStorage.getItem("bella_display_name") || "";
    const savedAvatar = localStorage.getItem("bella_avatar") || "";

    setEmail(savedEmail);
    setDisplayName(savedName);
    setAvatar(savedAvatar);
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 80;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.65);
        setAvatar(compressed);
        localStorage.setItem("bella_avatar", compressed);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) {
      alert("Please enter both your display name and email address.");
      return;
    }

    localStorage.setItem("bella_email", email.trim().toLowerCase());
    localStorage.setItem("bella_display_name", displayName.trim());
    if (avatar) {
      localStorage.setItem("bella_avatar", avatar);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleEnterTable = () => {
    if (!email.trim() || !displayName.trim()) {
      alert("Please enter and save your email and display name first.");
      return;
    }

    // Synchronously commit to localStorage so table page detects email immediately
    localStorage.setItem("bella_email", email.trim().toLowerCase());
    localStorage.setItem("bella_display_name", displayName.trim());
    if (avatar) {
      localStorage.setItem("bella_avatar", avatar);
    }

    router.push("/table/main-club");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
          <Sparkles className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-black tracking-wide text-white text-center mb-1">
          B.E.L.L.A. Dominoes Club
        </h1>
        <p className="text-xs text-amber-400 uppercase tracking-widest font-bold mb-8">
          Player Registration
        </p>

        <form onSubmit={handleSave} className="w-full flex flex-col gap-5">
          <div className="flex flex-col items-center mb-2">
            <div className="relative group w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shadow-md">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-slate-500" />
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition">
                <Camera className="w-6 h-6 text-white mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Upload</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
            <label className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold cursor-pointer transition text-amber-400">
              <Camera className="w-3.5 h-3.5" /> Upload Avatar Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John"
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. caonhavu@gmail.com"
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "Credentials Saved!" : "Save Credentials"}
          </button>
        </form>

        <div className="w-full mt-6 pt-6 border-t border-slate-800">
          <button
            type="button"
            onClick={handleEnterTable}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider py-4 rounded-xl shadow-xl transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            Enter Dominoes Table <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
"use client";
import React, { useState } from "react";
import { Search, Smile, MessageSquare, Send } from "lucide-react";

export const ControlTray: React.FC<{
  onMagnifyChange: (val: boolean) => void;
  onSendEmoji: (emoji: string) => void;
  onSendChat: (msg: string) => void;
  chatLog: Array<{ sender: string; text: string }>;
}> = ({ onMagnifyChange, onSendEmoji, onSendChat, chatLog }) => {
  const [showEmojis, setShowEmojis] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="fixed bottom-5 right-6 z-30 flex items-center gap-3">
      {showEmojis && (
        <div className="absolute bottom-16 right-12 bg-slate-900 border border-slate-700 p-2 rounded-2xl grid grid-cols-4 gap-2">
          {["😃", "😂", "👋", "😢", "😭", "😴", "👍", "😡"].map((e) => (
            <button key={e} onClick={() => { onSendEmoji(e); setShowEmojis(false); }} className="text-2xl hover:scale-125 transition">
              {e}
            </button>
          ))}
        </div>
      )}
      {showChat && (
        <div className="absolute bottom-16 right-0 w-64 h-72 bg-slate-900 border border-slate-700 rounded-2xl flex flex-col p-3 shadow-2xl">
          <div className="flex-1 overflow-y-auto space-y-1 text-xs">
            {chatLog.map((c, i) => (
              <div key={i}><span className="font-bold text-amber-400">{c.sender}: </span><span className="text-white">{c.text}</span></div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Chat..."
              className="flex-1 bg-slate-800 text-white text-xs px-2 py-1 rounded"
            />
            <button
              onClick={() => { if (text.trim()) { onSendChat(text.trim()); setText(""); } }}
              className="p-1.5 bg-emerald-600 rounded text-white"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      <button
        onPointerDown={() => onMagnifyChange(true)}
        onPointerUp={() => onMagnifyChange(false)}
        onPointerLeave={() => onMagnifyChange(false)}
        onContextMenu={(e) => e.preventDefault()}
        className="w-11 h-11 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg select-none touch-none"
      >
        <Search className="w-5 h-5" />
      </button>
      <button onClick={() => setShowEmojis((p) => !p)} className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center">
        <Smile className="w-5 h-5" />
      </button>
      <button onClick={() => setShowChat((p) => !p)} className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center">
        <MessageSquare className="w-5 h-5" />
      </button>
    </div>
  );
};
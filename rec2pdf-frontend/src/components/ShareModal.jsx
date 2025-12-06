import React, { useState } from "react";
import { Mail, XCircle, Sparkles } from "./icons";
import { classNames } from "../utils/classNames";

export default function ShareModal({ isOpen, onClose, onConfirm, loading }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email && !loading) {
      onConfirm(email, message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl ring-1 ring-white/5 scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-5 bg-white/[0.02]">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Mail className="h-5 w-5 text-indigo-400" />
            Condividi Documento
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Input Email */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">
              Email Destinatario
            </label>
            <input
              type="email"
              autoFocus
              required
              placeholder="cliente@azienda.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Input Messaggio */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">
              <span>Messaggio (Opzionale)</span>
              <span className="flex items-center gap-1 text-[10px] text-indigo-400">
                <Sparkles className="h-3 w-3" /> AI Auto-fill se vuoto
              </span>
            </label>
            <textarea
              rows={3}
              placeholder="Aggiungi una nota personale..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/10 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className={classNames(
                "flex-1 rounded-xl py-3 text-sm font-bold text-white transition shadow-lg",
                loading || !email
                  ? "bg-indigo-600/50 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20"
              )}
            >
              {loading ? "Invio in corso..." : "Invia Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
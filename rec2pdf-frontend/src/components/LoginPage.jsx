import React, { useState } from "react";
import supabase from "../supabaseClient";
import { classNames } from "../utils/classNames";
import { Mail } from "./icons";

// --- IMPORTAZIONE ASSET LOCALI ---
import googleLogo from "../assets/logo_google.svg";
import githubLogo from "../assets/logo_github.png";
import mainLogo from "../assets/thinkDOC3.svg";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Link inviato! Controlla la tua email." });
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error(error);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#020408] p-4 text-white relative overflow-hidden">
      
      {/* Effetto Glow di sfondo */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      {/* Card Principale */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#121214] p-8 shadow-2xl z-10">
        
        {/* Header Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img 
            src={mainLogo} 
            alt="ThinkDoc" 
            className="h-14 w-auto object-contain mb-4" 
          />
          <h2 className="text-xl font-bold text-white tracking-tight">
            Bentornato
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Accedi per continuare il tuo lavoro
          </p>
        </div>

        {/* 1. PRIORITY: GOOGLE LOGIN (Full Width, High Contrast) */}
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3.5 text-sm font-bold text-slate-900 shadow-lg transition-all hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99]"
        >
          <img src={googleLogo} alt="Google" className="h-5 w-5" />
          <span>Continua con Google</span>
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">oppure via email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* 2. SECONDARY: MAGIC LINK FORM */}
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="ml-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Indirizzo Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
              <input
                id="email"
                type="email"
                required
                placeholder="nome@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-600 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={classNames(
              "w-full rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.99]",
              loading ? "cursor-not-allowed opacity-70" : ""
            )}
          >
            {loading ? "Invio link in corso..." : "Invia Link di Accesso"}
          </button>
        </form>

        {/* Feedback Message */}
        {message && (
          <div className={classNames(
            "mt-6 rounded-xl p-4 text-center text-xs font-medium border",
            message.type === "error" 
              ? "bg-rose-500/10 text-rose-300 border-rose-500/20" 
              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
          )}>
            {message.text}
          </div>
        )}

        {/* 3. TERTIARY: GITHUB (Subtle) */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => handleOAuth("github")}
            className="flex items-center gap-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <img src={githubLogo} alt="GitHub" className="h-4 w-4 opacity-60" />
            Sei uno sviluppatore? Accedi con GitHub
          </button>
        </div>

        {/* Footer Legal */}
        <div className="mt-6 text-center">
            <p className="text-[10px] text-zinc-700">
                Protected by reCAPTCHA and subject to the Privacy Policy and Terms of Service.
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
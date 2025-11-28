import React, { useState } from "react";
import supabase from "../supabaseClient";
import { classNames } from "../utils/classNames";
import { 
  Sparkles, 
  Mail, 
  Github, 
  Chrome // Usiamo Chrome come icona generica per Google se non hai l'SVG specifico, o un'icona user
} from "./icons"; // Assicurati di avere queste icone o sostituiscile con quelle disponibili
// Se non hai l'icona Google specifica nel set, puoi usare un placeholder o importarla come SVG inline

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
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-[#020b1a] via-[#081d36] to-[#103054] p-4 text-white">
      
      {/* Card Principale con effetto Glassmorphism "Boardroom" */}
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.5)] backdrop-blur-2xl ring-1 ring-white/5">
        
        {/* Header Logo */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 shadow-inner ring-1 ring-white/10">
             {/* Sostituisci con il tuo Logo SVG se disponibile, altrimenti icona generica */}
             <Sparkles className="h-8 w-8 text-indigo-300" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Think<span className="text-indigo-400">Doc</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Intelligence Platform per Knowledge Worker
          </p>
        </div>

        {/* Form Magic Link */}
        <form onSubmit={handleMagicLink} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="ml-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Email Aziendale
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
              <input
                id="email"
                type="email"
                required
                placeholder="nome@azienda.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-600 transition-all focus:border-indigo-500/50 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={classNames(
              "w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]",
              loading 
                ? "cursor-not-allowed bg-zinc-700 text-zinc-400" 
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-900/20"
            )}
          >
            {loading ? "Invio in corso..." : "Invia Magic Link"}
          </button>
        </form>

        {/* Feedback Message */}
        {message && (
          <div className={classNames(
            "mt-4 rounded-lg p-3 text-center text-xs font-medium",
            message.type === "error" ? "bg-rose-500/10 text-rose-300 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
          )}>
            {message.text}
          </div>
        )}

        {/* Divider */}
        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">oppure continua con</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        {/* Social Login */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleOAuth("github")}
            className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-white"
          >
            <Github className="h-5 w-5" /> GitHub
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-white"
          >
            {/* Se non hai l'icona Google, usa Chrome o un placeholder */}
            <span className="font-bold text-white">G</span> Google
          </button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[10px] text-zinc-600">
          Accedendo accetti i <a href="#" className="underline hover:text-zinc-400">Termini di Servizio</a> e la <a href="#" className="underline hover:text-zinc-400">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
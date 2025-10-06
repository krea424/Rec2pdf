import React, { useState } from 'react';
import supabase from '../supabaseClient';
import logo from '../assets/logo.svg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setMessage('Inserisci un\'email valida per ricevere il magic link.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        throw error;
      }

      setMessage('Magic link inviato! Controlla la tua casella di posta.');
      setMessageType('success');
      setEmail('');
    } catch (error) {
      setMessage(error.message || 'Impossibile inviare il magic link.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(error.message || 'Accesso con GitHub fallito.');
      setMessageType('error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-4 text-center">
          <img src={logo} alt="ThinkDoc Logo" className="h-16" />
          <div>
            <h1 className="text-2xl font-semibold">Accedi a ThinkDoc</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Usa il tuo indirizzo email per ricevere un magic link oppure accedi con GitHub.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              messageType === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-200'
                : 'bg-rose-500/10 border border-rose-500/40 text-rose-200'
            }`}
          >
            {message}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleMagicLink}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              placeholder="nome@azienda.com"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg border border-indigo-500/60 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Invio in corso…' : 'Invia magic link'}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <div className="h-px flex-1 bg-zinc-700" />
          oppure
          <div className="h-px flex-1 bg-zinc-700" />
        </div>

        <button
          type="button"
          onClick={handleGithubLogin}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/70 px-4 py-2 text-sm font-medium transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          Accedi con GitHub
        </button>
      </div>
    </div>
  );
}

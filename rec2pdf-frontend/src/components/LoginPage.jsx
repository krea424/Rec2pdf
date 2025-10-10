import React, { useState } from 'react';
import supabase from '../supabaseClient';
import logo from '../assets/logo.svg';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Toast } from './ui/Toast';

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

  const signInWithGoogle = async () => {
    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(error.message || 'Accesso con Google fallito.');
      setMessageType('error');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-surface-950 via-surface-900 to-surface-950 px-4 text-surface-50">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-surface-800 bg-surface-900/80 p-8 shadow-raised">
        <div className="flex flex-col items-center space-y-4 text-center">
          <img src={logo} alt="ThinkDoc Logo" className="h-12" />
          <div>
            <h1 className="text-2xl font-semibold text-surface-25">Accedi a ThinkDoc</h1>
            <p className="mt-1 text-sm text-surface-300">
              Usa il tuo indirizzo email per ricevere un magic link oppure accedi con GitHub.
            </p>
          </div>
        </div>

        {message && (
          <Toast
            tone={messageType === 'success' ? 'success' : 'danger'}
            description={message}
          />
        )}

        <form className="space-y-4" onSubmit={handleMagicLink}>
          <Input
            id="email"
            type="email"
            label="Email"
            value={email}
            placeholder="nome@azienda.com"
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          <Button type="submit" className="w-full" isLoading={loading}>
            {loading ? 'Invio in corso…' : 'Invia magic link'}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-surface-400">
          <div className="h-px flex-1 bg-surface-700/80" />
          oppure
          <div className="h-px flex-1 bg-surface-700/80" />
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleGithubLogin}
          disabled={loading}
        >
          Accedi con GitHub
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          Accedi con Google
        </Button>
      </div>
    </div>
  );
}

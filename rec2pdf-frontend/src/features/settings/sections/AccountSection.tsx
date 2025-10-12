import { AlertCircle, Users } from "../../../components/icons";
import { useAppContext } from "../../../hooks/useAppContext";
import { trackEvent } from "../../../utils/analytics";

const AccountSection = () => {
  const { session, handleLogout } = useAppContext();

  const handleLogoutClick = () => {
    trackEvent("settings.account.logout");
    handleLogout?.();
  };

  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Users className="h-4 w-4" /> Account
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Accesso effettuato come <span className="font-medium text-zinc-100">{session?.user?.email || "utente"}</span>.
        </p>
        <button
          type="button"
          onClick={handleLogoutClick}
          className="mt-3 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900"
        >
          Logout
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
          <AlertCircle className="h-4 w-4" /> Suggerimento sicurezza
        </div>
        <p className="mt-1 leading-relaxed">
          Ricorda di uscire dall'account quando condividi il dispositivo o concludi una sessione di lavoro.
        </p>
      </div>
    </div>
  );
};

export default AccountSection;

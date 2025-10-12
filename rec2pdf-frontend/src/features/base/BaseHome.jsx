import { useMemo } from "react";
import { AlertCircle, CheckCircle2 } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { classNames } from "../../utils/classNames";
import { Toast } from "../../components/ui";
import PipelinePanel from "./PipelinePanel";
import UploadCard from "./UploadCard";

const ErrorBanner = () => {
  const { errorBanner, setErrorBanner } = useAppContext();

  if (!errorBanner) {
    return null;
  }

  return (
    <Toast
      tone="danger"
      title={errorBanner.title}
      description={errorBanner.details}
      className="mt-4"
      action={
        <button
          type="button"
          className="text-xs font-semibold text-white/80 transition hover:text-white"
          onClick={() => setErrorBanner(null)}
        >
          Chiudi
        </button>
      }
    />
  );
};

const ConnectionGuard = () => {
  const { secureOK } = useAppContext();

  if (secureOK) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        <p>
          Per registrare serve HTTPS (o <code className="text-amber-100">localhost</code> durante lo sviluppo).
        </p>
      </div>
    </div>
  );
};

const BaseHome = () => {
  const context = useAppContext();
  const { headerStatus, theme, themes, pipelineComplete, history } = context;
  const latestEntry = history?.[0] || null;

  const completionHint = useMemo(() => {
    if (!pipelineComplete || !latestEntry?.pdfPath) {
      return null;
    }

    const workspaceName = latestEntry?.workspace?.name || latestEntry?.workspace?.client || "Workspace";
    const timestamp = latestEntry?.timestamp
      ? new Date(latestEntry.timestamp).toLocaleString()
      : "appena generato";

    return `PDF pronto da ${workspaceName} · ${timestamp}`;
  }, [latestEntry, pipelineComplete]);

  return (
    <div className="space-y-6">
      <ConnectionGuard />
      <ErrorBanner />

      <section
        className={classNames(
          "rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-[0_30px_120px_-80px_rgba(15,118,110,0.65)] backdrop-blur",
          themes[theme]?.card || "bg-zinc-900/60"
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/60">
              Executive pipeline
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
              Registra-Pubblica-Scarica PDF
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Segui il flusso base: registra o carica una sessione, pubblica con un clic e scarica subito il PDF finale.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/10 px-3 py-1">1. Registra o carica</span>
              <span className="rounded-full border border-white/10 px-3 py-1">2. Pubblica la sessione</span>
              <span className="rounded-full border border-white/10 px-3 py-1">3. Scarica il PDF</span>
            </div>
          </div>
          <div
            className={classNames(
              "flex min-w-[220px] flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white",
              "shadow-[0_20px_60px_-40px_rgba(129,140,248,0.7)]"
            )}
          >
            <div className="flex items-center gap-2">
              <headerStatus.icon className="h-4 w-4" />
              <span className="font-semibold">{headerStatus.text}</span>
            </div>
            {completionHint ? (
              <div className="flex items-start gap-2 text-xs text-white/80">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-300" />
                <span>{completionHint}</span>
              </div>
            ) : (
              <p className="text-xs text-white/70">
                Il pannello segue in tempo reale gli step della pipeline automatizzata.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <UploadCard />
        <PipelinePanel latestEntry={latestEntry} />
      </section>
    </div>
  );
};

export default BaseHome;

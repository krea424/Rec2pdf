import { useMemo } from "react";
import { AlertCircle } from "../../components/icons";
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
  const { theme, themes, pipelineComplete, history, audioBlob, busy } = context;
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

  const journeyStage = useMemo(() => {
    if (pipelineComplete && latestEntry?.pdfPath) {
      return "download";
    }
    if ((audioBlob || busy) && !pipelineComplete) {
      return "publish";
    }
    return "record";
  }, [audioBlob, busy, latestEntry, pipelineComplete]);

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
          {completionHint ? (
            <p className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100">
              {completionHint}
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <UploadCard journeyStage={journeyStage} />
        <PipelinePanel latestEntry={latestEntry} journeyStage={journeyStage} />
      </section>
    </div>
  );
};

export default BaseHome;

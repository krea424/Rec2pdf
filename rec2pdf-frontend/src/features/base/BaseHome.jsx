import { useMemo } from "react";
import { AlertCircle } from "../../components/icons";
import { useAppContext } from "../../hooks/useAppContext";
import { Toast } from "../../components/ui";
import PipelinePanel from "./PipelinePanel";
import UploadCard from "./UploadCard";
import { classNames } from "../../utils/classNames";

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
  const { pipelineComplete, history, audioBlob, busy } = context;
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

  const shouldShowPublishPanel = useMemo(() => {
    if (pipelineComplete || busy) {
      return true;
    }
    if (latestEntry?.pdfPath || latestEntry?.mdPath) {
      return true;
    }
    return Boolean(audioBlob);
  }, [audioBlob, busy, latestEntry, pipelineComplete]);

  return (
    <div className="space-y-6">
      <ConnectionGuard />
      <ErrorBanner />

      {completionHint ? (
        <div className="flex justify-end">
          <p className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100">
            {completionHint}
          </p>
        </div>
      ) : null}

      <section
        className={classNames(
          "grid gap-6",
          shouldShowPublishPanel
            ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
            : "max-w-3xl mx-auto"
        )}
      >
        <UploadCard journeyStage={journeyStage} />
        {shouldShowPublishPanel ? (
          <PipelinePanel latestEntry={latestEntry} journeyStage={journeyStage} />
        ) : null}
      </section>
    </div>
  );
};

export default BaseHome;

import { forwardRef, useMemo } from "react";
import { Mic, Square } from "../../components/icons";
import { classNames } from "../../utils/classNames";

const RecordingToggleButton = forwardRef(
  (
    {
      recording = false,
      onToggle,
      disabled = false,
      journeyStage = "record",
      micStatusLabel,
      className = "",
    },
    ref,
  ) => {
    const state = recording ? "recording" : journeyStage;

    const buttonClass = useMemo(
      () =>
        classNames(
          "relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 py-5 text-lg font-semibold",
          "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
          recording
            ? "bg-rose-500/90 text-white shadow-[0_18px_60px_-30px_rgba(244,63,94,0.9)]"
            : state === "record"
              ? "bg-emerald-400/90 text-slate-950 shadow-[0_20px_60px_-35px_rgba(16,185,129,0.9)] hover:bg-emerald-300"
              : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10",
          state === "download" && !recording ? "opacity-50" : null,
          disabled && "cursor-not-allowed opacity-60",
          className,
        ),
      [className, disabled, recording, state],
    );

    const icon = recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />;
    const label = recording ? "Stop" : "Registra";

    return (
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={buttonClass}
        title={micStatusLabel}
        aria-pressed={recording}
        data-state={recording ? "recording" : "idle"}
      >
        {icon}
        <span>{label}</span>
        <span className="sr-only">{recording ? "Interrompi registrazione" : "Avvia registrazione"}</span>
      </button>
    );
  },
);

RecordingToggleButton.displayName = "RecordingToggleButton";

export default RecordingToggleButton;

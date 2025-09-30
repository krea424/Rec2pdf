import React from "react";

import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, XCircle } from "./icons";

import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, XCircle } from "lucide-react";

import { classNames } from "../utils/classNames";

const statusStyles = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  pending: "border-sky-500/40 bg-sky-500/10 text-sky-200",
};

const statusIcons = {
  success: <CheckCircle2 className="w-4 h-4" />, 
  error: <AlertCircle className="w-4 h-4" />, 
  pending: <Info className="w-4 h-4" />, 
};

function StatusBadge({ status, label }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "success"
          ? "bg-emerald-500/10 text-emerald-300"
          : status === "error"
          ? "bg-rose-500/10 text-rose-300"
          : "bg-sky-500/10 text-sky-200"
      )}
    >
      {statusIcons[status]}
      {label}
    </span>
  );
}

function ActionButton({ action }) {
  const { label, onClick, href, variant = "primary", disabled } = action;
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200",
    subtle: "bg-zinc-900 hover:bg-zinc-800 text-zinc-300",
  };
  const className = classNames(base, variants[variant]);
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} aria-disabled={disabled} onClick={(event) => disabled && event.preventDefault()}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classNames(className, disabled && "opacity-50 cursor-not-allowed")}> 
      {label}
    </button>
  );
}

export default function SetupAssistant({
  isOpen,
  onClose,
  steps,
  currentStep,
  onStepChange,
  onFinish,
}) {
  if (!isOpen || !steps.length) {
    return null;
  }
  const step = steps[currentStep] ?? steps[0];
  const StepIcon = step.icon ?? Info;
  const isLastStep = currentStep === steps.length - 1;
  const canContinue = step.status === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10">
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
              <StepIcon className="h-5 w-5 text-indigo-400" />
              Assistente di configurazione
            </div>
            <p className="text-sm text-zinc-400">Completa i passaggi per iniziare a usare Rec2pdf.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Chiudi assistente"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col md:flex-row">
          <div className="border-b border-zinc-800 md:w-64 md:border-b-0 md:border-r">
            <nav className="flex flex-col">
              {steps.map((item, index) => {
                const Icon = item.icon ?? Info;
                const active = index === currentStep;
                return (
                  <button
                    key={item.key || index}
                    type="button"
                    onClick={() => onStepChange(index)}
                    className={classNames(
                      "flex items-center justify-between gap-3 border-b border-zinc-800/50 px-5 py-4 text-left transition last:border-b-0",
                      active ? "bg-zinc-900/80" : "hover:bg-zinc-900/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={classNames(
                          "flex h-9 w-9 items-center justify-center rounded-full border",
                          item.status === "success"
                            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                            : item.status === "error"
                            ? "border-rose-500/60 bg-rose-500/10 text-rose-300"
                            : "border-zinc-700 bg-zinc-900 text-zinc-400"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-sm font-medium text-zinc-100">{item.title}</div>
                        <div className="text-xs text-zinc-400">{item.subtitle}</div>
                      </div>
                    </div>
                    <StatusBadge status={item.status} label={item.statusLabel} />
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex-1 space-y-4 px-6 py-6">
            <div
              className={classNames(
                "rounded-xl border p-5 text-sm leading-relaxed",
                statusStyles[step.status] || statusStyles.pending
              )}
            >
              <div className="flex items-center gap-2 text-base font-medium">
                {statusIcons[step.status]}
                {step.headline}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {step.body}
              </div>
            </div>
            {step.extra && <div className="space-y-3 text-sm text-zinc-300">{step.extra}</div>}
            {step.actions?.length ? (
              <div className="flex flex-wrap gap-3">
                {step.actions.map((action, index) => (
                  <ActionButton key={index} action={action} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={() => onStepChange(Math.max(0, currentStep - 1))}
            className={classNames(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-zinc-300 transition",
              currentStep === 0 ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-900"
            )}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Indietro
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLastStep && canContinue) {
                onFinish();
              } else {
                onStepChange(Math.min(steps.length - 1, currentStep + 1));
              }
            }}
            className={classNames(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              canContinue ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-zinc-800 text-zinc-400 cursor-not-allowed"
            )}
            disabled={!canContinue}
          >
            {isLastStep ? "Chiudi" : "Avanti"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

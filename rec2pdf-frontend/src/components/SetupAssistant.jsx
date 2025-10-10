import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
} from "lucide-react";
import { classNames } from "../utils/classNames";
import { Badge } from "./ui/Badge";
import { Button, IconButton } from "./ui/Button";

const statusTone = {
  success: "success",
  error: "danger",
  pending: "info",
};

const statusPanel = {
  success: "border-feedback-success/40 bg-feedback-success/10 text-feedback-success",
  error: "border-feedback-danger/40 bg-feedback-danger/10 text-feedback-danger",
  pending: "border-brand-500/40 bg-brand-500/10 text-brand-200",
};

const iconRing = {
  success: "border-feedback-success/50 bg-feedback-success/15 text-feedback-success",
  error: "border-feedback-danger/50 bg-feedback-danger/15 text-feedback-danger",
  pending: "border-brand-400/50 bg-brand-500/10 text-brand-200",
};

const statusIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  pending: Info,
};

const actionVariantMap = {
  primary: "primary",
  secondary: "secondary",
  subtle: "ghost",
};

export default function SetupAssistant({
  isOpen,
  onClose,
  steps,
  currentStep,
  onStepChange,
  onFinish,
  embedded = false,
}) {
  if (!steps.length) {
    return null;
  }

  if (!embedded && !isOpen) {
    return null;
  }
  const step = steps[currentStep] ?? steps[0];
  const StepIcon = step.icon ?? Info;
  const StepStatusIcon = statusIcons[step.status] || statusIcons.pending;
  const isLastStep = currentStep === steps.length - 1;
  const canContinue = step.status === "success";

  const container = (
    <div
      className={classNames(
        "w-full",
        embedded
          ? "rounded-3xl border border-surface-800 bg-surface-900/80 shadow-inset"
          : "max-w-4xl rounded-3xl border border-surface-800 bg-surface-950/95 shadow-raised backdrop-blur"
      )}
    >
      <div className="flex items-center justify-between border-b border-surface-800 px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-surface-25">
            <StepIcon className="h-5 w-5 text-brand-300" />
            Assistente di configurazione
          </div>
          <p className="text-sm text-surface-300">Completa i passaggi per iniziare a usare Rec2pdf.</p>
        </div>
        {onClose && (
          <IconButton
            aria-label="Chiudi assistente"
            onClick={onClose}
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="border-b border-surface-800 md:w-64 md:border-b-0 md:border-r">
          <nav className="flex flex-col">
            {steps.map((item, index) => {
              const Icon = item.icon ?? Info;
              const active = index === currentStep;
              const StatusBadgeIcon = statusIcons[item.status] || statusIcons.pending;
              return (
                <button
                  key={item.key || index}
                  type="button"
                  onClick={() => onStepChange(index)}
                  className={classNames(
                    "flex items-center justify-between gap-3 border-b border-surface-800/40 px-5 py-4 text-left transition last:border-b-0",
                    active ? "bg-surface-900/60" : "hover:bg-surface-900/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={classNames(
                        "flex h-9 w-9 items-center justify-center rounded-full border text-sm",
                        iconRing[item.status] || iconRing.pending
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-surface-25">{item.title}</div>
                      <div className="text-xs text-surface-300">{item.subtitle}</div>
                    </div>
                  </div>
                  <Badge tone={statusTone[item.status]} icon={StatusBadgeIcon}>
                    {item.statusLabel}
                  </Badge>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex-1 space-y-4 px-6 py-6">
          <div
            className={classNames(
              "rounded-2xl border p-5 text-sm leading-relaxed",
              statusPanel[step.status] || statusPanel.pending
            )}
          >
            <div className="flex items-center gap-2 text-base font-medium">
              <StepStatusIcon className="h-4 w-4" />
              {step.headline}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {step.body}
            </div>
          </div>
          {step.extra && <div className="space-y-3 text-sm text-surface-200">{step.extra}</div>}
          {step.actions?.length ? (
            <div className="flex flex-wrap gap-3">
              {step.actions.map((action, index) => {
                const variant = actionVariantMap[action.variant] || "primary";
                return (
                  <Button
                    key={action.key || index}
                    variant={variant}
                    href={action.href}
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-surface-800 px-6 py-4">
        <Button
          variant="ghost"
          onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="text-surface-200"
          leadingIcon={ChevronLeft}
        >
          Indietro
        </Button>
        <Button
          variant={canContinue ? "primary" : "subtle"}
          disabled={!canContinue}
          trailingIcon={ChevronRight}
          onClick={() => {
            if (isLastStep && canContinue) {
              onFinish();
            } else {
              onStepChange(Math.min(steps.length - 1, currentStep + 1));
            }
          }}
        >
          {isLastStep ? "Chiudi" : "Avanti"}
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return container;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10">
      {container}
    </div>
  );
}
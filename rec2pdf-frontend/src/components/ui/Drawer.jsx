import { useEffect } from "react";
import { X } from "lucide-react";
import { classNames } from "../../utils/classNames";
import { IconButton } from "./Button";

const overlayBase = "fixed inset-0 z-50 flex justify-end";

export default function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer = null,
  className = "",
}) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={overlayBase}>
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        onClick={() => onClose?.()}
      />
      <aside
        className={classNames(
          "relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-surface-800 bg-surface-900/95 shadow-raised backdrop-blur",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-surface-800 px-6 py-5">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-surface-25">{title}</h2>
            {description && <p className="mt-1 text-sm text-surface-300">{description}</p>}
          </div>
          <IconButton
            aria-label="Chiudi drawer"
            onClick={() => onClose?.()}
            variant="ghost"
            size="sm"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer ? (
          <div className="border-t border-surface-800 px-6 py-4">{footer}</div>
        ) : null}
      </aside>
    </div>
  );
}


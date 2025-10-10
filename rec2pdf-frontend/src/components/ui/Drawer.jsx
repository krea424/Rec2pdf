import { useEffect } from "react";
import { XCircle } from "lucide-react";
import { classNames } from "../../utils/classNames";

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
          "relative h-full w-full max-w-xl overflow-y-auto border-l border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Chiudi drawer"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-6">
          {children}
        </div>
        {footer && <div className="border-t border-zinc-800 px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}


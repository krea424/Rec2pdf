import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../hooks/useAppContext";
import { classNames } from "../utils/classNames";

const isTextInput = (target) => {
  if (!target || typeof target !== "object") {
    return false;
  }
  const element = target;
  if (element.isContentEditable) {
    return true;
  }
  const tagName = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};

const CommandPalette = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    recording,
    startRecording,
    stopRecording,
    fileInputRef,
    mediaSupported,
    recorderSupported,
    busy,
  } = useAppContext();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = useCallback(
    (path) => {
      if (location.pathname !== path) {
        navigate(path);
      }
    },
    [location.pathname, navigate]
  );

  const toggleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  const triggerUpload = useCallback(() => {
    if (fileInputRef?.current && typeof fileInputRef.current.click === "function") {
      fileInputRef.current.click();
    }
  }, [fileInputRef]);

  const commands = useMemo(() => {
    return [
      {
        id: "record",
        label: recording ? "Stop registrazione" : "Avvia registrazione",
        shortcut: "R",
        disabled: !mediaSupported || !recorderSupported || busy,
        action: toggleRecording,
      },
      {
        id: "upload",
        label: "Carica audio",
        shortcut: "U",
        action: triggerUpload,
      },
      {
        id: "editor",
        label: "Apri Editor",
        shortcut: "E",
        action: () => goTo("/editor"),
      },
      {
        id: "library",
        label: "Apri Library",
        shortcut: "K",
        action: () => goTo("/library"),
      },
      {
        id: "advanced",
        label: "Apri Advanced A",
        shortcut: "A",
        action: () => goTo("/advanced"),
      },
    ];
  }, [
    busy,
    goTo,
    mediaSupported,
    recorderSupported,
    recording,
    toggleRecording,
    triggerUpload,
  ]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
    }
  }, [open]);

  const runCommand = useCallback(
    (command) => {
      if (!command || command.disabled) {
        return;
      }
      command.action?.();
      setOpen(false);
    },
    []
  );

  useEffect(() => {
    const shortcutMap = new Map();
    commands.forEach((command) => {
      shortcutMap.set(command.shortcut.toLowerCase(), command);
    });

    const handleKeydown = (event) => {
      if (!event || typeof event !== "object") {
        return;
      }
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

      if (event.defaultPrevented) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        if (!isTextInput(event.target)) {
          event.preventDefault();
          setOpen((prev) => !prev);
        }
        return;
      }

      if (!open) {
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (key === "arrowdown" || key === "tab") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % commands.length);
        return;
      }

      if (key === "arrowup" || (event.shiftKey && key === "tab")) {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + commands.length) % commands.length);
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        runCommand(commands[activeIndex]);
        return;
      }

      if (shortcutMap.has(key)) {
        const command = shortcutMap.get(key);
        if (command) {
          event.preventDefault();
          runCommand(command);
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [activeIndex, commands, open, runCommand]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950/90 p-4 text-white shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.32em] text-white/60">Command palette</div>
        <ul className="mt-3 space-y-1">
          {commands.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                onClick={() => runCommand(command)}
                disabled={command.disabled}
                className={classNames(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                  index === activeIndex ? "bg-indigo-500/20 text-white" : "bg-white/5 text-white/80 hover:bg-white/10",
                  command.disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <span>{command.label}</span>
                <span className="text-xs font-semibold text-white/50">{command.shortcut}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-white/50">Usa Ctrl/⌘K per aprire o chiudere.</p>
      </div>
    </div>
  );
};

export default CommandPalette;

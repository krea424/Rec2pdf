import { useEffect, useMemo, useState } from "react";
import { Input } from "./ui/Input";

const buildInitialState = (speakers, value) => {
  if (!Array.isArray(speakers) || !speakers.length) {
    return {};
  }
  const initial = {};
  speakers.forEach((label) => {
    const normalizedLabel = typeof label === "string" ? label.trim() : "";
    if (!normalizedLabel) {
      return;
    }
    const currentValue =
      value && typeof value[normalizedLabel] === "string" ? value[normalizedLabel] : "";
    initial[normalizedLabel] = currentValue;
  });
  return initial;
};

const SPEAKER_REGEX = /speaker[_\s-]*(\d+)/i;

const formatFriendlyLabel = (label, fallbackIndex) => {
  if (!label || typeof label !== "string") {
    return `Speaker ${fallbackIndex}`;
  }
  const trimmed = label.trim();
  if (!trimmed) {
    return `Speaker ${fallbackIndex}`;
  }
  const match = trimmed.match(SPEAKER_REGEX);
  if (match) {
    const rawNumber = match[1] || "";
    const stripped = rawNumber.replace(/^0+/, "");
    const number = stripped.length ? stripped : "0";
    return `Speaker ${number}`;
  }
  const humanized = trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return humanized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const SpeakerMapper = ({ speakers = [], value = {}, onMapChange }) => {
  const orderedSpeakers = useMemo(
    () =>
      Array.isArray(speakers)
        ? speakers
            .map((label) => (typeof label === "string" ? label.trim() : ""))
            .filter(Boolean)
        : [],
    [speakers]
  );

  const [internalMap, setInternalMap] = useState(() => buildInitialState(orderedSpeakers, value));

  useEffect(() => {
    setInternalMap(buildInitialState(orderedSpeakers, value));
  }, [orderedSpeakers, value]);

  if (!orderedSpeakers.length) {
    return null;
  }

  const handleChange = (label, nextValue) => {
    const updated = { ...internalMap, [label]: nextValue };
    setInternalMap(updated);
  };

  useEffect(() => {
    onMapChange?.(internalMap);
  }, [internalMap, onMapChange]);

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {orderedSpeakers.map((label, index) => {
        const friendlyLabel = formatFriendlyLabel(label, index + 1);
        const inputValue = internalMap[label] || "";
        return (
          <div
            key={label}
            className="flex flex-col gap-3 rounded-2xl border border-surface-800/80 bg-surface-900/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-surface-400">
              <span className="rounded-full bg-surface-800/80 px-2 py-0.5 text-[11px] font-semibold text-surface-100">
                {friendlyLabel}
              </span>
              <span className="font-mono text-[11px] text-surface-300" title="Etichetta originale diarizzazione">
                {label}
              </span>
            </div>
            <Input
              label="Nome reale"
              value={inputValue}
              onChange={(event) => handleChange(label, event.target.value)}
              placeholder={`Inserisci il nome per ${friendlyLabel.toLowerCase()}`}
              autoComplete="off"
              className="font-medium"
            />
          </div>
        );
      })}
    </div>
  );
};

export default SpeakerMapper;

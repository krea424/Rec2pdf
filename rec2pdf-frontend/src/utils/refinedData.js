const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[object Object]") {
    return "";
  }
  return trimmed;
};

const sanitizeNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const sanitizeHighlightEntry = (entry, index) => {
  if (typeof entry === "string") {
    const text = sanitizeString(entry);
    if (!text) {
      return null;
    }
    return {
      id: `highlight_${index}`,
      title: "",
      detail: text,
    };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  const id = sanitizeString(entry.id || entry.key || entry.slug) || `highlight_${index}`;
  const title = sanitizeString(entry.title || entry.label || entry.heading || entry.name);
  const detail = sanitizeString(entry.detail || entry.description || entry.summary || entry.text);
  const score = sanitizeNumber(
    entry.score ?? entry.value ?? entry.metric ?? entry.weight ?? entry.confidence ?? null,
  );

  if (!title && !detail && score === null) {
    return null;
  }

  const payload = { id };
  if (title) payload.title = title;
  if (detail) payload.detail = detail;
  if (score !== null) payload.score = score;

  return payload;
};

const sanitizeHighlightList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(sanitizeHighlightEntry).filter(Boolean);
};

const sanitizeSectionEntry = (entry, index) => {
  if (typeof entry === "string") {
    const text = sanitizeString(entry);
    if (!text) {
      return null;
    }
    return {
      id: `section_${index}`,
      title: "",
      text,
      highlights: [],
    };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  const id = sanitizeString(entry.id || entry.key || entry.slug) || `section_${index}`;
  const title = sanitizeString(entry.title || entry.heading || entry.label || entry.name);
  const text = sanitizeString(entry.text || entry.summary || entry.content || entry.body);
  const highlights = sanitizeHighlightList(
    entry.highlights || entry.points || entry.items || entry.bullets || entry.notes || [],
  );

  if (!title && !text && !highlights.length) {
    return null;
  }

  const payload = { id };
  if (title) payload.title = title;
  if (text) payload.text = text;
  if (highlights.length) payload.highlights = highlights;

  return payload;
};

const sanitizeSectionList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(sanitizeSectionEntry).filter(Boolean);
};

const sanitizeSegmentEntry = (entry, index) => {
  if (typeof entry === "string") {
    const text = sanitizeString(entry);
    if (!text) {
      return null;
    }
    return {
      id: `segment_${index}`,
      text,
    };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  const text = sanitizeString(
    entry.text || entry.transcript || entry.content || entry.caption || entry.body,
  );
  if (!text) {
    return null;
  }

  const id = sanitizeString(entry.id || entry.key || entry.segmentId) || `segment_${index}`;
  const speaker = sanitizeString(entry.speaker || entry.speakerLabel || entry.speakerName);
  const start = sanitizeNumber(entry.start ?? entry.startTime ?? entry.begin ?? entry.offset);
  const end = sanitizeNumber(entry.end ?? entry.endTime ?? entry.finish ?? entry.to);

  const payload = { id, text };
  if (speaker) payload.speaker = speaker;
  if (start !== null) payload.start = start;
  if (end !== null) payload.end = end;

  return payload;
};

const sanitizeSegmentListFromArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(sanitizeSegmentEntry).filter(Boolean);
};

const sanitizeSegmentList = (input) => {
  const candidates = [
    { key: "segments", value: input?.segments },
    { key: "transcriptSegments", value: input?.transcriptSegments },
    { key: "transcriptionSegments", value: input?.transcriptionSegments },
    { key: "chunks", value: input?.chunks },
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate.value)) {
      continue;
    }
    const sanitized = sanitizeSegmentListFromArray(candidate.value);
    if (sanitized.length) {
      return { list: sanitized };
    }
    if (candidate.value.length > 0) {
      return {
        error: `I segmenti forniti nel campo \"${candidate.key}\" non contengono testo valido.`,
      };
    }
  }

  const textCandidates = [
    sanitizeString(input?.transcription),
    sanitizeString(input?.transcript),
    sanitizeString(input?.text),
    typeof input === "string" ? sanitizeString(input) : "",
  ].filter(Boolean);

  for (const text of textCandidates) {
    const segments = text
      .split(/\r?\n/)
      .map((line, index) => {
        const trimmed = sanitizeString(line);
        if (!trimmed) {
          return null;
        }
        return {
          id: `segment_${index}`,
          text: trimmed,
        };
      })
      .filter(Boolean);
    if (segments.length) {
      return { list: segments };
    }
  }

  return { list: [] };
};

const sanitizeCueCardEntry = (entry, index) => {
  if (typeof entry === "string") {
    const title = sanitizeString(entry);
    if (!title) {
      return null;
    }
    return { key: `cue_${index}`, title };
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  const title = sanitizeString(entry.title || entry.label || entry.name);
  if (!title) {
    return null;
  }

  const key = sanitizeString(entry.key || entry.id || entry.slug || entry.field) || `cue_${index}`;
  const hint = sanitizeString(entry.hint || entry.placeholder || entry.description || entry.example);
  const value = sanitizeString(entry.value || entry.answer || entry.response || entry.text);

  const payload = { key, title };
  if (hint) payload.hint = hint;
  if (value) payload.value = value;

  return payload;
};

const sanitizeCueCardList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(sanitizeCueCardEntry).filter(Boolean);
};

const sanitizeMetadata = (value) => {
  if (!isPlainObject(value)) {
    return null;
  }

  const entries = Object.entries(value).reduce((acc, [key, raw]) => {
    const name = sanitizeString(key);
    if (!name) {
      return acc;
    }
    if (raw === null || raw === undefined) {
      return acc;
    }
    if (isPlainObject(raw)) {
      const nested = sanitizeMetadata(raw);
      if (nested && Object.keys(nested).length) {
        acc[name] = nested;
      }
      return acc;
    }
    if (Array.isArray(raw)) {
      const sanitizedArray = raw
        .map((item) => {
          if (isPlainObject(item)) {
            const nested = sanitizeMetadata(item);
            return nested && Object.keys(nested).length ? nested : null;
          }
          if (typeof item === "string") {
            const text = sanitizeString(item);
            if (!text) {
              return null;
            }
            const numeric = sanitizeNumber(text);
            return numeric !== null ? numeric : text;
          }
          if (typeof item === "number" && Number.isFinite(item)) {
            return item;
          }
          if (typeof item === "boolean") {
            return item;
          }
          if (typeof item === "string") {
            const parsed = sanitizeNumber(item);
            return parsed !== null ? parsed : null;
          }
          return null;
        })
        .filter((item) => {
          if (item === null) {
            return false;
          }
          if (isPlainObject(item)) {
            return Object.keys(item).length > 0;
          }
          return true;
        });
      if (sanitizedArray.length) {
        acc[name] = sanitizedArray;
      }
      return acc;
    }
    if (typeof raw === "string") {
      const text = sanitizeString(raw);
      if (text) {
        const numeric = sanitizeNumber(text);
        acc[name] = numeric !== null ? numeric : text;
      }
      return acc;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      acc[name] = raw;
      return acc;
    }
    if (typeof raw === "boolean") {
      acc[name] = raw;
      return acc;
    }
    const numeric = sanitizeNumber(raw);
    if (numeric !== null) {
      acc[name] = numeric;
    }
    return acc;
  }, {});

  return Object.keys(entries).length ? entries : null;
};

const sanitizeCueCardAnswers = (value) => {
  if (!isPlainObject(value)) {
    return null;
  }
  const payload = Object.entries(value).reduce((acc, [key, raw]) => {
    const name = sanitizeString(key);
    if (!name) {
      return acc;
    }
    const text = sanitizeString(raw);
    if (text) {
      acc[name] = text;
    }
    return acc;
  }, {});
  return Object.keys(payload).length ? payload : null;
};

export const normalizeRefinedDataForUpload = (input) => {
  if (input === null || input === undefined) {
    return { ok: true, value: null };
  }

  if (!isPlainObject(input)) {
    return { ok: false, error: "I dati di raffinazione devono essere un oggetto." };
  }

  const payload = {};

  const summary = sanitizeString(input.summary || input.overview || input.description);
  if (summary) {
    payload.summary = summary;
  }

  const focus = sanitizeString(input.focus);
  if (focus) {
    payload.focus = focus;
  }

  const notes = sanitizeString(input.notes);
  if (notes) {
    payload.notes = notes;
  }

  const highlights = sanitizeHighlightList(
    input.highlights || input.insights || input.bullets || input.points,
  );
  if (highlights.length) {
    payload.highlights = highlights;
  }

  const sections = sanitizeSectionList(input.sections || input.blocks || input.items || []);
  if (sections.length) {
    payload.sections = sections;
  }

  const segmentsResult = sanitizeSegmentList(input);
  if (segmentsResult.error) {
    return { ok: false, error: segmentsResult.error };
  }
  if (segmentsResult.list.length) {
    payload.segments = segmentsResult.list;
  }

  const cueCards = sanitizeCueCardList(input.cueCards || input.cards || []);
  if (Array.isArray(input.cueCards) && input.cueCards.length > 0 && cueCards.length === 0) {
    return {
      ok: false,
      error: "Le cue card fornite non contengono titoli validi.",
    };
  }
  if (cueCards.length) {
    payload.cueCards = cueCards;
  }

  const metadata = sanitizeMetadata(input.metadata);
  if (metadata) {
    payload.metadata = metadata;
  }

  const tokens = sanitizeNumber(input.tokens ?? input.totalTokens ?? input.tokenCount);
  if (tokens !== null) {
    payload.tokens = tokens;
  }

  const source = sanitizeString(input.source || input.provider);
  if (source) {
    payload.source = source;
  }

  const version = sanitizeString(input.version);
  if (version) {
    payload.version = version;
  }

  const cueCardAnswers = sanitizeCueCardAnswers(input.cueCardAnswers);
  if (cueCardAnswers) {
    payload.cueCardAnswers = cueCardAnswers;
  }

  if (Object.keys(payload).length === 0) {
    return { ok: true, value: null };
  }

  return { ok: true, value: payload };
};

export default normalizeRefinedDataForUpload;

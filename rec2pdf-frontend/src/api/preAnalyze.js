const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
export const buildRefinementPreAnalyzePayload = ({ transcription, prompt, workspaceId }) => {
  const sanitizedTranscription = (typeof transcription === 'string' && transcription.trim()) ? transcription.trim() : '';

  const cueCardsSource = (prompt && Array.isArray(prompt.cueCards)) ? prompt.cueCards : [];

  const cueCards = cueCardsSource
    .map((card) => {
      if (!card || typeof card !== 'object') return null;
      const key = card.key || card.id || '';
      const title = card.title || card.label || '';
      const hint = card.hint || card.description || '';
      // Il backend si aspetta solo la struttura, non il valore
      if (!key || !title) return null;
      return { key, title, hint };
    })
    .filter(Boolean);

  const payload = {
    transcription: sanitizedTranscription,
    cueCards,
  };

  if (workspaceId) {
    payload.workspaceId = workspaceId;
  }
  if (prompt && prompt.id) {
    payload.promptId = prompt.id;
  }

  return payload;
};

const normalizeBackendUrl = (url) => {
  if (!isNonEmptyString(url)) {
    return "";
  }
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const sanitizeString = (value) => (isNonEmptyString(value) ? value.trim() : "");

const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => sanitizeString(item))
    .filter(Boolean);
};

const parseHighlightEntry = (entry, index = 0) => {
  if (isNonEmptyString(entry)) {
    const text = entry.trim();
    return text ? { id: `highlight_${index}`, title: "", detail: text, score: null } : null;
  }
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = sanitizeString(entry.id || entry.key) || `highlight_${index}`;
  const title =
    sanitizeString(entry.title || entry.label || entry.heading || entry.name || "") || "";
  const detail =
    sanitizeString(entry.detail || entry.description || entry.summary || entry.text || "") || "";
  const scoreRaw = entry.score ?? entry.value ?? entry.metric;
  const score = Number.isFinite(scoreRaw)
    ? Number(scoreRaw)
    : Number.isFinite(Number(scoreRaw))
    ? Number(scoreRaw)
    : null;

  if (!title && !detail && score === null) {
    return null;
  }

  return { id, title, detail, score };
};

const parseHighlightList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry, index) => parseHighlightEntry(entry, index))
    .filter(Boolean);
};

const parseSectionEntry = (entry, index = 0) => {
  if (isNonEmptyString(entry)) {
    const text = entry.trim();
    return text
      ? { id: `section_${index}`, title: "", text, highlights: [], raw: entry }
      : null;
  }
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const id = sanitizeString(entry.id || entry.key) || `section_${index}`;
  const title =
    sanitizeString(entry.title || entry.heading || entry.label || entry.name || "") || "";
  const text =
    sanitizeString(entry.text || entry.summary || entry.content || entry.body || "") || "";
  const highlights = parseHighlightList(
    entry.highlights || entry.points || entry.items || entry.bullets || [],
  );

  if (!title && !text && !highlights.length) {
    return null;
  }

  return { id, title, text, highlights, raw: entry };
};

const parseSectionList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry, index) => parseSectionEntry(entry, index))
    .filter(Boolean);
};

export const buildPreAnalyzeRequest = (entry = {}, overrides = {}) => {
  const payload = {};

  const addIf = (key, value) => {
    const sanitized = sanitizeString(value);
    if (sanitized) {
      payload[key] = sanitized;
    }
  };

  addIf("mdPath", entry.mdPath);
  addIf("pdfPath", entry.pdfPath);
  addIf("localMdPath", entry.localMdPath);
  addIf("localPdfPath", entry.localPdfPath);
  addIf("title", entry.title || entry.slug);
  addIf("slug", entry.slug);
  addIf("workspaceId", entry.workspaceId || entry?.workspace?.id);
  addIf("projectId", entry.projectId || entry?.workspace?.projectId);

  const tags = sanitizeStringArray(entry.tags);
  if (tags.length) {
    payload.tags = tags;
  }

  const timestamp = sanitizeString(entry.timestamp);
  if (timestamp) {
    payload.timestamp = timestamp;
  }

  const metadata = {};
  if (entry?.workspace && typeof entry.workspace === "object") {
    const workspaceMeta = {
      id: sanitizeString(entry.workspace.id),
      name: sanitizeString(entry.workspace.name),
      client: sanitizeString(entry.workspace.client),
      status: sanitizeString(entry.workspace.status),
      projectId: sanitizeString(entry.workspace.projectId),
      projectName: sanitizeString(entry.workspace.projectName),
    };
    const workspaceMetaClean = Object.fromEntries(
      Object.entries(workspaceMeta).filter(([, value]) => Boolean(value)),
    );
    if (Object.keys(workspaceMetaClean).length) {
      metadata.workspace = workspaceMetaClean;
    }
  }

  if (entry?.prompt && typeof entry.prompt === "object") {
    const promptMeta = {
      id: sanitizeString(entry.prompt.id),
      title: sanitizeString(entry.prompt.title),
      persona: sanitizeString(entry.prompt.persona),
      focus: sanitizeString(entry.prompt.focus),
      tags: sanitizeStringArray(entry.prompt.tags),
    };
    const promptMetaClean = Object.fromEntries(
      Object.entries(promptMeta).filter(([, value]) =>
        Array.isArray(value) ? value.length > 0 : Boolean(value),
      ),
    );
    if (Object.keys(promptMetaClean).length) {
      metadata.prompt = promptMetaClean;
    }
  }

  if (entry?.durationSeconds && Number.isFinite(entry.durationSeconds)) {
    metadata.durationSeconds = Number(entry.durationSeconds);
  }

  if (entry?.completenessScore && Number.isFinite(entry.completenessScore)) {
    metadata.completenessScore = Number(entry.completenessScore);
  }

  const stageCount = Array.isArray(entry?.stageEvents) ? entry.stageEvents.length : 0;
  if (stageCount > 0) {
    metadata.stageEvents = stageCount;
  }

  if (Array.isArray(entry?.structure?.missingSections) && entry.structure.missingSections.length) {
    metadata.missingSections = sanitizeStringArray(entry.structure.missingSections);
  }

  if (Object.keys(metadata).length) {
    payload.metadata = metadata;
  }

  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (typeof value === "string") {
        const sanitized = sanitizeString(value);
        if (sanitized) {
          payload[key] = sanitized;
        }
        return;
      }
      if (Array.isArray(value)) {
        const sanitized = sanitizeStringArray(value);
        if (sanitized.length) {
          payload[key] = sanitized;
        }
        return;
      }
      if (typeof value === "object") {
        payload[key] = value;
        return;
      }
      payload[key] = value;
    });
  }

  return payload;
};

export const parsePreAnalyzeData = (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    return {
      summary: "",
      highlights: [],
      sections: [],
      metadata: {},
      tokens: null,
      raw: payload,
    };
  }

  const summary =
    sanitizeString(payload.summary || payload.overview || payload.message || payload.description) || "";

  const highlights = parseHighlightList(
    payload.highlights || payload.insights || payload.bullets || payload.points || [],
  );

  const sections = parseSectionList(
    payload.sections || payload.blocks || payload.items || payload.analysis || [],
  );

  const metadata =
    payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {};

  const tokensRaw =
    payload.tokens ??
    payload.totalTokens ??
    payload.usage?.tokens ??
    payload.usage?.total_tokens ??
    null;

  const tokens = Number.isFinite(tokensRaw)
    ? Number(tokensRaw)
    : Number.isFinite(Number(tokensRaw))
    ? Number(tokensRaw)
    : null;

  return {
    summary,
    highlights,
    sections,
    metadata,
    tokens,
    raw: payload,
  };
};

export const postPreAnalyze = async ({ backendUrl, fetcher, payload = {} }) => {
  const normalizedBackend = normalizeBackendUrl(backendUrl);
  if (!normalizedBackend) {
    return {
      ok: false,
      status: 0,
      message: "Backend non configurato",
      data: null,
      raw: null,
      skipped: true,
    };
  }

  if (typeof fetcher !== "function") {
    return {
      ok: false,
      status: 0,
      message: "Fetcher non disponibile",
      data: null,
      raw: null,
      skipped: true,
    };
  }

  const targetUrl = `${normalizedBackend}/api/pre-analyze`;
  const bodyPayload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};

  let result;
  try {
    result = await fetcher(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error?.message || "Errore rete durante la pre-analisi",
      data: null,
      raw: null,
      skipped: false,
    };
  }

  if (!result || typeof result !== "object") {
    return {
      ok: false,
      status: 0,
      message: "Risposta non valida dal servizio di pre-analisi",
      data: null,
      raw: result,
      skipped: false,
    };
  }

  if (!result.ok) {
    const message =
      sanitizeString(result.data?.message) ||
      sanitizeString(result.raw) ||
      `HTTP ${result.status || 0}`;
    return {
      ok: false,
      status: result.status || 0,
      message: message || "Pre-analisi non disponibile",
      data: result.data || null,
      raw: result.raw || null,
      skipped: false,
    };
  }

  return {
    ok: true,
    status: result.status || 200,
    message: sanitizeString(result.data?.message) || "",
    data: parsePreAnalyzeData(result.data),
    raw: result.data,
    skipped: false,
  };
};

export { normalizeBackendUrl };

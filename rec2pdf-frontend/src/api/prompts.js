const DEFAULT_PROMPT_COLOR = '#6366f1';

const toArray = (value) => (Array.isArray(value) ? value : []);

const sanitizeStringArray = (value) =>
  toArray(value)
    .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter(Boolean);

const uniqueStrings = (values) => {
  const result = [];
  const seen = new Set();
  values.forEach((value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
};

const clonePlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return { ...value };
};

const parseTimestamp = (value) => {
  if (!value) {
    return { iso: null, ms: null };
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? { iso: null, ms: null } : { iso: value.toISOString(), ms: time };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? { iso: null, ms: null } : { iso: date.toISOString(), ms: time };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { iso: null, ms: null };
    }
    const date = new Date(trimmed);
    const time = date.getTime();
    return Number.isNaN(time) ? { iso: null, ms: null } : { iso: date.toISOString(), ms: time };
  }
  return { iso: null, ms: null };
};

const normalizeCueCards = (value) =>
  toArray(value)
    .map((card, index) => {
      if (!card || typeof card !== 'object') {
        return null;
      }
      const titleRaw = card.title ?? card.label;
      const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
      if (!title) {
        return null;
      }
      const keySource = card.key ?? card.id ?? `cue_${index}`;
      const key = typeof keySource === 'string' ? keySource.trim() : String(keySource || '').trim();
      const hintSource = card.hint ?? card.description ?? '';
      const hint = typeof hintSource === 'string' ? hintSource.trim() : String(hintSource || '').trim();
      return {
        key: key || `cue_${index}`,
        title,
        hint,
      };
    })
    .filter(Boolean);

const normalizeChecklistSections = (value) =>
  sanitizeStringArray(value).map((section) => section.trim()).filter(Boolean);

export const collectPromptIdentifiers = (prompt) => {
  if (!prompt || typeof prompt !== 'object') {
    return [];
  }
  return uniqueStrings([
    prompt.id,
    prompt.legacyId,
    prompt.supabaseId,
    prompt.slug,
  ]);
};

export const matchesPromptIdentifier = (prompt, identifier) => {
  if (!prompt || typeof identifier !== 'string') {
    return false;
  }
  const target = identifier.trim();
  if (!target) {
    return false;
  }
  return collectPromptIdentifiers(prompt).includes(target);
};

export const normalizePromptEntry = (prompt) => {
  if (!prompt || typeof prompt !== 'object') {
    return null;
  }

  const cueCards = normalizeCueCards(prompt.cueCards || prompt.cue_cards);
  const checklistSource = prompt.checklist && typeof prompt.checklist === 'object'
    ? prompt.checklist
    : Array.isArray(prompt.checklist)
      ? { sections: prompt.checklist }
      : {};
  const checklistSections = normalizeChecklistSections(checklistSource.sections || []);

  const rawFocusPrompts = [
    ...sanitizeStringArray(prompt.focusPrompts || prompt.focus_prompts),
    ...sanitizeStringArray(checklistSource.focusPrompts || checklistSource.focus_prompts),
  ];
  const focusPrompts = uniqueStrings(rawFocusPrompts);

  const tags = sanitizeStringArray(prompt.tags);
  const completedCues = sanitizeStringArray(prompt.completedCues);

  const markdownRules = clonePlainObject(prompt.markdownRules || prompt.markdown_rules) || null;
  const pdfRules = clonePlainObject(prompt.pdfRules || prompt.pdf_rules) || null;

  const preferredIdCandidates = uniqueStrings([
    prompt.id,
    prompt.legacyId,
    prompt.supabaseId,
    prompt.slug,
  ]);
  const preferredId = preferredIdCandidates[0] || '';

  const workspaceId = (() => {
    if (typeof prompt.workspaceId === 'string' && prompt.workspaceId.trim()) {
      return prompt.workspaceId.trim();
    }
    if (typeof prompt.workspace_id === 'string' && prompt.workspace_id.trim()) {
      return prompt.workspace_id.trim();
    }
    return null;
  })();

  const { iso: createdAt, ms: createdAtMs } = parseTimestamp(prompt.createdAt || prompt.created_at);
  const { iso: updatedAt, ms: updatedAtMs } = parseTimestamp(prompt.updatedAt || prompt.updated_at);

  const normalizedChecklist = focusPrompts.length
    ? { sections: checklistSections, focusPrompts }
    : { sections: checklistSections };

  const color = typeof prompt.color === 'string' && prompt.color.trim()
    ? prompt.color.trim()
    : DEFAULT_PROMPT_COLOR;

  return {
    id: preferredId,
    legacyId:
      typeof prompt.legacyId === 'string' && prompt.legacyId.trim()
        ? prompt.legacyId.trim()
        : null,
    supabaseId:
      typeof prompt.supabaseId === 'string' && prompt.supabaseId.trim()
        ? prompt.supabaseId.trim()
        : null,
    workspaceId,
    slug: typeof prompt.slug === 'string' ? prompt.slug.trim() : '',
    title: typeof prompt.title === 'string' ? prompt.title : '',
    summary: typeof prompt.summary === 'string' ? prompt.summary.trim() : '',
    description: typeof prompt.description === 'string' ? prompt.description : '',
    persona: typeof prompt.persona === 'string' ? prompt.persona : '',
    color,
    tags,
    cueCards,
    checklist: normalizedChecklist,
    markdownRules,
    pdfRules,
    focusPrompts,
    focus: typeof prompt.focus === 'string' ? prompt.focus : '',
    notes: typeof prompt.notes === 'string' ? prompt.notes : '',
    completedCues,
    builtIn: Boolean(prompt.builtIn),
    favorite: Boolean(prompt.favorite),
    createdAt,
    updatedAt,
    createdAtMs,
    updatedAtMs,
  };
};

export const parsePromptsResponse = (payload) => {
  const source = payload && typeof payload === 'object' ? payload.prompts : null;
  const list = Array.isArray(source) ? source : [];
  const prompts = list
    .map((item) => normalizePromptEntry(item))
    .filter(Boolean);
  return {
    prompts,
    rawPrompts: list,
  };
};

export const parsePromptResponse = (payload) => {
  const target = payload && typeof payload === 'object' && payload.prompt ? payload.prompt : payload;
  const prompt = normalizePromptEntry(target);
  return {
    prompt,
    rawPrompt: target || null,
  };
};

export const findPromptByIdentifier = (prompts, identifier) => {
  if (!Array.isArray(prompts) || prompts.length === 0) {
    return null;
  }
  const target = typeof identifier === 'string' ? identifier.trim() : '';
  if (!target) {
    return null;
  }
  return prompts.find((prompt) => matchesPromptIdentifier(prompt, target)) || null;
};

export const upsertPromptEntry = (prompts, prompt) => {
  const normalizedPrompt = normalizePromptEntry(prompt);
  const base = Array.isArray(prompts) ? prompts : [];
  if (!normalizedPrompt) {
    return [...base];
  }
  const identifiers = new Set(collectPromptIdentifiers(normalizedPrompt));
  const filtered = base.filter((item) => {
    if (!item) return false;
    const itemIds = collectPromptIdentifiers(item);
    return !itemIds.some((id) => identifiers.has(id));
  });
  return [normalizedPrompt, ...filtered];
};

export const removePromptEntry = (prompts, identifier) => {
  const base = Array.isArray(prompts) ? prompts : [];
  const target = typeof identifier === 'string' ? identifier.trim() : '';
  if (!target) {
    return [...base];
  }
  return base.filter((prompt) => !matchesPromptIdentifier(prompt, target));
};

export const buildPromptIndex = (prompts) => {
  const map = new Map();
  if (!Array.isArray(prompts)) {
    return map;
  }
  prompts.forEach((prompt) => {
    if (!prompt || typeof prompt !== 'object') {
      return;
    }
    collectPromptIdentifiers(prompt).forEach((identifier) => {
      if (!map.has(identifier)) {
        map.set(identifier, prompt);
      }
    });
  });
  return map;
};

const { canonicalizeProjectScopeId, sanitizeProjectIdentifier, CONTEXT_SEPARATOR } = require('./services/utils.js');
const { RAGService } = require('./services/ragService');
const { PromptService } = require('./services/promptService');
const promptService = new PromptService();
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const pdfParse = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');
const yaml = require('js-yaml'); // <-- Importato js-yaml
const qs = require('qs');
const { getAIService } = require('./services/aiService');
// ==========================================================
// ==               AGGIUNGI QUESTA RIGA QUI               ==
// ==========================================================
const aiOrchestrator = require('./services/aiOrchestrator');
// ==========================================================

const {
  listProviders: listAiProviders,
  resolveProvider: resolveAiProvider,
  getDefaultProviderMap: getDefaultAiProviderMap,
  sanitizeProviderInput: sanitizeAiProviderInput,
} = require('./services/aiProviders');

// == REFACTORING ASYNC: Costanti job/worker ==
const SUPABASE_JOBS_TABLE = 'jobs';
const WORKER_SECRET = process.env.WORKER_SECRET;

const app = express();
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const HUGGING_FACE_TOKEN = process.env.HUGGING_FACE_TOKEN || '';

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
const ragService = supabase ? new RAGService(supabase) : null;

const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error('Supabase non configurato');
  }
  return supabase;
};

const ensureProfileForUser = async (req) => {
  if (!supabase) {
    return null;
  }

  const userId = typeof req?.user?.id === 'string' ? req.user.id.trim() : '';
  if (!userId) {
    throw new Error('Utente non valido');
  }

  const client = getSupabaseClient();
  const payload = {
    id: userId,
    email: req.user?.email ?? null,
    full_name: req.user?.user_metadata?.full_name ?? null,
  };

  const { error } = await client
    .from('profiles')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: false });
  

  if (error) {
    throw new Error(error.message || 'Impossibile sincronizzare il profilo utente');
  }

  return payload;
};

const VALID_LOGO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.pdf']);
const LOGO_CONTENT_TYPE_MAP = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'],
]);


const CONTEXT_QUERY_MAX_CHARS = 4000;










const resolveProjectScopeIdentifiers = (value) => {
  const sanitized = sanitizeProjectIdentifier(value);
  if (!sanitized) {
    return { canonicalId: '', originalId: '' };
  }
  return {
    canonicalId: canonicalizeProjectScopeId(sanitized),
    originalId: sanitized,
  };
};

const getWorkspaceIdFromRequest = (req = {}) => {
  const bodyId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : '';
  if (bodyId) {
    return bodyId;
  }

  const queryId = typeof req.query?.workspaceId === 'string' ? req.query.workspaceId.trim() : '';
  if (queryId) {
    return queryId;
  }

  const headerIdRaw = req.headers?.['x-workspace-id'] || req.headers?.['x-workspace'];
  const headerId = typeof headerIdRaw === 'string' ? headerIdRaw.trim() : '';
  if (headerId) {
    return headerId;
  }

  return '';
};



const sanitizeProjectName = (value) => sanitizeProjectIdentifier(value);

const sanitizeKnowledgeFileName = (value) => {
  if (Array.isArray(value) && value.length) {
    for (const candidate of value) {
      const sanitized = sanitizeKnowledgeFileName(candidate);
      if (sanitized) {
        return sanitized;
      }
    }
    return '';
  }
  if (value === null || value === undefined) {
    return '';
  }
  const raw = typeof value === 'string' ? value : String(value);
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed.replace(/[\r\n]+/g, ' ').trim();
  const baseName = path.basename(normalized);
  if (!baseName || baseName === '.' || baseName === '..') {
    return '';
  }
  return baseName;
};

const extractAiProviderOverrides = (req = {}) => {
  const body = req && typeof req === 'object' ? req.body || {} : {};
  const query = req && typeof req === 'object' ? req.query || {} : {};
  const headers = req && typeof req === 'object' ? req.headers || {} : {};

  const textOverride =
    sanitizeAiProviderInput(body.aiTextProvider || body.textProvider || query.aiTextProvider || headers['x-ai-text-provider']);
  const embeddingOverride =
    sanitizeAiProviderInput(
      body.aiEmbeddingProvider ||
        body.embeddingProvider ||
        query.aiEmbeddingProvider ||
        headers['x-ai-embedding-provider']
    );

  return {
    text: textOverride,
    embedding: embeddingOverride,
  };
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeRefinedString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[object Object]') {
    return '';
  }
  return trimmed;
};

const sanitizeRefinedNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const toArrayLike = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (isPlainObject(value)) {
    return Object.values(value);
  }
  return [];
};

const coerceRefinedFormValue = (raw) => {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (Array.isArray(raw)) {
    const normalized = raw
      .map((item) => coerceRefinedFormValue(item))
      .filter((item) => item !== undefined);
    if (!normalized.length) {
      return null;
    }
    return normalized.length === 1 ? normalized[0] : normalized;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return raw;
};

const buildRefinedDataFromFormBody = (body) => {
  const entries = Object.entries(body || {}).filter(([key]) =>
    typeof key === 'string' && (key.startsWith('refinedData[') || key.startsWith('refinedData.'))
  );
  if (!entries.length) {
    return { found: false };
  }

  const parts = [];
  entries.forEach(([key, rawValue]) => {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    values.forEach((value) => {
      if (value === undefined) {
        return;
      }
      const text = typeof value === 'string' ? value : String(value ?? '');
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
    });
  });

  if (!parts.length) {
    return { found: true, value: null };
  }

  const parsed = qs.parse(parts.join('&'), {
    allowDots: true,
    depth: 10,
    parameterLimit: 1000,
    arrayLimit: 1000,
  });

  if (Object.prototype.hasOwnProperty.call(parsed, 'refinedData')) {
    return { found: true, value: parsed.refinedData };
  }

  return { found: true, value: null };
};

const extractRefinedDataFromBody = (body) => {
  if (!body || typeof body !== 'object') {
    return { found: false };
  }

  if (Object.prototype.hasOwnProperty.call(body, 'refinedData')) {
    const raw = body.refinedData;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
        return { found: true, value: null };
      }
      try {
        return { found: true, value: JSON.parse(trimmed) };
      } catch (error) {
        return {
          found: true,
          value: trimmed,
          error: error?.message ? `refinedData JSON non valido: ${error.message}` : 'refinedData JSON non valido',
        };
      }
    }
    const normalized = coerceRefinedFormValue(raw);
    return { found: true, value: normalized };
  }

  return buildRefinedDataFromFormBody(body);
};

const sanitizeRefinedHighlightEntry = (entry, index) => {
  if (typeof entry === 'string') {
    const text = sanitizeRefinedString(entry);
    if (!text) {
      return null;
    }
    return { id: `highlight_${index}`, title: '', detail: text };
  }
  if (!isPlainObject(entry)) {
    return null;
  }
  const id = sanitizeRefinedString(entry.id || entry.key || entry.slug) || `highlight_${index}`;
  const title = sanitizeRefinedString(entry.title || entry.label || entry.heading || entry.name);
  const detail = sanitizeRefinedString(entry.detail || entry.description || entry.summary || entry.text);
  const score = sanitizeRefinedNumber(
    entry.score ?? entry.value ?? entry.metric ?? entry.weight ?? entry.confidence ?? null
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

const sanitizeRefinedHighlightList = (value) => {
  const list = toArrayLike(value);
  if (!list.length) {
    return [];
  }
  return list.map(sanitizeRefinedHighlightEntry).filter(Boolean);
};

const sanitizeRefinedSectionEntry = (entry, index) => {
  if (typeof entry === 'string') {
    const text = sanitizeRefinedString(entry);
    if (!text) {
      return null;
    }
    return { id: `section_${index}`, title: '', text, highlights: [] };
  }
  if (!isPlainObject(entry)) {
    return null;
  }
  const id = sanitizeRefinedString(entry.id || entry.key || entry.slug) || `section_${index}`;
  const title = sanitizeRefinedString(entry.title || entry.heading || entry.label || entry.name);
  const text = sanitizeRefinedString(entry.text || entry.summary || entry.content || entry.body);
  const highlights = sanitizeRefinedHighlightList(
    entry.highlights || entry.points || entry.items || entry.bullets || entry.notes || []
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

const sanitizeRefinedSectionList = (value) => {
  const list = toArrayLike(value);
  if (!list.length) {
    return [];
  }
  return list.map(sanitizeRefinedSectionEntry).filter(Boolean);
};

const sanitizeRefinedSegmentEntry = (entry, index) => {
  if (typeof entry === 'string') {
    const text = sanitizeRefinedString(entry);
    if (!text) {
      return null;
    }
    return { id: `segment_${index}`, text };
  }
  if (!isPlainObject(entry)) {
    return null;
  }
  const text = sanitizeRefinedString(
    entry.text || entry.transcript || entry.content || entry.caption || entry.body
  );
  if (!text) {
    return null;
  }
  const id = sanitizeRefinedString(entry.id || entry.key || entry.segmentId) || `segment_${index}`;
  const speaker = sanitizeRefinedString(entry.speaker || entry.speakerLabel || entry.speakerName);
  const start = sanitizeRefinedNumber(entry.start ?? entry.startTime ?? entry.begin ?? entry.offset);
  const end = sanitizeRefinedNumber(entry.end ?? entry.endTime ?? entry.finish ?? entry.to);
  const payload = { id, text };
  if (speaker) payload.speaker = speaker;
  if (start !== null) payload.start = start;
  if (end !== null) payload.end = end;
  return payload;
};

const sanitizeRefinedSegmentListFromArray = (value) => {
  const list = toArrayLike(value);
  if (!list.length) {
    return [];
  }
  return list.map(sanitizeRefinedSegmentEntry).filter(Boolean);
};

const buildRefinedSegments = (input) => {
  const candidates = [
    { key: 'segments', value: input?.segments },
    { key: 'transcriptSegments', value: input?.transcriptSegments },
    { key: 'transcriptionSegments', value: input?.transcriptionSegments },
    { key: 'chunks', value: input?.chunks },
  ];
  for (const candidate of candidates) {
    const normalizedSource = toArrayLike(candidate.value);
    if (!normalizedSource.length) {
      continue;
    }
    const sanitized = sanitizeRefinedSegmentListFromArray(normalizedSource);
    if (sanitized.length) {
      return { list: sanitized };
    }
    if (normalizedSource.length > 0) {
      return {
        error: `I segmenti forniti nel campo "${candidate.key}" non contengono testo valido.`,
      };
    }
  }
  const textCandidates = [
    sanitizeRefinedString(input?.transcription),
    sanitizeRefinedString(input?.transcript),
    sanitizeRefinedString(input?.text),
    typeof input === 'string' ? sanitizeRefinedString(input) : '',
  ].filter(Boolean);
  for (const text of textCandidates) {
    const segments = text
      .split(/\r?\n/)
      .map((line, index) => {
        const trimmed = sanitizeRefinedString(line);
        if (!trimmed) {
          return null;
        }
        return { id: `segment_${index}`, text: trimmed };
      })
      .filter(Boolean);
    if (segments.length) {
      return { list: segments };
    }
  }
  return { list: [] };
};

const sanitizeRefinedCueCardEntry = (entry, index) => {
  if (typeof entry === 'string') {
    const title = sanitizeRefinedString(entry);
    if (!title) {
      return null;
    }
    return { key: `cue_${index}`, title };
  }
  if (!isPlainObject(entry)) {
    return null;
  }
  const title = sanitizeRefinedString(entry.title || entry.label || entry.name);
  if (!title) {
    return null;
  }
  const key =
    sanitizeRefinedString(entry.key || entry.id || entry.slug || entry.field) || `cue_${index}`;
  const hint = sanitizeRefinedString(entry.hint || entry.placeholder || entry.description || entry.example);
  const value = sanitizeRefinedString(entry.value || entry.answer || entry.response || entry.text);
  const payload = { key, title };
  if (hint) payload.hint = hint;
  if (value) payload.value = value;
  return payload;
};

const sanitizeRefinedCueCardList = (value) => {
  const list = toArrayLike(value);
  if (!list.length) {
    return [];
  }
  return list.map(sanitizeRefinedCueCardEntry).filter(Boolean);
};

const sanitizeMultilineString = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[object Object]') {
      return '';
    }
    return trimmed
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => sanitizeMultilineString(item)).filter(Boolean);
    return parts.join('\n');
  }
  if (value && typeof value === 'object') {
    const candidateKeys = [
      'answer',
      'text',
      'value',
      'response',
      'content',
      'summary',
      'description',
      'detail',
      'body',
      'notes',
      'insights',
      'bullets',
      'points',
      'highlights',
    ];
    for (const key of candidateKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const nested = sanitizeMultilineString(value[key]);
        if (nested) {
          return nested;
        }
      }
    }
  }
  return '';
};

const buildSuggestedAnswers = (rawSuggestions, cueCards, anomalies = []) => {
  if (!Array.isArray(cueCards) || cueCards.length === 0) {
    return [];
  }

  const reportAnomaly = (code) => {
    if (Array.isArray(anomalies) && code) {
      anomalies.push(code);
    }
  };

  const keyToIndex = new Map();
  const titleToKey = new Map();
  const normalized = cueCards.map((card, index) => {
    keyToIndex.set(card.key, index);
    titleToKey.set(card.title.toLowerCase(), card.key);
    return { key: card.key, title: card.title, answer: '' };
  });

  if (!Array.isArray(rawSuggestions)) {
    reportAnomaly('suggested_answers_not_array');
  }

  const suggestions = Array.isArray(rawSuggestions) ? rawSuggestions : [];

  suggestions.forEach((entry, index) => {
    const answerText = sanitizeMultilineString(entry);
    const isObjectEntry = entry && typeof entry === 'object' && !Array.isArray(entry);
    let targetKey = '';

    if (isObjectEntry) {
      const keyCandidate = sanitizeRefinedString(
        entry.key ||
          entry.cueKey ||
          entry.cue_key ||
          entry.id ||
          entry.slug ||
          entry.field ||
          entry.name
      );
      if (keyCandidate && keyToIndex.has(keyCandidate)) {
        targetKey = keyCandidate;
      } else {
        const titleCandidate = sanitizeRefinedString(
          entry.title ||
            entry.cueTitle ||
            entry.cue_title ||
            entry.label ||
            entry.heading ||
            entry.prompt
        );
        if (titleCandidate) {
          const normalizedTitleKey = titleToKey.get(titleCandidate.toLowerCase());
          if (normalizedTitleKey) {
            targetKey = normalizedTitleKey;
          }
        }
      }
    }

    if (!targetKey && cueCards[index]) {
      targetKey = cueCards[index].key;
    }

    if (!targetKey && isObjectEntry) {
      const indexCandidate = sanitizeRefinedNumber(entry.index ?? entry.position ?? entry.order);
      if (indexCandidate !== null && cueCards[indexCandidate]) {
        targetKey = cueCards[indexCandidate].key;
      }
    }

    if (!targetKey) {
      reportAnomaly(`unmatched_suggestion_index_${index}`);
      return;
    }

    const targetIndex = keyToIndex.get(targetKey);
    if (typeof targetIndex !== 'number') {
      reportAnomaly(`unknown_cue_key_${targetKey}`);
      return;
    }

    const previous = normalized[targetIndex];
    const normalizedAnswer = answerText;
    if (!normalizedAnswer && previous?.answer) {
      return;
    }

    normalized[targetIndex] = {
      key: cueCards[targetIndex].key,
      title: cueCards[targetIndex].title,
      answer: normalizedAnswer,
    };
  });

  if (suggestions.length && suggestions.length < cueCards.length) {
    const missingKeys = normalized
      .filter((entry) => !entry.answer)
      .map((entry) => entry.key);
    if (missingKeys.length) {
      reportAnomaly(`missing_answers_for_keys:${missingKeys.join(',')}`);
    }
  }

  return normalized;
};

const sanitizeRefinedMetadata = (value) => {
  if (!isPlainObject(value)) {
    return null;
  }
  const entries = Object.entries(value).reduce((acc, [key, raw]) => {
    const name = sanitizeRefinedString(key);
    if (!name) {
      return acc;
    }
    if (raw === null || raw === undefined) {
      return acc;
    }
    if (isPlainObject(raw)) {
      const nested = sanitizeRefinedMetadata(raw);
      if (nested && Object.keys(nested).length) {
        acc[name] = nested;
      }
      return acc;
    }
    if (Array.isArray(raw)) {
      const sanitizedArray = raw
        .map((item) => {
          if (isPlainObject(item)) {
            const nested = sanitizeRefinedMetadata(item);
            return nested && Object.keys(nested).length ? nested : null;
          }
          if (typeof item === 'string') {
            const text = sanitizeRefinedString(item);
            if (!text) {
              return null;
            }
            const numeric = sanitizeRefinedNumber(text);
            return numeric !== null ? numeric : text;
          }
          if (typeof item === 'number' && Number.isFinite(item)) {
            return item;
          }
          if (typeof item === 'boolean') {
            return item;
          }
          if (typeof item === 'string') {
            const parsed = sanitizeRefinedNumber(item);
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
    if (typeof raw === 'string') {
      const text = sanitizeRefinedString(raw);
      if (text) {
        const numeric = sanitizeRefinedNumber(text);
        acc[name] = numeric !== null ? numeric : text;
      }
      return acc;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      acc[name] = raw;
      return acc;
    }
    if (typeof raw === 'boolean') {
      acc[name] = raw;
      return acc;
    }
    const numeric = sanitizeRefinedNumber(raw);
    if (numeric !== null) {
      acc[name] = numeric;
    }
    return acc;
  }, {});
  return Object.keys(entries).length ? entries : null;
};

const sanitizeRefinedCueCardAnswers = (value) => {
  if (!isPlainObject(value)) {
    return null;
  }
  const payload = Object.entries(value).reduce((acc, [key, raw]) => {
    const name = sanitizeRefinedString(key);
    if (!name) {
      return acc;
    }
    const text = sanitizeRefinedString(raw);
    if (text) {
      acc[name] = text;
    }
    return acc;
  }, {});
  return Object.keys(payload).length ? payload : null;
};

const sanitizeRefinedDataInput = (input) => {
  if (input === null || input === undefined) {
    return { ok: true, value: null };
  }
  if (typeof input === 'string') {
    const summary = sanitizeRefinedString(input);
    if (!summary) {
      return { ok: true, value: null };
    }
    return { ok: true, value: { summary } };
  }
  if (!isPlainObject(input)) {
    return { ok: false, error: 'refinedData deve essere un oggetto JSON' };
  }
  const payload = {};
  const summary = sanitizeRefinedString(input.summary || input.overview || input.description);
  if (summary) {
    payload.summary = summary;
  }
  const focus = sanitizeRefinedString(input.focus);
  if (focus) {
    payload.focus = focus;
  }
  const notes = sanitizeRefinedString(input.notes);
  if (notes) {
    payload.notes = notes;
  }
  const highlights = sanitizeRefinedHighlightList(
    input.highlights || input.insights || input.bullets || input.points
  );
  if (highlights.length) {
    payload.highlights = highlights;
  }
  const sections = sanitizeRefinedSectionList(input.sections || input.blocks || input.items || []);
  if (sections.length) {
    payload.sections = sections;
  }
  const segmentsResult = buildRefinedSegments(input);
  if (segmentsResult.error) {
    return { ok: false, error: segmentsResult.error };
  }
  if (segmentsResult.list.length) {
    payload.segments = segmentsResult.list;
  }
  const cueCards = sanitizeRefinedCueCardList(input.cueCards || input.cards || []);
  if (Array.isArray(input.cueCards) && input.cueCards.length > 0 && cueCards.length === 0) {
    return { ok: false, error: 'Le cue card fornite non contengono titoli validi.' };
  }
  if (cueCards.length) {
    payload.cueCards = cueCards;
  }
  const metadata = sanitizeRefinedMetadata(input.metadata);
  if (metadata) {
    payload.metadata = metadata;
  }
  const tokens = sanitizeRefinedNumber(input.tokens ?? input.totalTokens ?? input.tokenCount);
  if (tokens !== null) {
    payload.tokens = tokens;
  }
  const source = sanitizeRefinedString(input.source || input.provider);
  if (source) {
    payload.source = source;
  }
  const version = sanitizeRefinedString(input.version);
  if (version) {
    payload.version = version;
  }
  const cueCardAnswers = sanitizeRefinedCueCardAnswers(input.cueCardAnswers);
  if (cueCardAnswers) {
    payload.cueCardAnswers = cueCardAnswers;
  }
  if (Object.keys(payload).length === 0) {
    return { ok: true, value: null };
  }
  return { ok: true, value: payload };
};

// AGGIUNGI QUESTA NUOVA FUNZIONE IN server.js solo wrapper il resto si trova in ragService.js
const retrieveRelevantContext = async (queryText, workspaceId, options = {}) => {
  if (!ragService) {
    console.warn('⚠️ RAGService non è disponibile (Supabase non configurato?). Impossibile recuperare il contesto.');
    return '';
  }
  // Deleghiamo tutta la logica al metodo corrispondente nel nostro servizio!
  return ragService.retrieveRelevantContext(queryText, workspaceId, options);
};


// DICHIARA QUI LA VARIABILE MANCANTE
const isAuthEnabled = !!supabase;

if (!isAuthEnabled) {
  console.warn('⚠️  Supabase non configurato: il backend è avviato senza autenticazione (MODALITÀ SVILUPPO).');
}
if (!HUGGING_FACE_TOKEN) {
  console.warn('⚠️  HUGGING_FACE_TOKEN non configurato: la diarizzazione WhisperX non sarà disponibile.');
}
// ===== Configurazione Path =====
// Il PROJECT_ROOT è la cartella che CONTIENE le cartelle 'rec2pdf-backend', 'Scripts', etc.
// Dato che server.js è in 'rec2pdf-backend', dobbiamo salire di un livello.
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLISH_SCRIPT = process.env.PUBLISH_SCRIPT || path.join(PROJECT_ROOT, 'Scripts', 'publish.sh');
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.join(PROJECT_ROOT, 'Templates');
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(PROJECT_ROOT, 'rec2pdf-frontend', 'src', 'assets');

console.log('📁 Percorsi backend configurati:');
console.log(`   PROJECT_ROOT:   ${PROJECT_ROOT}`);
console.log(`   PUBLISH_SCRIPT: ${PUBLISH_SCRIPT}`);
console.log(`   TEMPLATES_DIR:  ${TEMPLATES_DIR}`);

// Verifica che lo script esista all'avvio
if (!fs.existsSync(PUBLISH_SCRIPT)) {
  console.warn(`⚠️  ATTENZIONE: Script publish.sh non trovato in ${PUBLISH_SCRIPT}`);
  console.warn(`   Il sistema userà il fallback pandoc generico.`);
} else {
  console.log(`✅ Script publish.sh trovato: ${PUBLISH_SCRIPT}`);
}

const allowedOrigins = [
    'http://localhost:5173',
     'https://rec2pdf-frontend.vercel.app',
     'https://rec2pdf.vercel.app'
   ];
   
   app.use(cors({
     origin: function (origin, callback) {
       if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const extractAuthToken = (req) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match && match[1]) {
    const token = match[1].trim();
    if (token) {
      return token;
    }
  }

  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (queryToken) {
    return queryToken;
  }

  const accessToken = typeof req.query?.access_token === 'string' ? req.query.access_token.trim() : '';
  if (accessToken) {
    return accessToken;
  }

  return '';
};

const authenticateRequest = async (req, res, next) => {
  if (!isAuthEnabled) {
    req.user = { id: 'local-dev', role: 'anon' };
    return next();
  }

  const token = extractAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = data.user;
    return next();
  } catch (error) {
    console.error('Supabase authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

app.use('/api', (req, res, next) => {
  // Escludiamo dal controllo di autenticazione utente l'health check e il trigger del worker
  if (req.path === '/health' || req.path === '/worker/trigger') {
    return next(); // Lascia passare la richiesta
  }
  // Per tutte le altre rotte /api, esegui l'autenticazione utente
  return authenticateRequest(req, res, next);
});

const DEFAULT_STATUSES = ['Bozza', 'In lavorazione', 'Da revisionare', 'Completato'];
const DEFAULT_VERSIONING_POLICY = {
  retentionLimit: 10,
  freezeOnPublish: false,
  namingConvention: 'timestamped',
};

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) && ms > 0 ? ms : 0));

const run = (cmd, args = [], opts = {}) =>
  new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let child;

    try {
      child = spawn(cmd, Array.isArray(args) ? args : [], opts);
    } catch (spawnError) {
      return resolve({ code: -1, stdout: '', stderr: spawnError?.message || String(spawnError) });
    }

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      resolve({ code: -1, stdout, stderr: error?.message || String(error) });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      resolve({
        code: typeof code === 'number' ? code : 0,
        stdout,
        stderr,
      });
    });
  });

const bash = (command, opts = {}) => run('bash', ['-lc', command], opts);

const buildPandocFallback = (templateInfo, mdArg, pdfArg) => {
  const info =
    templateInfo && typeof templateInfo === 'object'
      ? templateInfo
      : typeof templateInfo === 'string'
        ? { path: templateInfo }
        : null;
  const templatePath = info?.path && typeof info.path === 'string' ? info.path : '';
  const inferredType = info?.type || (templatePath ? path.extname(templatePath).replace(/^\./, '') : '');
  const templateType = inferredType ? inferredType.toLowerCase() : '';
  const cssPath = info?.cssPath && typeof info.cssPath === 'string' ? info.cssPath : '';
  const resourcePath = info?.resourcePath && typeof info.resourcePath === 'string' ? info.resourcePath : '';
  const inlineMetadataPath =
    info?.inlineMetadataPath && typeof info.inlineMetadataPath === 'string' ? info.inlineMetadataPath : '';

  if (templatePath && templateType === 'html') {
    const templateArg = ` --template ${JSON.stringify(templatePath)}`;
    const cssArg = cssPath ? ` --css ${JSON.stringify(cssPath)}` : '';
    const resourceArg = resourcePath ? ` --resource-path ${JSON.stringify(resourcePath)}` : '';
    const metadataArg = inlineMetadataPath ? ` --metadata-file ${JSON.stringify(inlineMetadataPath)}` : '';
    return [
      '(',
      'html_engine="${WORKSPACE_PROFILE_TEMPLATE_ENGINE:-${PREFERRED_HTML_ENGINE:-}}";',
      'if [[ -n "$html_engine" ]] && ! command -v "$html_engine" >/dev/null 2>&1; then',
      '  html_engine="";',
      'fi;',
      'if [[ -z "$html_engine" ]]; then',
      '  if command -v wkhtmltopdf >/dev/null 2>&1; then',
      '    html_engine=wkhtmltopdf;',
      '  elif command -v weasyprint >/dev/null 2>&1; then',
      '    html_engine=weasyprint;',
      '  else',
      '    echo "Nessun motore HTML disponibile (wkhtmltopdf/weasyprint)" >&2;',
      '    exit 1;',
      '  fi;',
      'fi;',
      'extra_opts=();',
      'if [[ "$html_engine" == "wkhtmltopdf" ]]; then',
      '  extra_opts+=(--pdf-engine-opt=--enable-local-file-access);',
      'fi;',
      `pandoc ${mdArg} --from markdown+yaml_metadata_block --to html${templateArg}${cssArg}${resourceArg}${metadataArg} --highlight-style=kate --embed-resources --pdf-engine "$html_engine" "\${extra_opts[@]}" -o ${pdfArg};`,
      ')',
    ].join(' ');
  }
  if (templatePath && templateType === 'tex') {
    return `pandoc --from markdown --pdf-engine=xelatex --highlight-style=kate --template ${JSON.stringify(
      templatePath
    )} -o ${pdfArg} ${mdArg}`;
  }
  return `pandoc -o ${pdfArg} ${mdArg}`;
};

const createInlineCssMetadataFile = async (cssPath, targetDir) => {
  if (!cssPath || !targetDir) {
    throw new Error('Percorsi CSS o destinazione non validi');
  }
  const cssContent = await fsp.readFile(cssPath, 'utf8');
  const normalized = cssContent.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const indented = lines.map((line) => `    ${line}`);
  const payload = `styles:\n  inline: |\n${indented.join('\n')}\n`;
  const fileName = `inline_css_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.yaml`;
  const filePath = path.join(targetDir, fileName);
  await fsp.writeFile(filePath, payload, 'utf8');
  return filePath;
};

const commandVersion = async (cmd) => {
  try {
    const result = await run(cmd, ['-version']);
    const detail = result.stdout.split('\n')[0].trim();
    return { ok: !!detail, detail };
  } catch {
    return { ok: false, detail: 'not found' };
  }
};

class TemplateResolutionError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'TemplateResolutionError';
    this.code = code || 'template_error';
    this.templateName = options.templateName || '';
    this.userMessage = options.userMessage || message;
  }
}

const SUPPORTED_TEMPLATE_EXTENSIONS = new Map([
  ['.html', { type: 'html' }],
  ['.tex', { type: 'tex' }],
]);

const DEFAULT_LAYOUT_TEMPLATE_MAP = new Map([
  ['verbale_meeting', 'verbale_meeting.html'],
]);

const PANDOC_FALLBACK_TEMPLATE_ID = 'pandoc_fallback';
const PANDOC_FALLBACK_TEMPLATE_LABEL = '2_semplice';
const PANDOC_FALLBACK_TEMPLATE_DESCRIPTION =
  'Impaginazione base generata con il template predefinito di Pandoc.';

const isPandocFallbackTemplate = (templateName) => {
  if (!templateName) {
    return false;
  }
  return String(templateName).trim().toLowerCase() === PANDOC_FALLBACK_TEMPLATE_ID;
};

const sanitizeTemplateRequestName = (name) => {
  if (!name || typeof name !== 'string') return '';
  const normalized = name.replace(/\\/g, '/').trim();
  if (!normalized || normalized.includes('..')) {
    throw new TemplateResolutionError('invalid_name', 'Nome template non valido', {
      templateName: name,
      userMessage: 'Il template selezionato non è valido.',
    });
  }
  return normalized;
};

const readTemplateCommentDescription = async (filePath, type) => {
  try {
    const fileHandle = await fsp.open(filePath, 'r');
    try {
      const { buffer, bytesRead } = await fileHandle.read({ length: 8192, position: 0 });
      const snippet = buffer.toString('utf8', 0, bytesRead);
      if (type === 'html') {
        const match = snippet.match(/<!--([\s\S]*?)-->/);
        if (match && match[1]) {
          const description = match[1].replace(/\s+/g, ' ').trim();
          if (description) return description;
        }
      }
      if (type === 'tex') {
        const lines = snippet.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('%')) {
            const description = trimmed.replace(/^%+\s?/, '').trim();
            if (description) return description;
          }
          if (!trimmed.startsWith('%')) break;
        }
      }
    } finally {
      await fileHandle.close();
    }
  } catch {
    /* ignore comment extraction errors */
  }
  return '';
};

const loadTemplateSidecarMetadata = async (templatePath, ext) => {
  const jsonPath = templatePath.replace(new RegExp(`${ext.replace('.', '\\.')}$`, 'i'), '.json');
  try {
    const data = await fsp.readFile(jsonPath, 'utf8');
    const metadata = JSON.parse(data);
    if (metadata && typeof metadata === 'object') {
      return metadata;
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('⚠️  Lettura metadata template fallita:', error.message || error);
    }
  }
  return {};
};

const resolveTemplateDescriptor = async (templateName) => {
  const normalizedName = sanitizeTemplateRequestName(templateName);
  const absolutePath = path.resolve(TEMPLATES_DIR, normalizedName);
  if (!absolutePath.startsWith(TEMPLATES_DIR)) {
    throw new TemplateResolutionError('invalid_path', 'Percorso template non consentito', {
      templateName: templateName,
      userMessage: 'Il template selezionato non è valido.',
    });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const extensionInfo = SUPPORTED_TEMPLATE_EXTENSIONS.get(ext);
  if (!extensionInfo) {
    throw new TemplateResolutionError('unsupported_extension', `Estensione template non supportata: ${ext || 'nessuna'}`, {
      templateName: templateName,
      userMessage: `Il template ${templateName} ha un formato non supportato.`,
    });
  }

  let stats;
  try {
    stats = await fsp.stat(absolutePath);
  } catch (error) {
    throw new TemplateResolutionError('not_found', `Template non trovato: ${templateName}`, {
      templateName: templateName,
      userMessage: `Il template ${templateName} non esiste: ${error?.message || error}`,
    });
  }

  if (!stats.isFile()) {
    throw new TemplateResolutionError('not_file', `Il template ${templateName} non è un file`, {
      templateName: templateName,
      userMessage: `Il template ${templateName} non è un file valido.`,
    });
  }

  try {
    await fsp.access(absolutePath, fs.constants.R_OK);
  } catch (error) {
    throw new TemplateResolutionError('unreadable', `Template non leggibile: ${templateName}`, {
      templateName: templateName,
      userMessage: `Il template ${templateName} non è leggibile: ${error?.message || error}`,
    });
  }

  const metadata = await loadTemplateSidecarMetadata(absolutePath, ext);
  const descriptionFromMetadata = typeof metadata.description === 'string' ? metadata.description.trim() : '';
  const descriptionFromComment = await readTemplateCommentDescription(absolutePath, extensionInfo.type);
  const cssCandidate =
    extensionInfo.type === 'html' ? absolutePath.replace(/\.html$/i, '.css') : '';
  let cssPath = '';
  if (cssCandidate) {
    try {
      const cssStats = await fsp.stat(cssCandidate);
      if (cssStats.isFile()) {
        await fsp.access(cssCandidate, fs.constants.R_OK);
        cssPath = cssCandidate;
      }
    } catch {
      cssPath = '';
    }
  }

  const templateDir = path.dirname(absolutePath);
  const baseName = path.basename(absolutePath, ext);
  const resourceCandidates = [templateDir, TEMPLATES_DIR];
  if (cssPath) {
    resourceCandidates.push(path.dirname(cssPath));
  }
  if (extensionInfo.type === 'html') {
    resourceCandidates.push(path.join(templateDir, baseName));
  }
  const resourcePaths = resourceCandidates
    .map((candidate) => candidate && candidate.trim())
    .filter((candidate, index, arr) => candidate && arr.indexOf(candidate) === index)
    .filter((candidate) => {
      try {
        return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    });
  const resourcePath = resourcePaths.join(path.delimiter);

  const descriptor = {
    path: absolutePath,
    fileName: path.relative(TEMPLATES_DIR, absolutePath),
    baseName,
    type: extensionInfo.type,
    cssPath,
    cssFileName: cssPath ? path.relative(TEMPLATES_DIR, cssPath) : '',
    description: descriptionFromMetadata || descriptionFromComment || '',
    engine: typeof metadata.engine === 'string' ? metadata.engine.trim() : '',
    name: typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : '',
    metadata,
    resourcePaths,
    resourcePath,
  };

  if (!descriptor.name) {
    descriptor.name = descriptor.baseName;
  }

  return descriptor;
};

const descriptorToMetadata = (descriptor, { nameOverride } = {}) => ({
  name: nameOverride || descriptor.name,
  fileName: descriptor.fileName,
  type: descriptor.type,
  hasCss: !!descriptor.cssFileName,
  cssFileName: descriptor.cssFileName,
  description: descriptor.description,
  engine: descriptor.engine,
});

const listTemplatesMetadata = async () => {
  try {
    const dirEntries = await fsp.readdir(TEMPLATES_DIR, { withFileTypes: true });
    const descriptors = new Map();
    for (const entry of dirEntries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_TEMPLATE_EXTENSIONS.has(ext)) continue;
      if (['cover.tex', 'header_footer.tex'].includes(entry.name)) continue;
      try {
        const descriptor = await resolveTemplateDescriptor(entry.name);
        descriptors.set(descriptor.fileName, descriptor);
      } catch (error) {
        const reason =
          error instanceof TemplateResolutionError ? error.userMessage : error?.message || error;
        console.warn(`⚠️  Template ignorato (${entry.name}): ${reason}`);
      }
    }

    const ordered = [];

    const defaultDescriptor = descriptors.get('default.tex');
    if (defaultDescriptor) {
      ordered.push(descriptorToMetadata(defaultDescriptor, { nameOverride: '1_Default.tex' }));
      descriptors.delete('default.tex');
    }

   

    const verbaleDescriptor = descriptors.get('verbale_meeting.html');
    if (verbaleDescriptor) {
      ordered.push(
        descriptorToMetadata(verbaleDescriptor, { nameOverride: '3_verbale_meeting' })
      );
      descriptors.delete('verbale_meeting.html');
    }

    const remaining = Array.from(descriptors.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((descriptor) => descriptorToMetadata(descriptor));
    ordered.push(...remaining);

    return ordered;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [
        {
          name: PANDOC_FALLBACK_TEMPLATE_LABEL,
          fileName: PANDOC_FALLBACK_TEMPLATE_ID,
          type: 'pandoc',
          hasCss: false,
          cssFileName: '',
          description: PANDOC_FALLBACK_TEMPLATE_DESCRIPTION,
          engine: '',
        },
      ];
    }
    throw error;
  }
};

const buildTemplateEnv = (descriptor) => {
  if (!descriptor || typeof descriptor !== 'object') {
    return null;
  }

  // === DEBUG: Verifica Path Assoluto ===
  // Questo log apparirà nella console di Google Cloud Run
  console.log(`[DEBUG ENV] Costruisco ENV per template. Path assoluto: ${descriptor.path}`);

  const env = {
    // Forziamo l'uso del path assoluto che abbiamo risolto in resolveTemplateDescriptor
    WORKSPACE_PROFILE_TEMPLATE: descriptor.path,
    WORKSPACE_PROFILE_TEMPLATE_TYPE: descriptor.type,
  };

  if (descriptor.cssPath) {
    env.WORKSPACE_PROFILE_TEMPLATE_CSS = descriptor.cssPath;
  }
  if (descriptor.engine) {
    env.WORKSPACE_PROFILE_TEMPLATE_ENGINE = descriptor.engine;
  }
  if (descriptor.resourcePath) {
    env.WORKSPACE_PROFILE_TEMPLATE_RESOURCE_PATH = descriptor.resourcePath;
  }
  
  // Gestione Margini (manteniamo la logica esistente)
  if (descriptor.size && typeof descriptor.size === 'object') {
    const { marginTop, marginRight, marginBottom, marginLeft } = {
      marginTop: descriptor.size.margin_top || descriptor.size.marginTop,
      marginRight: descriptor.size.margin_right || descriptor.size.marginRight,
      marginBottom: descriptor.size.margin_bottom || descriptor.size.marginBottom,
      marginLeft: descriptor.size.margin_left || descriptor.size.marginLeft,
    };
    if (marginTop) env.WORKSPACE_PROFILE_MARGIN_TOP = marginTop;
    if (marginRight) env.WORKSPACE_PROFILE_MARGIN_RIGHT = marginRight;
    if (marginBottom) env.WORKSPACE_PROFILE_MARGIN_BOTTOM = marginBottom;
    if (marginLeft) env.WORKSPACE_PROFILE_MARGIN_LEFT = marginLeft;
  }
  
  return env;
};

const resolvePromptTemplateDescriptor = async (prompt, { logger } = {}) => {
  if (!prompt || typeof prompt !== 'object') {
    return null;
  }
  const pdfRules = prompt.pdfRules && typeof prompt.pdfRules === 'object' ? prompt.pdfRules : null;
  if (!pdfRules) {
    return null;
  }

  let candidate = '';
  if (typeof pdfRules.template === 'string' && pdfRules.template.trim()) {
    candidate = pdfRules.template.trim();
  }
  if (!candidate && typeof pdfRules.layout === 'string' && pdfRules.layout.trim()) {
    const normalizedLayout = pdfRules.layout.trim().toLowerCase();
    if (DEFAULT_LAYOUT_TEMPLATE_MAP.has(normalizedLayout)) {
      candidate = DEFAULT_LAYOUT_TEMPLATE_MAP.get(normalizedLayout);
    }
  }

  if (!candidate) {
    return null;
  }

  try {
    const descriptor = await resolveTemplateDescriptor(candidate);
    if (typeof logger === 'function') {
      logger(`📄 Template prompt: ${descriptor.fileName}`, 'publish', 'info');
      if (descriptor.cssFileName) {
        logger(`🎨 CSS template prompt: ${descriptor.cssFileName}`, 'publish', 'info');
      }
      if (descriptor.engine) {
        logger(`⚙️ Motore HTML prompt: ${descriptor.engine}`, 'publish', 'info');
      }
    }
    return descriptor;
  } catch (error) {
    if (typeof logger === 'function') {
      const reason =
        error instanceof TemplateResolutionError ? error.userMessage : error?.message || error;
      logger(`⚠️ Template prompt non accessibile: ${reason}`, 'publish', 'warning');
    }
    return null;
  }
};

const unwrapEnvOptions = (envOptions) => {
  if (!envOptions || typeof envOptions !== 'object') {
    return {};
  }
  if (envOptions.env && typeof envOptions.env === 'object') {
    return envOptions.env;
  }
  return envOptions;
};

const templateInfoFromEnv = (envOptions) => {
  const env = unwrapEnvOptions(envOptions);
  const templatePath = typeof env.WORKSPACE_PROFILE_TEMPLATE === 'string' ? env.WORKSPACE_PROFILE_TEMPLATE : '';
  if (!templatePath) {
    return null;
  }
  const typeRaw = typeof env.WORKSPACE_PROFILE_TEMPLATE_TYPE === 'string' ? env.WORKSPACE_PROFILE_TEMPLATE_TYPE : '';
  const cssPath = typeof env.WORKSPACE_PROFILE_TEMPLATE_CSS === 'string' ? env.WORKSPACE_PROFILE_TEMPLATE_CSS : '';
  const engine = typeof env.WORKSPACE_PROFILE_TEMPLATE_ENGINE === 'string' ? env.WORKSPACE_PROFILE_TEMPLATE_ENGINE : '';
  const resourcePath =
    typeof env.WORKSPACE_PROFILE_TEMPLATE_RESOURCE_PATH === 'string'
      ? env.WORKSPACE_PROFILE_TEMPLATE_RESOURCE_PATH
      : '';
  const inferredType = typeRaw || path.extname(templatePath).replace(/^\./, '');
  return {
    path: templatePath,
    type: inferredType ? inferredType.toLowerCase() : '',
    cssPath,
    engine,
    resourcePath,
    resourcePaths: resourcePath ? resourcePath.split(path.delimiter).filter(Boolean) : [],
  };
};

const publishWithTemplateFallback = async ({
  mdLocalPath,
  pdfLocalPath,
  publishEnv,
  templateInfo,
  logger,
  callPublishFn = callPublishScript,
  runPandoc = bash,
  forcePandocFallback = false,
}) => {
  if (!mdLocalPath || !pdfLocalPath) {
    throw new Error('Percorsi Markdown o PDF mancanti per la pubblicazione');
  }
  const log = (message, stage = 'publish', status = 'info') => {
    if (typeof logger === 'function') {
      logger(message, stage, status);
    }
  };

  log(`--- DEBUG: publishWithTemplateFallback START ---`);
  log(`mdLocalPath: ${mdLocalPath}`);
  log(`pdfLocalPath: ${pdfLocalPath}`);
  log(`publishEnv: ${JSON.stringify(publishEnv, null, 2)}`);
  log(`templateInfo: ${JSON.stringify(templateInfo, null, 2)}`);

  let result;
  if (forcePandocFallback) {
    log('⏭️  Skip publish.sh: selezionato template semplice Pandoc', 'publish', 'info');
    result = { code: 1, stdout: '', stderr: 'force pandoc fallback' };
  } else {
    try {
      result = await callPublishFn(mdLocalPath, publishEnv);
  // === DEBUG AGGRESSIVO ===
  console.log(`[PUBLISH DEBUG] Exit Code: ${result.code}`);
      
  // Stampiamo SEMPRE stdout/stderr per capire cosa succede
  if (result.stdout) console.log(`[PUBLISH STDOUT]:\n${result.stdout}`);
  if (result.stderr) console.error(`[PUBLISH STDERR]:\n${result.stderr}`);
  
  if (result.code !== 0) {
      console.error(`❌ [PUBLISH CRITICAL ERROR]`);
      // Se stderr è vuoto, spesso l'errore è in stdout per tool come pandoc
      if (!result.stderr && result.stdout) {
          console.error(`L'errore potrebbe essere qui sopra in STDOUT.`);
      }
  }
  // ========================    
      log(`callPublishFn (publish.sh) result: code=${result.code}, stdout=${result.stdout}, stderr=${result.stderr}`);
    } catch (e) {
      log(`ERROR in callPublishFn (publish.sh): ${e.message}`, 'publish', 'failed');
      throw e;
    }
  }

  if (result.code !== 0 || forcePandocFallback) {
    log(result.stderr || result.stdout || 'publish.sh failed', 'publish', 'warning');
    log('Tentativo fallback pandoc…', 'publish', 'info');
  }

  if (!fs.existsSync(pdfLocalPath)) {
    log(`PDF file NOT found at ${pdfLocalPath} after publish.sh attempt.`);
    if (result.code === 0) {
      log('publish.sh non ha generato un PDF, fallback su pandoc…', 'publish', 'info');
    }
    const destDir = path.dirname(mdLocalPath);
    const mdArg = JSON.stringify(mdLocalPath);
    const pdfArg = JSON.stringify(pdfLocalPath);
    const resolvedTemplateInfo = templateInfo || templateInfoFromEnv(publishEnv);
    let inlineMetadataPath = '';
    let fallbackTemplateInfo = resolvedTemplateInfo;
    if (resolvedTemplateInfo && resolvedTemplateInfo.type === 'html' && resolvedTemplateInfo.cssPath) {
      try {
        inlineMetadataPath = await createInlineCssMetadataFile(resolvedTemplateInfo.cssPath, destDir);
        if (inlineMetadataPath) {
          fallbackTemplateInfo = { ...resolvedTemplateInfo, inlineMetadataPath };
        }
      } catch (metadataError) {
        log(
          `⚠️ CSS inline non generato per il fallback: ${metadataError?.message || metadataError}`,
          'publish',
          'warning'
        );
      }
    }
    try {
      const fallbackCmdParts = [];
      fallbackCmdParts.push(`cd ${JSON.stringify(destDir)};`);
      fallbackCmdParts.push(
        `command -v pandocPDF >/dev/null && pandocPDF ${mdArg} || ${buildPandocFallback(fallbackTemplateInfo, mdArg, pdfArg)}`
      );
      log(`Pandoc fallback command: ${fallbackCmdParts.join(' ')}`);
      const pandoc = await runPandoc(fallbackCmdParts.join(' '), publishEnv);
      log(`Pandoc fallback result: code=${pandoc.code}, stdout=${pandoc.stdout}, stderr=${pandoc.stderr}`);

      if (pandoc.code !== 0 || !fs.existsSync(pdfLocalPath)) {
        log(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
        throw new Error('Generazione PDF fallita');
      }
      log('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
    } finally {
      if (inlineMetadataPath) {
        await safeUnlink(inlineMetadataPath);
      }
    }
  } else {
    log(`PDF file found at ${pdfLocalPath} after publish.sh attempt. Size: ${fs.statSync(pdfLocalPath).size} bytes.`);
  }

  log(`--- DEBUG: publishWithTemplateFallback END ---`);
  return result;
};

const ensureWritableDirectory = async (dir) => {
  try {
    await fsp.access(dir, fs.constants.W_OK);
    return { ok: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        await fsp.mkdir(dir, { recursive: true });
        return { ok: true };
      } catch (mkdirError) {
        return { ok: false, error: mkdirError };
      }
    }
    return { ok: false, error };
  }
};

const yyyymmddHHMMSS = (d = new Date()) => {
  return d.toISOString().replace(/[-:.]/g, '').slice(0, 14);
};

const DEFAULT_DEST_DIR = path.join(os.homedir(), 'Recordings');

const normalizeQuoteCharacters = (value) =>
  value
    .replace(/[\u2018\u2019\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u2033\u2036]/g, '"')
    .replace(/[\u02BC\u02BD]/g, "'");

const stripWrappingQuotes = (value) => {
  const pairs = [
    ["'", "'"],
    ['"', '"'],
    ['`', '`'],
  ];

  let trimmedOnce = value.trim();
  let changed = false;

  do {
    changed = false;
    for (const [start, end] of pairs) {
      if (
        trimmedOnce.length >= 2 &&
        trimmedOnce.startsWith(start) &&
        trimmedOnce.endsWith(end)
      ) {
        trimmedOnce = trimmedOnce.slice(start.length, trimmedOnce.length - end.length).trim();
        changed = true;
      }
    }
  } while (changed);

  // Handle cases where only the leading or trailing character is quoted (e.g. copied value `'path`)
  if (trimmedOnce.startsWith("'") || trimmedOnce.startsWith('"') || trimmedOnce.startsWith('`')) {
    trimmedOnce = trimmedOnce.slice(1).trim();
  }
  if (trimmedOnce.endsWith("'") || trimmedOnce.endsWith('"') || trimmedOnce.endsWith('`')) {
    trimmedOnce = trimmedOnce.slice(0, -1).trim();
  }

  return trimmedOnce;
};

const sanitizeDestDirInput = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  if (!value) {
    return '';
  }

  const normalizedQuotes = normalizeQuoteCharacters(value);
  const withoutWrappingQuotes = stripWrappingQuotes(normalizedQuotes);
  const raw = withoutWrappingQuotes.trim();

  if (!raw) {
    return '';
  }

  const normalized = raw.replace(/\\+/g, '/').trim();
  if (!normalized || /tuo_utente/i.test(normalized)) {
    return '';
  }
  if (normalized === '/Users/' || normalized === '/Users') {
    return '';
  }
  if (normalized.toLowerCase() === 'users/' || normalized.toLowerCase() === 'users') {
    return '';
  }

  return raw;
};

const normalizeLocalFilePathInput = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  let input = value.trim();
  if (!input) {
    return '';
  }

  if (/^file:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      input = decodeURIComponent(url.pathname || '');
      if (process.platform === 'win32' && input.startsWith('/')) {
        input = input.slice(1);
      }
    } catch {
      return '';
    }
  }

  if (input === '~') {
    input = os.homedir();
  } else if (input.startsWith('~/') || input.startsWith('~\\')) {
    input = path.join(os.homedir(), input.slice(2));
  } else if (input.startsWith('~')) {
    return '';
  }

  const unifiedSeparators = input.replace(/[\\/]+/g, path.sep);
  const normalized = path.normalize(unifiedSeparators);

  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  return '';
};

const resolveDestinationDirectory = async (rawDest) => {
  const sanitized = sanitizeDestDirInput(rawDest);
  const targetDir = sanitized ? path.resolve(sanitized) : DEFAULT_DEST_DIR;
  const writable = await ensureWritableDirectory(targetDir);
  if (!writable.ok) {
    const reason = writable.error?.message || 'Cartella non scrivibile';
    const error = new Error(reason);
    error.statusCode = 400;
    error.reason = reason;
    throw error;
  }
  return { dir: targetDir, isCustom: !!sanitized };
};

const findPromptById = (prompts, id) => {
  if (!id) return null;
  const normalized = String(id).trim();
  if (!normalized) return null;
  return (
    (prompts || []).find((prompt) => {
      if (!prompt || typeof prompt !== 'object') return false;
      if (prompt.id === normalized) return true;
      if (prompt.legacyId && prompt.legacyId === normalized) return true;
      if (prompt.supabaseId && prompt.supabaseId === normalized) return true;
      return false;
    }) || null
  );
};

const normalizeCueCards = (value = []) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((card, index) => {
      if (!card || typeof card !== 'object') return null;
      const key = card.key || card.id || `cue_${index}`;
      const title = String(card.title || card.label || '').trim();
      const hint = String(card.hint || card.description || '').trim();
      if (!title) return null;
      return {
        key,
        title,
        hint,
      };
    })
    .filter(Boolean);
};

const normalizeChecklistSections = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  return [];
};

const normalizePromptRules = (rules = {}) => {
  const normalized = {};
  if (rules.tone) normalized.tone = String(rules.tone).trim();
  if (rules.voice) normalized.voice = String(rules.voice).trim();
  if (rules.bulletStyle) normalized.bulletStyle = String(rules.bulletStyle).trim();
  if (rules.summaryStyle) normalized.summaryStyle = String(rules.summaryStyle).trim();
  if (typeof rules.includeCallouts === 'boolean') {
    normalized.includeCallouts = rules.includeCallouts;
  }
  if (rules.pointOfView) normalized.pointOfView = String(rules.pointOfView).trim();
  if (rules.lengthGuideline) normalized.lengthGuideline = String(rules.lengthGuideline).trim();
  return Object.keys(normalized).length ? normalized : null;
};

const normalizePdfRules = (rules = {}) => {
  const normalized = {};
  if (rules.accentColor) normalized.accentColor = normalizeColor(rules.accentColor);
  if (rules.layout) normalized.layout = String(rules.layout).trim();
  if (typeof rules.includeCover === 'boolean') normalized.includeCover = rules.includeCover;
  if (typeof rules.includeToc === 'boolean') normalized.includeToc = rules.includeToc;
  if (rules.footerNote) normalized.footerNote = String(rules.footerNote).trim();
  return Object.keys(normalized).length ? normalized : null;
};

const mergePromptUpdate = (prompt, patch = {}) => {
  const updated = { ...prompt };
  if (patch.title) updated.title = String(patch.title).trim();
  if (patch.summary) updated.summary = String(patch.summary).trim();
  if (patch.description) updated.description = String(patch.description).trim();
  if (patch.persona) updated.persona = String(patch.persona).trim();
  if (patch.slug) updated.slug = sanitizeSlug(patch.slug, prompt.slug || prompt.id || 'prompt');
  if (patch.color) updated.color = normalizeColor(patch.color);
  if (patch.tags) {
    const tags = Array.isArray(patch.tags)
      ? patch.tags
      : String(patch.tags)
        .split(/,|\r?\n/)
        .map((tag) => tag.trim())
        .filter(Boolean);
    updated.tags = tags;
  }
  if (patch.cueCards) {
    const cards = normalizeCueCards(patch.cueCards);
    if (cards.length) {
      updated.cueCards = cards;
    }
  }
  if (patch.markdownRules) {
    const rules = normalizePromptRules({ ...prompt.markdownRules, ...patch.markdownRules });
    updated.markdownRules = rules;
  }
  if (patch.pdfRules) {
    const rules = normalizePdfRules({ ...prompt.pdfRules, ...patch.pdfRules });
    updated.pdfRules = rules;
  }
  if (patch.checklist) {
    const sections = normalizeChecklistSections(patch.checklist.sections || patch.checklist);
    updated.checklist = { sections };
  }
  if (patch.focusPrompts && Array.isArray(patch.focusPrompts)) {
    updated.focusPrompts = patch.focusPrompts.map((item) => String(item || '').trim()).filter(Boolean);
  }
  updated.updatedAt = Date.now();
  return updated;
};

const promptAssignmentForResponse = (prompt, extras = {}) => {
  if (!prompt) return null;
  const cueCards = normalizeCueCards(prompt.cueCards);
  const checklistSections = normalizeChecklistSections(prompt.checklist?.sections || prompt.checklist);
  const completedCues = Array.isArray(extras.completedCues)
    ? extras.completedCues.filter(Boolean)
    : [];
  return {
    id: prompt.id,
    slug: prompt.slug || '',
    title: prompt.title || '',
    summary: prompt.summary || '',
    description: prompt.description || '',
    persona: prompt.persona || '',
    color: prompt.color || '#6366f1',
    tags: Array.isArray(prompt.tags) ? prompt.tags.filter(Boolean) : [],
    cueCards,
    checklist: { sections: checklistSections },
    markdownRules: prompt.markdownRules || null,
    pdfRules: prompt.pdfRules || null,
    builtIn: Boolean(prompt.builtIn),
    focus: extras.focus ? String(extras.focus).trim() : '',
    notes: extras.notes ? String(extras.notes).trim() : '',
    completedCues,
  };
};

const buildPromptRulePayload = (prompt, extras = {}) => {
  if (!prompt) return null;
  return {
    id: prompt.id,
    slug: prompt.slug || '',
    title: prompt.title || '',
    persona: prompt.persona || '',
    summary: prompt.summary || '',
    description: prompt.description || '',
    tags: Array.isArray(prompt.tags) ? prompt.tags.filter(Boolean) : [],
    cueCards: normalizeCueCards(prompt.cueCards),
    checklist: {
      sections: normalizeChecklistSections(prompt.checklist?.sections || prompt.checklist),
    },
    markdownRules: prompt.markdownRules || null,
    pdfRules: prompt.pdfRules || null,
    focus: extras.focus ? String(extras.focus).trim() : '',
    notes: extras.notes ? String(extras.notes).trim() : '',
    completedCues: Array.isArray(extras.completedCues)
      ? extras.completedCues.filter(Boolean)
      : [],
  };
};

const buildEnvOptions = (...sources) => {
  if (!sources || !sources.length) {
    return {};
  }
  const env = { ...process.env };
  sources
    .filter(Boolean)
    .forEach((source) => {
      Object.entries(source).forEach(([key, value]) => {
        if (typeof value === 'undefined' || value === null) return;
        env[key] = typeof value === 'string' ? value : JSON.stringify(value);
      });
    });
  return { env };
};
/**
 * Chiama lo script publish.sh per generare il PDF
 * @param {string} mdPath - Path del file Markdown
 * @param {object} env - Variabili d'ambiente aggiuntive
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
const callPublishScript = async (mdPath, env = {}) => {
  if (!fs.existsSync(PUBLISH_SCRIPT)) {
    return {
      code: 127,
      stdout: '',
      stderr: 'Script publish.sh non trovato. Usa il fallback pandoc.'
    };
  }

  // Assicurati che lo script sia eseguibile
  try {
    await fsp.chmod(PUBLISH_SCRIPT, 0o755);
  } catch (chmodError) {
    console.warn('Impossibile impostare permessi esecuzione su publish.sh:', chmodError.message);
  }

  // Costruisci l'ambiente
  const envOptions = env && typeof env === 'object' && env.env && typeof env.env === 'object'
    ? env.env
    : env;
  const publishEnv = {
    ...process.env,
    ...envOptions,
    TOOL_ROOT: PROJECT_ROOT,
    TEMPLATE_DIR: TEMPLATES_DIR,
    ASSETS_DIR: ASSETS_DIR,
  };

  // Esegui lo script
  return await run('bash', [PUBLISH_SCRIPT, mdPath], { env: publishEnv });
};

const formatDiarizedTimestamp = (seconds) => {
  if (!Number.isFinite(seconds)) return '00:00:00';
  const clamped = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(clamped / 3600)).padStart(2, '0');
  const mm = String(Math.floor((clamped % 3600) / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const humanizeDiarizedSpeaker = (rawSpeaker) => {
  if (typeof rawSpeaker !== 'string' || !rawSpeaker.trim()) {
    return 'Speaker ?';
  }
  const normalized = rawSpeaker.trim();
  const match = normalized.match(/speaker[_\s]*(\d+)/i);
  if (match) {
    const idx = parseInt(match[1], 10);
    if (Number.isFinite(idx)) {
      return `Speaker ${idx + 1}`;
    }
  }
  return normalized.replace(/_/g, ' ').trim();
};

const extractDiarizedText = (segment) => {
  if (!segment || typeof segment !== 'object') return '';
  if (typeof segment.text === 'string' && segment.text.trim()) {
    return segment.text.replace(/\s+/g, ' ').trim();
  }
  if (Array.isArray(segment.words)) {
    return segment.words
      .map((w) => (w && typeof w.word === 'string' ? w.word : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
};

const normalizeDiarizedSegments = (segments = []) => {
  if (!Array.isArray(segments) || !segments.length) return [];

  return segments
    .map((segment) => {
      const text = extractDiarizedText(segment);
      if (!text) return null;
      const start = typeof segment.start === 'number' ? segment.start : null;
      const speakerRaw = typeof segment.speaker === 'string' ? segment.speaker.trim() : '';
      return {
        start: Number.isFinite(start) ? start : Number.MAX_SAFE_INTEGER,
        timestamp: formatDiarizedTimestamp(start),
        speakerRaw,
        speakerLabel: humanizeDiarizedSpeaker(speakerRaw || 'SPEAKER_UNKNOWN'),
        text,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
};

// Converte i segmenti diarizzati di whisperx in testo leggibile
// con timestamp [HH:MM:SS] e Speaker N
const diarizedSegmentsToText = (segments = []) => {
  const normalized = normalizeDiarizedSegments(segments);
  if (!normalized.length) return '';
  return normalized.map((segment) => `[${segment.timestamp}] ${segment.speakerLabel}: ${segment.text}`).join('\n');
};


const loadTranscriptForPrompt = async (sourcePath) => {
  const raw = await fsp.readFile(sourcePath, 'utf8');
  const ext = path.extname(sourcePath || '').toLowerCase();
  if (ext === '.json' || (!ext && raw.trim().startsWith('{'))) {
    try {
      const parsed = JSON.parse(raw);
      const diarized = diarizedSegmentsToText(parsed?.segments || []);
      if (diarized) {
        return diarized;
      }
    } catch {
      // ignore JSON parse errors, fallback to raw text
    }
  }
  return raw;
};

const FRONT_MATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n)?/;

const stripFrontMatter = (markdown) => {
  if (typeof markdown !== 'string' || !markdown) {
    return '';
  }
  return markdown.replace(FRONT_MATTER_REGEX, '').trim();
};

const unwrapCodeFence = (markdown) => {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return '';
  }

  const fencedBlockMatch = markdown.match(/^\s*```[\w-]*\s*\n([\s\S]*?)\n```\s*$/);
  if (fencedBlockMatch) {
    return fencedBlockMatch[1].trim();
  }

  return markdown;
};

const normalizeLiteralEscapes = (markdown) => {
  if (typeof markdown !== 'string' || !markdown) {
    return '';
  }

  let normalized = markdown.replace(/\r\n?/g, '\n');
  if (/\\[nrt]/.test(normalized)) {
    normalized = normalized
      .replace(/\\r/g, '')
      .replace(/\\t/g, '\t')
      .replace(/\\n/g, '\n');
  }
  return normalized;
};

const normalizeAiMarkdownBody = (markdown) => {
  if (typeof markdown !== 'string') {
    return '';
  }

  const withoutFrontMatter = stripFrontMatter(markdown);
  const unfenced = unwrapCodeFence(withoutFrontMatter);
  const normalizedEscapes = normalizeLiteralEscapes(unfenced);
  return normalizedEscapes.trim();
};

const applyAiModelToFrontMatter = (markdown, modelName) => {
  if (!modelName || typeof markdown !== 'string' || !markdown.startsWith('---')) {
    return markdown;
  }
  const match = FRONT_MATTER_REGEX.exec(markdown);
  if (!match) {
    return markdown;
  }

  const newline = match[0].includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = typeof match[2] === 'string' ? match[2] : '';
  const frontMatterLines = match[1].split(/\r?\n/);
  let replaced = false;

  const updatedLines = frontMatterLines.map((line) => {
    if (/^\s*ai\.model\s*:/i.test(line)) {
      replaced = true;
      return `ai.model: "${modelName}"`;
    }
    return line;
  });

  if (!replaced) {
    updatedLines.push(`ai.model: "${modelName}"`);
  }

  const updatedFrontMatter = `---${newline}${updatedLines.join(newline)}${newline}---${trailingNewline}`;
  return `${updatedFrontMatter}${markdown.slice(match[0].length)}`;
};

const normalizeTemplateString = (value) => (typeof value === 'string' ? value.trim() : '');

const aggregateCueCardsMarkdown = (promptCueCards = [], refinedData = null, fallbackCueCards = []) => {
  const refinedCards = Array.isArray(refinedData?.cueCards) ? refinedData.cueCards : [];
  const answersMap = isPlainObject(refinedData?.cueCardAnswers) ? refinedData.cueCardAnswers : {};

  const baseCards = refinedCards.length
    ? refinedCards
    : promptCueCards.length
      ? promptCueCards
      : fallbackCueCards;

  if (!Array.isArray(baseCards) || baseCards.length === 0) {
    return '';
  }

  const normalizedAnswers = Object.entries(answersMap || {}).reduce((acc, [answerKey, answerValue]) => {
    const safeKey = normalizeTemplateString(answerKey);
    const safeValue = normalizeTemplateString(answerValue);
    if (safeKey && safeValue) {
      acc[safeKey] = safeValue;
    }
    return acc;
  }, {});

  const sections = baseCards
    .map((card, index) => {
      if (!card || typeof card !== 'object') {
        return null;
      }

      const title = normalizeTemplateString(card.title || card.label || card.name);
      if (!title) {
        return null;
      }

      const explicitKey = normalizeTemplateString(card.key || card.id || card.slug || card.field);
      const retrievalKey = explicitKey || `cue_${index}`;
      const hint = normalizeTemplateString(card.hint || card.description || card.placeholder || card.example);

      const answer = normalizeTemplateString(
        card.value || card.answer || card.response || (retrievalKey ? normalizedAnswers[retrievalKey] : '')
      );

      const lines = [`- **${title}**${explicitKey ? ` _(chiave: ${explicitKey})_` : ''}`];
      if (hint) {
        lines.push(`  - Suggerimento: ${hint}`);
      }
      if (answer) {
        lines.push(`  - Risposta attuale: ${answer}`);
      }

      return lines.join('\n');
    })
    .filter(Boolean);

  return sections.length ? sections.join('\n') : '';
};

// In rec2pdf-backend/server.js

const generateMarkdown = async (txtPath, promptPayload, options = {}) => {
  try {
    const transcript = await loadTranscriptForPrompt(txtPath);

    // ==========================================================
    // ==            INIZIO LOGICA RAG INTEGRATA               ==
    // ==========================================================
    let knowledgeContext = '';
    const { workspaceId, projectId, embeddingProvider } = options;

    if (workspaceId && ragService) {
      console.log('[generateMarkdown] Avvio recupero contesto RAG...');
      try {
        // Costruiamo una query per il RAG basata su tutto l'input disponibile
        const queryParts = [options.focus, options.notes, transcript].filter(Boolean);
        const combinedQuery = queryParts.join('\n\n').slice(0, CONTEXT_QUERY_MAX_CHARS);

       // In server.js -> dentro la funzione generateMarkdown

       if (combinedQuery) {
        knowledgeContext = await retrieveRelevantContext(combinedQuery, workspaceId, {
          // Passiamo direttamente le opzioni ricevute, che contengono
          // le preferenze dell'utente per entrambi i provider.
          embeddingProvider: options.embeddingProvider,
          textProvider: options.textProvider,
          projectId: projectId, // Assicuriamoci di passare il projectId corretto
        });
        
        if (knowledgeContext) {
          console.log(`[generateMarkdown] Contesto RAG recuperato (${knowledgeContext.length} caratteri).`);
        } else {
          console.warn('[generateMarkdown] La pipeline RAG non ha restituito alcun contesto.');
        }
      }
      } catch (ragError) {
        console.error(`❌ Errore durante l'esecuzione della pipeline RAG: ${ragError.message}`);
        // Non blocchiamo la generazione, procediamo senza contesto RAG.
        knowledgeContext = '';
      }
    }
    // ==========================================================
    // ==              FINE LOGICA RAG INTEGRATA               ==
    // ==========================================================

    // 1. Prepara i dati per il template
    const refinedDataForPrompt =
      options && isPlainObject(options.refinedData) ? options.refinedData : null;

    const templateData = {
      persona: promptPayload?.persona,
      description: promptPayload?.description,
      markdownRules: promptPayload?.markdownRules,
      knowledgeContext: knowledgeContext, // Usiamo il contesto appena recuperato
      transcript: transcript,
      _meta: {
        promptId: promptPayload?.id,
        promptVersion: promptPayload?.version || '1.1.2',
        timestamp: new Date().toISOString(),
      }
    };

    const focusValue = [promptPayload?.focus, options?.focus]
      .map(normalizeTemplateString)
      .find(Boolean);
    if (focusValue) {
      templateData.focus = focusValue;
    }

    const notesValue = [promptPayload?.notes, options?.notes]
      .map(normalizeTemplateString)
      .find(Boolean);
    if (notesValue) {
      templateData.notes = notesValue;
    }

    const promptCueCards = Array.isArray(promptPayload?.cueCards) ? promptPayload.cueCards : [];
    const fallbackCueCards = Array.isArray(options?.cueCards) ? options.cueCards : [];
    const cueCardsMarkdown = aggregateCueCardsMarkdown(promptCueCards, refinedDataForPrompt, fallbackCueCards);
    if (cueCardsMarkdown) {
      templateData.cueCardsMarkdown = cueCardsMarkdown;
    }

    if (refinedDataForPrompt) {
      templateData.refinedData = refinedDataForPrompt;
      templateData._meta.refinedDataProvided = true;
    } else {
      templateData._meta.refinedDataProvided = false;
    }

    // 2. Renderizza il prompt
    const fullPrompt = await promptService.render('base_generation', templateData);
    let promptForAi = fullPrompt;
    if (!promptForAi.includes('TRASCRIZIONE DA ELABORARE:')) {
      promptForAi = promptForAi.replace(
        '📄 TRASCRIZIONE DA ELABORARE',
        'TRASCRIZIONE DA ELABORARE:\n📄 TRASCRIZIONE DA ELABORARE'
      );
    }

    if (process.env.DEBUG_PROMPTS === 'true') {
      console.log('\n--- RENDERED PROMPT ---\n', fullPrompt, '\n--- END PROMPT ---\n');
    }

    // 3. Chiama il servizio AI tramite l'Orchestratore
    let generatedContent = '';
    try {
      console.log('[generateMarkdown] Richiedo generazione con complessità HIGH (Modello Pro)...');
      
      generatedContent = await aiOrchestrator.generateContentWithFallback(promptForAi, { 
        textProvider: options.textProvider,
        // QUESTA è la riga fondamentale che forza il modello Pro
        taskComplexity: 'high' 
      });
    } catch (error) {
      console.error(`❌ Errore durante la generazione del contenuto AI (tutti i provider hanno fallito): ${error.message}`);
      throw new Error(`Errore durante la generazione del contenuto AI: ${error.message}`);
    }

    // 4. Esegui il parsing dell'output JSON
    // TODO: Migliorare l'orchestratore per restituire il provider utilizzato per una migliore attribuzione
    const activeModelName = 'unknown'; 
    const cleanedJsonString = generatedContent.replace(/^```(json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    try {
      const parsed = JSON.parse(cleanedJsonString);
      return {
        title: parsed.title || '',
        summary: parsed.summary || '',
        author: parsed.author || '',
        content: parsed.body || '',
           // === FIX: ESTRAZIONE DATI EXTRA ===
           key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
           // ==================================
        modelName: activeModelName,
      };
    } catch (jsonError) {
      console.warn(`⚠️ L'output AI non era un JSON valido. Trattato come solo corpo. ${jsonError.message}`);
      const enrichedContent = applyAiModelToFrontMatter(generatedContent, activeModelName);
      return {
        title: '',
        summary: '',
        author: '',
        content: enrichedContent,
        modelName: activeModelName,
      };
    }

  } catch (error) {
    console.error("❌ Errore imprevisto in generateMarkdown:", error);
    throw error;
  }
};
const generateId = (prefix) => {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};

const normalizeColor = (value) => {
  if (!value) return '#6366f1';
  const hex = String(value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  return '#6366f1';
};

const sanitizeSlug = (value, fallback = 'sessione') => {
  const raw = String(value || '').trim();
  const safe = raw || fallback;
  return safe
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
};

const sanitizeStorageFileName = (value, fallback = 'file') => {
  const base = path.basename(String(value || fallback));
  const ext = path.extname(base);
  const namePart = base.slice(0, base.length - ext.length);
  const safeName = sanitizeSlug(namePart || fallback, fallback);
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
  return `${safeName}${safeExt}`;
};

const workspaceMetadataSchema = z
  .object({
    client: z.string().trim().min(1).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    destDir: z.string().trim().optional(),
    versioningPolicy: z
      .object({
        retentionLimit: z.number().int().min(1).optional(),
        freezeOnPublish: z.boolean().optional(),
        namingConvention: z.string().trim().min(1).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough()
  .optional();

const workspaceRowSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  logo_path: z.string().nullable().optional(),
  metadata: z.any().optional(),
  projects: z.any().optional(),
  default_statuses: z.any().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

const versioningPolicySchema = z
  .object({
    retentionLimit: z.number().int().min(1).optional(),
    freezeOnPublish: z.boolean().optional(),
    namingConvention: z.string().trim().min(1).optional(),
  })
  .partial();

const projectSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    destDir: z.string().trim().optional(),
    statuses: z.array(z.string().trim().min(1)).optional(),
    createdAt: z.number().int().nonnegative().optional(),
    updatedAt: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const profileMetadataSchema = z
  .object({
    label: z.string().trim().min(1).nullable().optional(),
    slug: z.string().trim().min(1).optional(),
    promptId: z.string().trim().optional(),
    pdfTemplate: z.string().trim().optional(),
    pdfLogo: z
      .object({
        fileName: z.string().trim().min(1),
        originalName: z.string().trim().optional(),
        updatedAt: z.number().int().nonnegative().optional(),
        storagePath: z.string().trim().optional(),
      })
      .nullable()
      .optional(),
    pdfLogoPath: z.string().trim().optional(),
  })
  .passthrough()
  .optional();

const profileRowSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid().nullable().optional(),
    slug: z.string().trim().min(1).nullable().optional(),
    label: z.string().trim().min(1).nullable().optional(),
    dest_dir: z.string().trim().nullable().optional(),
    prompt_id: z.string().trim().nullable().optional(),
    pdf_template: z.string().trim().nullable().optional(),
    pdf_logo_url: z.string().trim().nullable().optional(),
    metadata: z
      .record(z.any())
      .nullable()
      .optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

const profileInputSchema = z
  .object({
    id: z.string().trim().optional(),
    label: z.string().trim().min(1),
    slug: z.string().trim().optional(),
    promptId: z.string().trim().optional(),
    pdfTemplate: z.string().trim().optional(),
    pdfLogoPath: z.string().trim().optional(),
    pdfLogo: z
      .object({
        fileName: z.string().trim().min(1),
        originalName: z.string().trim().optional(),
        updatedAt: z.number().int().nonnegative().optional(),
        storagePath: z.string().trim().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const workspaceInputSchema = z
  .object({
    name: z.string().trim().min(1),
    client: z.string().trim().optional(),
    color: z.string().trim().optional(),
    slug: z.string().trim().optional(),
    destDir: z.string().trim().optional(),
    versioningPolicy: versioningPolicySchema.optional(),
    defaultStatuses: z.array(z.string().trim()).optional(),
    projects: z.array(projectSchema.partial({ id: true, createdAt: true, updatedAt: true })).optional(),
    profiles: z.array(profileInputSchema).optional(),
  })
  .passthrough();

const workspaceUpdateSchema = workspaceInputSchema.partial();

const dateToTimestamp = (value) => {
  if (!value) {
    return Date.now();
  }
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return Date.now();
  }
  return parsed;
};

const normalizeProjects = (projects = [], { fallbackColor, fallbackStatuses } = {}) => {
  if (!Array.isArray(projects)) {
    return [];
  }
  return projects
    .map((project) => {
      const result = projectSchema.safeParse(project);
      if (!result.success) {
        return null;
      }
      const data = result.data;
      return {
        id: data.id || generateId('proj'),
        name: data.name,
        color: data.color || fallbackColor || '#6366f1',
        destDir: sanitizeDestDirInput(data.destDir || ''),
        statuses: Array.isArray(data.statuses) && data.statuses.length ? data.statuses : fallbackStatuses || [],
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
      };
    })
    .filter(Boolean);
};

const normalizeDefaultStatuses = (statuses) => {
  if (!Array.isArray(statuses)) {
    return [...DEFAULT_STATUSES];
  }
  const normalized = statuses
    .map((status) => String(status || '').trim())
    .filter(Boolean);
  return normalized.length ? normalized : [...DEFAULT_STATUSES];
};

const mapProfileRowToDomain = (row) => {
  const parsed = profileRowSchema.safeParse(row);
  if (!parsed.success) {
    console.warn('Profilo Supabase non valido, ignorato:', parsed.error.flatten());
    return null;
  }
  const value = parsed.data;
  const metadataResult = profileMetadataSchema.safeParse(value.metadata ?? {});
  const metadata = metadataResult.success ? metadataResult.data : {};
  const labelFromRow = typeof value.label === 'string' ? value.label.trim() : '';
  const label = labelFromRow || metadata?.label || value.slug || value.id;
  const slugFromRow = typeof value.slug === 'string' ? value.slug.trim() : '';
  const slugFromMetadata = typeof metadata?.slug === 'string' ? metadata.slug.trim() : '';
  const slugSource = slugFromRow || slugFromMetadata || label || value.id;
  const slug = sanitizeSlug(slugSource, value.id);
  const promptIdFromRow = typeof value.prompt_id === 'string' ? value.prompt_id.trim() : '';
  const pdfTemplateFromRow = typeof value.pdf_template === 'string' ? value.pdf_template.trim() : '';
  const pdfLogoPathFromRow = typeof value.pdf_logo_url === 'string' ? value.pdf_logo_url.trim() : '';
  let pdfLogo = null;
  if (metadata?.pdfLogo && typeof metadata.pdfLogo === 'object') {
    const sanitized = { ...metadata.pdfLogo };
    if (typeof sanitized.storagePath === 'string') {
      sanitized.storagePath = sanitized.storagePath.trim();
    }
    pdfLogo = sanitized;
  }
  return {
    id: value.id,
    label,
    slug,
    workspaceId: typeof value.workspace_id === 'string' ? value.workspace_id : '',
    promptId: promptIdFromRow || metadata?.promptId || '',
    pdfTemplate: pdfTemplateFromRow || metadata?.pdfTemplate || '',
    pdfLogoPath: pdfLogoPathFromRow || metadata?.pdfLogoPath || '',
    pdfLogo,
    createdAt: dateToTimestamp(value.created_at),
    updatedAt: dateToTimestamp(value.updated_at),
  };
};

const mapWorkspaceRowToDomain = (row, profileRows = []) => {
  const parsed = workspaceRowSchema.safeParse(row);
  if (!parsed.success) {
    console.warn('Workspace Supabase non valido, ignorato:', parsed.error.flatten());
    return null;
  }
  const value = parsed.data;
  const metadataResult = workspaceMetadataSchema.safeParse(value.metadata || {});
  const metadata = metadataResult.success ? metadataResult.data : {};
  const destDirFromMetadata = sanitizeDestDirInput(metadata?.destDir || '');
  const color = normalizeColor(metadata?.color || '');
  const versioning = versioningPolicySchema.safeParse(metadata?.versioningPolicy || {}).success
    ? {
        retentionLimit: metadata.versioningPolicy?.retentionLimit || DEFAULT_VERSIONING_POLICY.retentionLimit,
        freezeOnPublish:
          metadata.versioningPolicy?.freezeOnPublish ?? DEFAULT_VERSIONING_POLICY.freezeOnPublish,
        namingConvention:
          metadata.versioningPolicy?.namingConvention || DEFAULT_VERSIONING_POLICY.namingConvention,
      }
    : { ...DEFAULT_VERSIONING_POLICY };

  const defaultStatuses = normalizeDefaultStatuses(value.default_statuses);
  const projects = normalizeProjects(value.projects, {
    fallbackColor: color,
    fallbackStatuses: defaultStatuses,
  });

  const profiles = Array.isArray(profileRows)
    ? profileRows.map(mapProfileRowToDomain).filter(Boolean)
    : [];

  return {
    id: value.id,
    supabaseId: value.id,
    ownerId: value.owner_id,
    slug: value.slug,
    name: value.name,
    client: metadata?.client || value.description || value.name,
    color,
    destDir: destDirFromMetadata,
    versioningPolicy: versioning,
    defaultStatuses,
    projects,
    profiles,
    createdAt: dateToTimestamp(value.created_at),
    updatedAt: dateToTimestamp(value.updated_at),
  };
};

const workspaceToDbPayload = (workspace, { ownerId } = {}) => {
  if (!workspace || typeof workspace !== 'object') {
    return null;
  }
  const clientName = typeof workspace.client === 'string' && workspace.client.trim()
    ? workspace.client.trim()
    : workspace.name;
  const metadata = {
    client: clientName,
    color: normalizeColor(workspace.color || ''),
    versioningPolicy: {
      retentionLimit: workspace.versioningPolicy?.retentionLimit || DEFAULT_VERSIONING_POLICY.retentionLimit,
      freezeOnPublish:
        workspace.versioningPolicy?.freezeOnPublish ?? DEFAULT_VERSIONING_POLICY.freezeOnPublish,
      namingConvention:
        workspace.versioningPolicy?.namingConvention || DEFAULT_VERSIONING_POLICY.namingConvention,
    },
  };

  const sanitizedDestDir = sanitizeDestDirInput(workspace.destDir || '');
  if (sanitizedDestDir) {
    metadata.destDir = sanitizedDestDir;
  }

  const defaultStatuses = normalizeDefaultStatuses(workspace.defaultStatuses);
  const projects = normalizeProjects(workspace.projects, {
    fallbackColor: metadata.color,
    fallbackStatuses: defaultStatuses,
  });

  const normalizedOwnerId = (() => {
    if (typeof ownerId === 'string' && ownerId.trim()) {
      return ownerId.trim();
    }
    if (typeof workspace.ownerId === 'string' && workspace.ownerId.trim()) {
      return workspace.ownerId.trim();
    }
    if (typeof workspace.owner_id === 'string' && workspace.owner_id.trim()) {
      return workspace.owner_id.trim();
    }
    return '';
  })();

  const payload = {
    slug: sanitizeSlug(workspace.slug || workspace.name, workspace.name),
    name: workspace.name,
    description: clientName,
    logo_path: workspace.logoPath || null,
    metadata,
    projects,
    default_statuses: defaultStatuses,
  };

  if (normalizedOwnerId) {
    payload.owner_id = normalizedOwnerId;
  }

  return payload;
};

const profileToDbPayload = (workspaceId, profile) => {
  if (!workspaceId || !profile || typeof profile !== 'object') {
    return null;
  }
  const label = (() => {
    if (typeof profile.label === 'string' && profile.label.trim()) {
      return profile.label.trim();
    }
    if (typeof profile.slug === 'string' && profile.slug.trim()) {
      return profile.slug.trim();
    }
    if (typeof profile.id === 'string' && profile.id.trim()) {
      return profile.id.trim();
    }
    return 'Profilo';
  })();

  const promptId = typeof profile.promptId === 'string' ? profile.promptId.trim() : '';
  const pdfTemplate = typeof profile.pdfTemplate === 'string' ? profile.pdfTemplate.trim() : '';
  const pdfLogoPath = typeof profile.pdfLogoPath === 'string' ? profile.pdfLogoPath.trim() : '';

  const metadata = {};
  if (profile.pdfLogo && typeof profile.pdfLogo === 'object') {
    const descriptor = { ...profile.pdfLogo };
    if (typeof descriptor.storagePath === 'string') {
      descriptor.storagePath = descriptor.storagePath.trim();
    }
    metadata.pdfLogo = descriptor;
  }
  if (pdfLogoPath) {
    metadata.pdfLogoPath = pdfLogoPath;
  }

  return {
    workspace_id: workspaceId,
    slug: sanitizeSlug(profile.slug || label || 'profilo', label || 'profilo'),
    label,
    prompt_id: promptId,
    pdf_template: pdfTemplate,
    pdf_logo_url: pdfLogoPath || null,
    metadata: Object.keys(metadata).length ? metadata : {},
  };
};

const fetchProfilesGroupedByWorkspace = async (workspaceIds) => {
  if (!Array.isArray(workspaceIds) || !workspaceIds.length) {
    return new Map();
  }
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('workspace_profiles')
    .select('*')
    .in('workspace_id', workspaceIds);
  if (error) {
    throw new Error(error.message || 'Impossibile leggere i profili dal database');
  }
  const grouped = new Map();
  (Array.isArray(data) ? data : []).forEach((row) => {
    const workspaceId = row?.workspace_id;
    if (!workspaceId) {
      return;
    }
    if (!grouped.has(workspaceId)) {
      grouped.set(workspaceId, []);
    }
    grouped.get(workspaceId).push(row);
  });
  return grouped;
};

const listWorkspacesFromDb = async (ownerId) => {
  const client = getSupabaseClient();
  let query = client.from('workspaces').select('*');
  if (typeof ownerId === 'string' && ownerId.trim()) {
    query = query.eq('owner_id', ownerId.trim());
  }
  const { data, error } = await query.order('created_at', { ascending: true, nullsLast: true });
  if (error) {
    throw new Error(error.message || 'Impossibile recuperare i workspace');
  }
  const rows = Array.isArray(data) ? data : [];
  const ids = rows.map((row) => row.id);
  const profileMap = await fetchProfilesGroupedByWorkspace(ids);
  return rows
    .map((row) => mapWorkspaceRowToDomain(row, profileMap.get(row.id)))
    .filter(Boolean);
};

const getWorkspaceFromDb = async (workspaceId, { ownerId } = {}) => {
  if (!workspaceId) {
    return null;
  }
  const client = getSupabaseClient();
  let query = client.from('workspaces').select('*').eq('id', workspaceId);
  if (typeof ownerId === 'string' && ownerId.trim()) {
    query = query.eq('owner_id', ownerId.trim());
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message || 'Impossibile recuperare il workspace');
  }
  if (!data) {
    return null;
  }
  const profileMap = await fetchProfilesGroupedByWorkspace([workspaceId]);
  return mapWorkspaceRowToDomain(data, profileMap.get(workspaceId));
};

const insertWorkspaceIntoDb = async (payload, { ownerId } = {}) => {
  const client = getSupabaseClient();
  const workspacePayload = workspaceToDbPayload(payload, { ownerId });
  if (!workspacePayload) {
    throw new Error('Payload workspace non valido');
  }
  const { data, error } = await client
    .from('workspaces')
    .insert(workspacePayload)
    .select('*')
    .single();
  if (error) {
    throw new Error(error.message || 'Impossibile creare il workspace');
  }
  return mapWorkspaceRowToDomain(data, []);
};

const updateWorkspaceInDb = async (workspaceId, workspace, { ownerId } = {}) => {
  if (!workspaceId) {
    throw new Error('workspaceId obbligatorio');
  }
  const client = getSupabaseClient();
  const workspacePayload = workspaceToDbPayload(workspace, { ownerId });
  if (!workspacePayload) {
    throw new Error('Workspace non valido');
  }
  const { data, error } = await client
    .from('workspaces')
    .update(workspacePayload)
    .eq('id', workspaceId)
    .select('*')
    .single();
  if (error) {
    throw new Error(error.message || 'Impossibile aggiornare il workspace');
  }
  const profileMap = await fetchProfilesGroupedByWorkspace([workspaceId]);
  return mapWorkspaceRowToDomain(data, profileMap.get(workspaceId));
};

const deleteWorkspaceFromDb = async (workspaceId) => {
  if (!workspaceId) {
    throw new Error('workspaceId obbligatorio');
  }
  const client = getSupabaseClient();
  const { error } = await client.from('workspaces').delete().eq('id', workspaceId);
  if (error) {
    throw new Error(error.message || 'Impossibile eliminare il workspace');
  }
  return true;
};

const listProfilesForWorkspace = async (workspaceId) => {
  if (!workspaceId) {
    return [];
  }
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('workspace_profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true, nullsLast: true });
  if (error) {
    throw new Error(error.message || 'Impossibile recuperare i profili del workspace');
  }
  return (Array.isArray(data) ? data : []).map(mapProfileRowToDomain).filter(Boolean);
};

const insertProfileIntoDb = async (workspaceId, profile) => {
  const client = getSupabaseClient();
  const dbPayload = profileToDbPayload(workspaceId, profile);
  if (!dbPayload) {
    throw new Error('Profilo non valido');
  }
  const { data, error } = await client
    .from('workspace_profiles')
    .insert(dbPayload)
    .select('*')
    .single();
  if (error) {
    throw new Error(error.message || 'Impossibile creare il profilo');
  }
  return mapProfileRowToDomain(data);
};

const updateProfileInDb = async (workspaceId, profileId, profile) => {
  const client = getSupabaseClient();
  const dbPayload = profileToDbPayload(workspaceId, profile);
  if (!dbPayload) {
    throw new Error('Profilo non valido');
  }
  const { data, error } = await client
    .from('workspace_profiles')
    .update(dbPayload)
    .eq('id', profileId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();
  if (error) {
    throw new Error(error.message || 'Impossibile aggiornare il profilo');
  }
  return mapProfileRowToDomain(data);
};

const deleteProfileFromDb = async (workspaceId, profileId) => {
  const client = getSupabaseClient();
  const { error } = await client
    .from('workspace_profiles')
    .delete()
    .eq('id', profileId)
    .eq('workspace_id', workspaceId);
  if (error) {
    throw new Error(error.message || 'Impossibile eliminare il profilo');
  }
  return true;
};

const findWorkspaceByProfileId = async (profileId) => {
  if (!profileId) {
    return null;
  }
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('workspace_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || 'Impossibile recuperare il profilo richiesto');
  }
  if (!data?.workspace_id) {
    return null;
  }
  return getWorkspaceFromDb(data.workspace_id);
};

const normalizeWorkspaceProfiles = (profiles, { existingProfiles } = {}) => {
  if (!Array.isArray(profiles)) {
    return Array.isArray(existingProfiles) ? existingProfiles : [];
  }

  const previousById = new Map();
  if (Array.isArray(existingProfiles)) {
    existingProfiles.forEach((profile) => {
      if (profile && typeof profile === 'object' && profile.id) {
        previousById.set(profile.id, profile);
      }
    });
  }

  const seen = new Set();
  const now = Date.now();

  return profiles
    .map((profile) => {
      if (!profile || typeof profile !== 'object') {
        return null;
      }

      const rawId = typeof profile.id === 'string' ? profile.id.trim() : '';
      const id = rawId || generateId('profile');
      if (seen.has(id)) {
        return null;
      }

      const previous = previousById.get(id) || {};

      const label = String(profile.label ?? previous.label ?? '').trim();
      if (!label) {
        return null;
      }

      const slug = sanitizeSlug(profile.slug || previous.slug || label, label);
      const promptId = typeof profile.promptId === 'string'
        ? profile.promptId.trim()
        : typeof previous.promptId === 'string'
          ? previous.promptId
          : '';
      const pdfTemplate = profile.pdfTemplate
        ? sanitizeStorageFileName(profile.pdfTemplate)
        : typeof previous.pdfTemplate === 'string'
          ? previous.pdfTemplate
          : '';
      const pdfLogoPath = typeof profile.pdfLogoPath === 'string'
        ? profile.pdfLogoPath.trim()
        : typeof previous.pdfLogoPath === 'string'
          ? previous.pdfLogoPath
          : '';
      const pdfLogo = profile.pdfLogo && typeof profile.pdfLogo === 'object'
        ? {
            fileName: sanitizeStorageFileName(
              profile.pdfLogo.fileName || profile.pdfLogoPath || previous?.pdfLogo?.fileName || 'logo.pdf',
              'logo.pdf'
            ),
            originalName: String(
              profile.pdfLogo.originalName ||
                profile.pdfLogo.fileName ||
                previous?.pdfLogo?.originalName ||
                ''
            ).trim(),
            updatedAt: Number.isFinite(profile.pdfLogo.updatedAt)
              ? Number(profile.pdfLogo.updatedAt)
              : Number.isFinite(previous?.pdfLogo?.updatedAt)
                ? Number(previous.pdfLogo.updatedAt)
                : now,
            storagePath:
              typeof profile.pdfLogo.storagePath === 'string' && profile.pdfLogo.storagePath.trim()
                ? profile.pdfLogo.storagePath.trim()
                : previous?.pdfLogo?.storagePath || '',
          }
        : previous?.pdfLogo && typeof previous.pdfLogo === 'object'
          ? { ...previous.pdfLogo }
          : null;

      const createdAt = Number.isFinite(previous.createdAt) ? previous.createdAt : now;

      seen.add(id);

      return {
        id,
        label,
        slug,
        promptId,
        pdfTemplate,
        pdfLogoPath,
        pdfLogo,
        createdAt,
        updatedAt: now,
      };
    })
    .filter(Boolean);
};

const validateWorkspaceProfiles = async (profiles, { prompts } = {}) => {
  if (!Array.isArray(profiles) || !profiles.length) {
    return [];
  }
  const errors = [];
  const promptIds = new Set(
    Array.isArray(prompts)
      ? prompts.map((prompt) => (prompt && typeof prompt === 'object' ? String(prompt.id || '').trim() : '')).filter(Boolean)
      : []
  );

  for (const profile of profiles) {
    if (!profile || typeof profile !== 'object') continue;
    const label = profile.label || profile.id;
    if (profile.promptId) {
      const normalizedPromptId = String(profile.promptId).trim();
      if (normalizedPromptId && !promptIds.has(normalizedPromptId)) {
        errors.push(`Il prompt selezionato per il profilo "${label}" non è valido.`);
      }
    }

    if (profile.pdfTemplate && !isPandocFallbackTemplate(profile.pdfTemplate)) {
      try {
        await resolveTemplateDescriptor(profile.pdfTemplate);
      } catch (error) {
        const reason =
          error instanceof TemplateResolutionError
            ? error.userMessage
            : error?.message || 'Template non valido';
        errors.push(`Il template PDF per il profilo "${label}" non è valido: ${reason}`);
      }
    }
  }

  return errors;
};

const parseBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
  }
  return false;
};

const extractProfilePayload = (body = {}) => {
  if (!body || typeof body !== 'object') {
    return {};
  }
  return {
    id: typeof body.id === 'string' ? body.id.trim() : undefined,
    label: typeof body.label === 'string' ? body.label.trim() : typeof body.name === 'string' ? body.name.trim() : '',
    slug: typeof body.slug === 'string' ? body.slug.trim() : '',
    promptId: typeof body.promptId === 'string' ? body.promptId.trim() : typeof body.prompt === 'string' ? body.prompt.trim() : '',
    pdfTemplate:
      typeof body.pdfTemplate === 'string'
        ? body.pdfTemplate.trim()
        : typeof body.template === 'string'
          ? body.template.trim()
          : '',
    pdfLogoPath: typeof body.pdfLogoPath === 'string' ? body.pdfLogoPath.trim() : '',
    removePdfLogo: parseBooleanFlag(body.removePdfLogo || body.clearPdfLogo),
  };
};

const profileForResponse = (workspaceId, profile) => {
  if (!profile || typeof profile !== 'object') {
    return null;
  }
  const rawLogoPath = typeof profile.pdfLogoPath === 'string' ? profile.pdfLogoPath.trim() : '';
  const logoDownloadPath = /^https?:\/\//i.test(rawLogoPath)
    ? rawLogoPath
    : '';
  return {
    ...profile,
    logoDownloadPath,
    pdfLogoUrl: rawLogoPath,
  };
};

const profilesForResponse = (workspaceId, profiles = []) => {
  if (!Array.isArray(profiles)) {
    return [];
  }
  return profiles
    .map((profile) => profileForResponse(workspaceId, profile))
    .filter(Boolean);
};

const upsertProjectInWorkspace = (workspace, { projectId, projectName, status }) => {
  if (!workspace) return { workspace, changed: false, project: null };
  const ws = { ...workspace };
  ws.projects = Array.isArray(ws.projects) ? ws.projects.map((project) => ({ ...project })) : [];
  let changed = false;
  let project = null;
  const trimmedName = projectName ? String(projectName).trim() : '';
  const normalizedProjectId = projectId ? String(projectId).trim() : '';

  if (normalizedProjectId) {
    project = ws.projects.find((proj) => proj.id === normalizedProjectId) || null;
  }

  if (!project && trimmedName) {
    project = ws.projects.find((proj) => proj.name.toLowerCase() === trimmedName.toLowerCase()) || null;
  }

  if (!project && trimmedName) {
    project = {
      id: generateId('proj'),
      name: trimmedName,
      color: ws.color,
      statuses: Array.isArray(ws.defaultStatuses) && ws.defaultStatuses.length ? [...ws.defaultStatuses] : [...DEFAULT_STATUSES],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    ws.projects.push(project);
    changed = true;
  }

  if (project && status) {
    const normalizedStatus = String(status).trim();
    if (normalizedStatus && (!Array.isArray(project.statuses) || !project.statuses.includes(normalizedStatus))) {
      project.statuses = Array.isArray(project.statuses) ? [...project.statuses, normalizedStatus] : [normalizedStatus];
      project.updatedAt = Date.now();
      changed = true;
    }
  }

  return { workspace: ws, changed, project };
};

const workspaceAssignmentForResponse = (workspace, project, status) => {
  if (!workspace) return null;
  const response = {
    id: workspace.id,
    name: workspace.name,
    client: workspace.client || workspace.name,
    color: workspace.color || '#6366f1',
    versioningPolicy: workspace.versioningPolicy || null,
  };
  if (project) {
    response.projectId = project.id;
    response.projectName = project.name;
    response.projectColor = project.color || workspace.color || '#6366f1';
    response.statusCatalog = Array.isArray(project.statuses) ? project.statuses : [];
  }
  if (status) {
    response.status = status;
  }
  return response;
};

const analyzeMarkdownStructure = async (mdPath, options = {}) => {
  const baseline = {
    headings: [],
    score: 0,
    missingSections: [],
    totalRecommended: 0,
    promptChecklist: null,
  };
  try {
    const content = await fsp.readFile(mdPath, 'utf8');
    const headingMatches = Array.from(content.matchAll(/^#{1,6}\s+(.+)$/gm)).map((match) => match[1].trim());
    const normalizedHeadings = headingMatches.map((heading) => heading.toLowerCase());

    const recommended = [
      { key: 'executive', labels: ['executive summary', 'sintesi esecutiva', 'overview'] },
      { key: 'goals', labels: ['obiettivi', 'goals', 'vision'] },
      { key: 'insights', labels: ['key insights', 'analisi', 'analysis'] },
      { key: 'actions', labels: ['action items', 'azioni', 'next steps'] },
      { key: 'risks', labels: ['rischi', 'risk register', 'mitigazioni'] },
    ];

    const missingSections = recommended.filter((section) => {
      return !normalizedHeadings.some((heading) =>
        section.labels.some((label) => heading.includes(label))
      );
    });

    const score = Math.round(
      ((recommended.length - missingSections.length) / (recommended.length || 1)) * 100
    );

    const bulletMatches = Array.from(content.matchAll(/^\s*[-*+]\s+.+$/gm));
    const hasCallouts = /::: (success|info|warning|note)/i.test(content);

    const promptDefinition = options?.prompt || null;
    const promptSections = normalizeChecklistSections(
      promptDefinition?.checklist?.sections || promptDefinition?.checklist
    );
    const promptMissing = promptSections.filter((section) => {
      const normalized = section.toLowerCase();
      return !normalizedHeadings.some((heading) => heading.includes(normalized));
    });
    const promptScore = promptSections.length
      ? Math.round(
        ((promptSections.length - promptMissing.length) / (promptSections.length || 1)) * 100
      )
      : null;

    return {
      ok: true,
      headings: headingMatches,
      score,
      missingSections: missingSections.map((section) => section.labels[0]),
      totalRecommended: recommended.length,
      bulletPoints: bulletMatches.length,
      hasCallouts,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      promptChecklist: promptSections.length
        ? {
          sections: promptSections,
          missing: promptMissing,
          score: promptScore,
          completed: promptSections.length - promptMissing.length,
          total: promptSections.length,
        }
        : null,
    };
  } catch (error) {
    return { ...baseline, ok: false, error: error && error.message ? error.message : String(error) };
  }
};

const buildWorkspaceBaseName = async (workspace, destDir, slug) => {
  const slugPart = sanitizeSlug(slug, 'sessione');
  const prefixParts = [];
  if (workspace?.slug) {
    prefixParts.push(sanitizeSlug(workspace.slug, 'workspace'));
  } else if (workspace?.client) {
    prefixParts.push(sanitizeSlug(workspace.client, 'workspace'));
  }
  prefixParts.push(slugPart);
  const joined = prefixParts.filter(Boolean).join('_').replace(/_+/g, '_');
  const naming = workspace?.versioningPolicy?.namingConvention || 'timestamped';

  if (naming === 'incremental') {
    try {
      const entries = await fsp.readdir(destDir);
      const regex = new RegExp(`^${joined}_v(\d+)$`);
      const lastVersion = entries.reduce((max, entry) => {
        const match = entry.match(regex);
        if (match) {
          const version = parseInt(match[1], 10);
          return Number.isFinite(version) && version > max ? version : max;
        }
        return max;
      }, 0);
      const next = lastVersion + 1;
      return `${joined}_v${String(next).padStart(2, '0')}`;
    } catch {
      return `${joined}_v01`;
    }
  }

  return `${yyyymmddHHMMSS()}_${joined}`;
};

const UP_BASE = path.join(os.tmpdir(), 'rec2pdf_uploads');
if (!fs.existsSync(UP_BASE)) fs.mkdirSync(UP_BASE, { recursive: true });

const uploadMiddleware = multer({ dest: UP_BASE });
const KNOWLEDGE_UPLOAD_BASE = path.join(os.tmpdir(), 'rec2pdf_knowledge_uploads');
if (!fs.existsSync(KNOWLEDGE_UPLOAD_BASE)) fs.mkdirSync(KNOWLEDGE_UPLOAD_BASE, { recursive: true });
const knowledgeUpload = multer({
  dest: KNOWLEDGE_UPLOAD_BASE,
  limits: {
    files: 20,
  },
});
const KNOWLEDGE_UPLOAD_FIELDS = new Set(['files', 'file', 'documents', 'document']);
const knowledgeUploadMiddleware = knowledgeUpload.any();
const profileUpload = uploadMiddleware.single('pdfLogo');
const optionalProfileUpload = (req, res, next) => {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    return profileUpload(req, res, next);
  }
  return next();
};

const ensureTempFileHasExtension = async (file, allowedExtensions = VALID_LOGO_EXTENSIONS) => {
  if (!file) return null;
  const originalName = file.originalname || '';
  const currentPath = file.path;
  const ext = path.extname(originalName).toLowerCase();
  if (!ext || (allowedExtensions && !allowedExtensions.has(ext))) {
    return currentPath;
  }
  if (currentPath.endsWith(ext)) {
    return currentPath;
  }
  const nextPath = `${currentPath}${ext}`;
  try {
    await fsp.rename(currentPath, nextPath);
    file.path = nextPath;
    file.destination = path.dirname(nextPath);
    file.filename = path.basename(nextPath);
    return nextPath;
  } catch (error) {
    console.warn(`⚠️  Impossibile rinominare il file temporaneo ${currentPath}: ${error.message}`);
    return currentPath;
  }
};

const SUPABASE_AUDIO_BUCKET = 'audio-uploads';
const SUPABASE_TEXT_BUCKET = 'text-uploads';
const SUPABASE_PROCESSED_BUCKET = 'processed-media';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSpeakerLabelVariants = (label = '') => {
  if (!label || typeof label !== 'string') return [];
  const normalized = label.trim();
  if (!normalized) return [];
  const variants = new Set();
  variants.add(normalized);
  variants.add(normalized.toUpperCase());
  variants.add(normalized.toLowerCase());
  const spaced = normalized.replace(/_/g, ' ');
  if (spaced !== normalized) {
    variants.add(spaced);
    variants.add(spaced.toUpperCase());
    variants.add(spaced.toLowerCase());
    variants.add(spaced.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  const speakerMatch = normalized.match(/speaker[_\s-]*(\d+)/i);
  if (speakerMatch) {
    const rawNumber = speakerMatch[1] || '';
    const parsed = parseInt(rawNumber, 10);
    if (Number.isFinite(parsed)) {
      variants.add(`Speaker ${parsed}`);
      if (parsed === 0 || /^0/.test(rawNumber)) {
        variants.add(`Speaker ${parsed + 1}`);
      }
    }
  }
  return Array.from(variants);
};

const sanitizeSpeakerMapInput = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const sanitized = {};
  for (const [labelRaw, nameRaw] of Object.entries(raw)) {
    if (typeof labelRaw !== 'string') continue;
    const label = labelRaw.trim();
    if (!label) continue;
    const mappedName =
      typeof nameRaw === 'string'
        ? nameRaw.trim()
        : typeof nameRaw === 'number'
          ? String(nameRaw).trim()
          : '';
    if (!mappedName) continue;
    sanitized[label] = mappedName;
  }
  return sanitized;
};

const applySpeakerMapToContent = (content, mapping = {}) => {
  if (typeof content !== 'string' || !mapping || typeof mapping !== 'object') {
    return content;
  }

  const preparedMapping = Object.entries(mapping)
    .map(([label, mappedName]) => {
      if (typeof label !== 'string') return null;
      const trimmedName = typeof mappedName === 'string' ? mappedName.trim() : '';
      const normalizedLabel = label.trim();
      if (!normalizedLabel || !trimmedName) return null;
      return {
        original: normalizedLabel,
        mappedName: trimmedName,
        variants: buildSpeakerLabelVariants(normalizedLabel).map((variant) => variant.toLowerCase()),
      };
    })
    .filter(Boolean);

  if (!preparedMapping.length) {
    return content;
  }

  const resolveMappedSpeaker = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!normalized) return '';
    for (const entry of preparedMapping) {
      if (entry.variants.includes(normalized)) {
        return entry.mappedName;
      }
    }
    return '';
  };

  const mapTranscriptCollection = (collection) => {
    if (!Array.isArray(collection) || !collection.length) {
      return collection;
    }
    return collection.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const next = { ...item };
      const candidates = [
        next.raw_label,
        next.rawLabel,
        next.speaker,
      ];
      let mappedSpeaker = '';
      for (const candidate of candidates) {
        mappedSpeaker = resolveMappedSpeaker(candidate);
        if (mappedSpeaker) break;
      }
      if (mappedSpeaker) {
        next.speaker = mappedSpeaker;
      }
      return next;
    });
  };

  const applyMappingToBody = (body) => {
    let result = body;
    preparedMapping.forEach(({ original, mappedName }) => {
      const variants = buildSpeakerLabelVariants(original);
      variants.forEach((token) => {
        if (!token) return;
        const trimmedToken = token.trim();
        if (!trimmedToken) return;
        const quotedPattern = new RegExp(`(['"])\\s*${escapeRegExp(trimmedToken)}\\s*(['"])`, 'gi');
        result = result.replace(quotedPattern, (_match, openQuote, closeQuote) => {
          return `${openQuote}${mappedName}${closeQuote}`;
        });
      });
      variants.forEach((token) => {
        if (!token) return;
        const trimmedToken = token.trim();
        if (!trimmedToken) return;
        const colonPattern = new RegExp(`(['"]?)(\\*\\*)?${escapeRegExp(trimmedToken)}(\\*\\*)?(['"]?)(\\s*:)`, 'gi');
        result = result.replace(colonPattern, (_match, openQuote, _leading, _trailing, closeQuote, suffix) => {
          const quote = openQuote && openQuote === closeQuote ? openQuote : '';
          const normalizedSuffix = suffix && suffix.includes(':') ? suffix : ':';
          return `${quote}**${mappedName}**${quote}${normalizedSuffix}`;
        });
      });
      variants.forEach((token) => {
        if (!token) return;
        const trimmedToken = token.trim();
        if (!trimmedToken) return;
        const barePattern = new RegExp(`(['"]?)(\\*\\*)?${escapeRegExp(trimmedToken)}(\\*\\*)?(['"]?)`, 'gi');
        result = result.replace(barePattern, (_match, openQuote, _leading, _trailing, closeQuote) => {
          const quote = openQuote && openQuote === closeQuote ? openQuote : '';
          return `${quote}**${mappedName}**${quote}`;
        });
      });
    });
    return result;
  };

  const match = FRONT_MATTER_REGEX.exec(content);
  if (!match) {
    return applyMappingToBody(content);
  }

  const frontMatterSrc = match[1];
  const newline = match[0].includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = typeof match[2] === 'string' ? match[2] : '';
  const body = content.slice(match[0].length);

  let updatedFrontMatter = match[0];
  try {
    const yamlDoc = frontMatterSrc ? yaml.load(frontMatterSrc) || {} : {};
    if (yamlDoc && typeof yamlDoc === 'object') {
      if (Array.isArray(yamlDoc.transcript)) {
        yamlDoc.transcript = mapTranscriptCollection(yamlDoc.transcript);
      }
      if (yamlDoc.metadata && typeof yamlDoc.metadata === 'object') {
        if (Array.isArray(yamlDoc.metadata.transcript)) {
          yamlDoc.metadata.transcript = mapTranscriptCollection(yamlDoc.metadata.transcript);
        }
      }
    }
    const dumped = yaml.dump(yamlDoc).replace(/\r\n/g, '\n').trimEnd();
    const normalizedDump = dumped.split('\n').join(newline);
    updatedFrontMatter = `---${newline}${normalizedDump}${newline}---${trailingNewline}`;
  } catch (error) {
    console.warn('⚠️ Impossibile applicare mapping speaker al front matter:', error?.message || error);
    updatedFrontMatter = match[0];
  }

  const mappedBody = applyMappingToBody(body);
  return `${updatedFrontMatter}${mappedBody}`;
};



const extractLayoutFromMarkdown = (content = '') => {
  if (typeof content !== 'string' || !content.startsWith('---')) return '';
  const closingIndex = content.indexOf('\n---', 3);
  if (closingIndex === -1) return '';
  const block = content.slice(3, closingIndex).split(/\r?\n/);
  let layout = '';
  let inPdfRules = false;
  for (const rawLine of block) {
    const line = rawLine;
    if (!line.trim()) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      inPdfRules = line.trim().startsWith('pdfRules:');
      if (!inPdfRules && !layout && line.trim().startsWith('layout:')) {
        layout = line.split(':').slice(1).join(':').trim();
      }
      continue;
    }
    if (inPdfRules) {
      const trimmed = line.trim();
      if (trimmed.startsWith('layout:')) {
        layout = trimmed.split(':').slice(1).join(':').trim();
      }
    }
  }
  return layout.replace(/^['"]|['"]$/g, '');
};

const resolveTemplateFromLayout = async (layout, { logger } = {}) => {
  if (!layout) return null;
  const normalized = layout.trim().toLowerCase();
  let candidate = layout.trim();
  if (DEFAULT_LAYOUT_TEMPLATE_MAP.has(normalized)) {
    candidate = DEFAULT_LAYOUT_TEMPLATE_MAP.get(normalized);
  }
  try {
    const descriptor = await resolveTemplateDescriptor(candidate);
    if (logger) {
      logger(`📄 Template layout: ${descriptor.fileName}`, 'publish', 'info');
    }
    return descriptor;
  } catch (error) {
    if (logger) {
      const reason =
        error instanceof TemplateResolutionError ? error.userMessage : error?.message || error;
      logger(`⚠️ Template layout non accessibile: ${reason}`, 'publish', 'warning');
    }
    return null;
  }
};

const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn(`⚠️  Impossibile rimuovere file temporaneo ${filePath}: ${error.message}`);
    }
  }
};

const safeRemoveDir = async (dirPath) => {
  if (!dirPath) return;
  try {
    await fsp.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn(`⚠️  Impossibile rimuovere directory temporanea ${dirPath}: ${error.message}`);
    }
  }
};

const KNOWLEDGE_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv']);
const KNOWLEDGE_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg']);
const KNOWLEDGE_PDF_EXTENSIONS = new Set(['.pdf']);
const KNOWLEDGE_CHUNK_SIZE = 250;
const KNOWLEDGE_CHUNK_OVERLAP = 50;
const KNOWLEDGE_EMBED_BATCH_SIZE = 50;

const normalizeKnowledgeText = (text = '') => {
  if (!text) {
    return '';
  }
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// CANCELLA qualsiasi import di langchain o text_splitter in cima al file. Non ci servono più.

// ... (resto del file) ...

// TROVA E SOSTITUISCI LA VECCHIA FUNZIONE createKnowledgeChunks CON QUESTA NUOVA VERSIONE:

// TROVA E SOSTITUISCI LA VECCHIA FUNZIONE createKnowledgeChunks CON QUESTA VERSIONE FINALE

/**
 * Divide un testo in chunk semanticamente coerenti.
 * Questa è un'implementazione custom ispirata al RecursiveCharacterTextSplitter di LangChain,
 * ma senza dipendenze esterne.
 * 
 * @param {string} text - Il testo da dividere.
 * @param {object} options - Opzioni di chunking.
 * @param {number} [options.chunkSize=1500] - La dimensione massima target per ogni chunk, in caratteri.
 * @param {number} [options.chunkOverlap=200] - Il numero di caratteri di sovrapposizione tra chunk consecutivi.
 * @returns {string[]} Un array di chunk di testo.
 */
const createKnowledgeChunks = (text, { chunkSize = 1500, chunkOverlap = 200 } = {}) => {
  const normalizedText = (text || '').trim();
  if (!normalizedText) {
    return [];
  }

  // Se il testo è già più piccolo della dimensione del chunk, non c'è bisogno di dividerlo.
  if (normalizedText.length <= chunkSize) {
    console.log(`[Chunking] Documento breve, creato 1 chunk.`);
    return [normalizedText];
  }

  // Gerarchia dei separatori, dal più significativo (paragrafo) al meno significativo (carattere).
  const separators = ['\n\n', '\n', '. ', '?', '!', ' ', ''];

  /**
   * Funzione ricorsiva che divide il testo.
   * @param {string} textToSplit - Il pezzo di testo da dividere.
   * @param {string[]} currentSeparators - La lista di separatori da provare.
   * @returns {string[]} Un array di pezzi di testo più piccoli.
   */
  function splitRecursively(textToSplit, currentSeparators) {
    const finalChunks = [];
    
    // Se il testo è già abbastanza piccolo, abbiamo finito.
    if (textToSplit.length <= chunkSize) {
      return [textToSplit];
    }

    // Prendi il separatore più importante dalla lista.
    const separator = currentSeparators[0];
    const nextSeparators = currentSeparators.slice(1);

    // Se non ci sono più separatori, dividiamo forzatamente per dimensione.
    if (separator === '') {
      for (let i = 0; i < textToSplit.length; i += chunkSize) {
        finalChunks.push(textToSplit.slice(i, i + chunkSize));
      }
      return finalChunks;
    }

    // Prova a dividere con il separatore corrente.
    const splits = textToSplit.split(separator);
    let currentChunk = '';

    for (const part of splits) {
      const partWithSeparator = `${part}${separator}`;
      // Se l'aggiunta del nuovo pezzo supera la dimensione, salva il chunk corrente e inizia uno nuovo.
      if (currentChunk.length + partWithSeparator.length > chunkSize) {
        // Se il chunk corrente è valido, salvalo.
        if (currentChunk.length > 0) {
          finalChunks.push(currentChunk);
        }
        // Il nuovo pezzo diventa il chunk corrente.
        currentChunk = partWithSeparator;
      } else {
        // Altrimenti, aggiungi il pezzo al chunk corrente.
        currentChunk += partWithSeparator;
      }
    }
    // Aggiungi l'ultimo chunk rimasto.
    if (currentChunk) {
      finalChunks.push(currentChunk);
    }

    // Controlla se alcuni dei chunk generati sono ancora troppo grandi e, in caso,
    // dividili ulteriormente usando i separatori meno importanti.
    const furtherSplitChunks = finalChunks.flatMap(chunk => {
      if (chunk.length > chunkSize) {
        return splitRecursively(chunk, nextSeparators);
      }
      return chunk;
    });

    return furtherSplitChunks;
  }

  // Avvia il processo di divisione.
  const initialChunks = splitRecursively(normalizedText, separators);

  // Aggiungi la sovrapposizione.
  if (chunkOverlap > 0 && initialChunks.length > 1) {
    const overlappedChunks = [];
    for (let i = 0; i < initialChunks.length; i++) {
      const currentChunk = initialChunks[i];
      if (i > 0) {
        const prevChunk = initialChunks[i - 1];
        const overlap = prevChunk.slice(-chunkOverlap);
        overlappedChunks.push(`${overlap}\n...\n${currentChunk}`);
      } else {
        overlappedChunks.push(currentChunk);
      }
    }
    const finalChunks = overlappedChunks.filter(c => c.trim().length > 20); // Filtra chunk troppo piccoli
    console.log(`[Chunking] Documento diviso in ${finalChunks.length} chunk (strategia: semantica custom, size=${chunkSize}, overlap=${chunkOverlap}).`);
    return finalChunks;
  }

  const finalChunks = initialChunks.filter(c => c.trim().length > 20);
  console.log(`[Chunking] Documento diviso in ${finalChunks.length} chunk (strategia: semantica custom, size=${chunkSize}).`);
  return finalChunks;
};

const extractSourceFileName = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') {
    return '';
  }
  return (
    metadata.sourceFile ||
    metadata.source ||
    metadata.fileName ||
    metadata.filename ||
    metadata.originalName ||
    metadata.path ||
    ''
  );
};

const transcribeAudioForKnowledge = async (filePath) => {
  if (!filePath) {
    return '';
  }
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rec2pdf_knowledge_audio_'));
  try {
    const baseName = path.basename(filePath, path.extname(filePath)) || `audio_${Date.now()}`;
    const wavPath = path.join(tempDir, `${baseName}.wav`);
    const ff = await run('ffmpeg', ['-y', '-i', filePath, '-ac', '1', '-ar', '16000', wavPath]);
    if (ff.code !== 0) {
      throw new Error(ff.stderr || 'ffmpeg failed');
    }
    const whisperCmd = [
      'whisperx',
      JSON.stringify(wavPath),
      '--language it',
      '--model small',
      '--device cpu',
      '--compute_type float32',
      '--output_format txt',
      `--output_dir ${JSON.stringify(tempDir)}`,
    ].join(' ');
    const w = await run('bash', ['-lc', whisperCmd]);
    if (w.code !== 0) {
      throw new Error(w.stderr || w.stdout || 'whisper failed');
    }
    const candidates = (await fsp.readdir(tempDir)).filter((entry) => entry.endsWith('.txt'));
    if (!candidates.length) {
      throw new Error('Trascrizione non trovata');
    }
    const preferred = candidates.find((entry) => entry.startsWith(baseName)) || candidates[0];
    const transcriptPath = path.join(tempDir, preferred);
    const transcript = await fsp.readFile(transcriptPath, 'utf8');
    return transcript;
  } finally {
    await safeRemoveDir(tempDir);
  }
};

const extractTextFromKnowledgeFile = async (file) => {
  if (!file || !file.path) {
    return '';
  }
  const originalName = typeof file.originalName === 'string' ? file.originalName : file.originalname;
  const ext = path.extname(originalName || file.path).toLowerCase();
  const mime = typeof file.mimetype === 'string' ? file.mimetype.toLowerCase() : '';

  if (KNOWLEDGE_TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/')) {
    return await fsp.readFile(file.path, 'utf8');
  }

  if (KNOWLEDGE_PDF_EXTENSIONS.has(ext) || mime === 'application/pdf') {
    const buffer = await fsp.readFile(file.path);
    const parsed = await pdfParse(buffer);
    return parsed?.text || '';
  }

  if (KNOWLEDGE_AUDIO_EXTENSIONS.has(ext) || mime.startsWith('audio/')) {
    return await transcribeAudioForKnowledge(file.path);
  }

  return '';
};

const buildKnowledgeMetadata = (
  file,
  { ingestionId, chunkIndex, totalChunks, projectId, projectName, projectOriginalId }
) => {
  const originalName = typeof file.originalName === 'string' ? file.originalName : file.originalname;
  const metadata = {
    sourceFile: originalName || path.basename(file.path),
    source: originalName || path.basename(file.path),
    ingestionId,
    chunkIndex: Number.isFinite(chunkIndex) ? chunkIndex : 0,
    totalChunks: Number.isFinite(totalChunks) ? totalChunks : undefined,
    ingestedAt: new Date().toISOString(),
  };
  if (file.mimetype) {
    metadata.mimeType = file.mimetype;
  }
  if (Number.isFinite(file.size)) {
    metadata.size = file.size;
  }
  metadata.projectId = projectId || null;
  metadata.projectName = projectName || null;
  metadata.projectOriginalId = projectOriginalId || null;
  return metadata;
};

const knowledgeIngestionQueue = [];
let knowledgeIngestionProcessing = false;

const processKnowledgeQueue = async () => {
  if (knowledgeIngestionProcessing) {
    return;
  }
  knowledgeIngestionProcessing = true;
  while (knowledgeIngestionQueue.length) {
    const task = knowledgeIngestionQueue.shift();
    try {
      await processKnowledgeTask(task);
    } catch (error) {
      console.error('Errore processo ingestion knowledge:', error);
    }
  }
  knowledgeIngestionProcessing = false;
};

const enqueueKnowledgeIngestion = (task) => {
  if (!task) {
    return;
  }
  knowledgeIngestionQueue.push(task);
  setImmediate(processKnowledgeQueue);
};

const cleanupKnowledgeFiles = async (files = []) => {
  await Promise.all(
    (Array.isArray(files) ? files : []).map(async (file) => {
      try {
        await safeUnlink(file.path);
      } catch (error) {
        if (error && error.code !== 'ENOENT') {
          console.warn(`⚠️  Impossibile rimuovere file knowledge ${file.path}: ${error.message}`);
        }
      }
    })
  );
};

const normalizeKnowledgeFieldName = (fieldName) => {
  if (!fieldName) {
    return '';
  }
  const trimmed = String(fieldName).trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\[\]$/, '').toLowerCase();
};

const processKnowledgeTask = async (task = {}) => {
  const {
    workspaceId,
    projectId = '',
    projectOriginalId = '',
    projectName = '',
    files = [],
    ingestionId,
  } = task;
  if (!workspaceId || !Array.isArray(files) || !files.length) {
    await cleanupKnowledgeFiles(files);
    return;
  }

  const scopeIdentifiers = resolveProjectScopeIdentifiers(projectId || projectOriginalId);
  const normalizedProjectId = scopeIdentifiers.canonicalId;
  const normalizedProjectOriginalId = sanitizeProjectIdentifier(projectOriginalId) || scopeIdentifiers.originalId;
  const normalizedProjectName = sanitizeProjectName(projectName);

  if (!supabase) {
    console.warn('⚠️  Supabase non configurato: impossibile salvare la knowledge base.');
    await cleanupKnowledgeFiles(files);
    return;
  }

  let aiEmbedder;
  let embeddingProviderId = '';
  try {
    const embeddingProvider = resolveAiProvider('embedding');
    embeddingProviderId = embeddingProvider.id;
    aiEmbedder = getAIService(embeddingProvider.id, embeddingProvider.apiKey, embeddingProvider.model);
  } catch (error) {
    const detail = error?.message ? ` ${error.message}` : '';
    console.warn(
      `⚠️  Client embedding (${embeddingProviderId || 'default'}) non configurato: impossibile generare embedding per la knowledge base.${detail}`
    );
    await cleanupKnowledgeFiles(files);
    return;
  }

  for (const file of files) {
    const fileLabel = file?.originalName || file?.originalname || path.basename(file?.path || '') || 'file';
    try {
      const rawText = await extractTextFromKnowledgeFile(file);
      const normalized = normalizeKnowledgeText(rawText);
      const chunks = createKnowledgeChunks(normalized);
      if (!chunks.length) {
        console.warn(`⚠️  Nessun contenuto indicizzabile per ${fileLabel}`);
        continue;
      }

      // Loop through each chunk individually instead of batching
      for (const [index, chunk] of chunks.entries()) {
        let embedding;
        try {
          // Generate embedding for a single chunk
          embedding = await aiEmbedder.generateEmbedding(chunk);
        } catch (error) {
          console.error('Errore catturato durante la chiamata a aiEmbedder.generateEmbedding per un singolo chunk:', error);
          throw new Error(error?.message || 'Errore generazione embedding per singolo chunk');
        }

        // The result for a single chunk should be a flat array of numbers
        if (!Array.isArray(embedding) || (embedding.length > 0 && Array.isArray(embedding[0]))) {
          console.error('--- DEBUG EMBEDDING (SINGLE CHUNK) ---');
          console.error('Chunk inviato:', chunk);
          console.error('Risposta embedding non valida ricevuta:', JSON.stringify(embedding, null, 2));
          console.error('--- FINE DEBUG ---');
          throw new Error('Risposta embedding non valida per il singolo chunk.');
        }

        const payload = {
          id: crypto.randomUUID(),
          workspace_id: workspaceId,
          project_id: normalizedProjectId || null,
          content: chunk,
          embedding: embedding,
          metadata: buildKnowledgeMetadata(file, {
            ingestionId,
            chunkIndex: index + 1,
            totalChunks: chunks.length,
            projectId: normalizedProjectId || null,
            projectName: normalizedProjectName || null,
            projectOriginalId: normalizedProjectOriginalId || null,
          }),
        };

        const { error: insertError } = await supabase.from('knowledge_chunks').insert(payload);
        if (insertError) {
          throw new Error(insertError.message || 'Inserimento Supabase fallito per il singolo chunk');
        }
      }

      const projectLabel = normalizedProjectId
        ? ` (progetto ${normalizedProjectName || normalizedProjectOriginalId || normalizedProjectId})`
        : '';
      console.log(`📚 Knowledge base aggiornata${projectLabel} (${fileLabel} → ${chunks.length} chunk)`);
    } catch (error) {
      console.error(`Errore ingestione knowledge per ${fileLabel}:`, error);
    } finally {
      try {
        await safeUnlink(file.path);
      } catch (error) {
        if (error && error.code !== 'ENOENT') {
          console.warn(`⚠️  Impossibile rimuovere file knowledge ${file.path}: ${error.message}`);
        }
      }
    }
  }
};
const isSupabaseHtmlError = (error) => {
  if (!error) return false;
  const message = typeof error.message === 'string' ? error.message : '';
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  return normalized.includes('unexpected token <') || normalized.includes('<html');
};

const buildSupabaseErrorHint = (error) => {
  if (!error) return '';
  const message = typeof error.message === 'string' ? error.message : '';
  if (!message) {
    return '';
  }
  const normalized = message.toLowerCase();
  if (normalized.includes('unexpected token <')) {
    return 'Verifica che SUPABASE_URL punti al dominio API del progetto (es. https://<id>.supabase.co) e che non ci siano proxy che restituiscono HTML.';
  }
  if (
    normalized.includes('fetch failed') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('etimedout')
  ) {
    return 'Controlla la connettività verso Supabase o eventuali firewall intermedi.';
  }
  return '';
};

const uploadFileToBucket = async (bucket, objectPath, buffer, contentType, options = {}) => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  const attempts = Math.max(1, Number(options.attempts) || 3);
  const retryDelay = Number(options.retryDelayMs) || 250;
  const cacheControl =
    options.cacheControl !== undefined && options.cacheControl !== null
      ? String(options.cacheControl)
      : '0';

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      cacheControl,
      contentType: contentType || 'application/octet-stream',
      upsert: options.upsert ?? true,
    });

    if (!error) {
      return;
    }

    lastError = error;
    const status = Number(error.statusCode || error.status) || 0;
    const retryableHtml = isSupabaseHtmlError(error);
    const retryableStatus = status >= 500 || status === 0;
    if (attempt < attempts && (retryableHtml || retryableStatus)) {
      await sleep(retryDelay * attempt);
      continue;
    }
    break;
  }

  const hint = buildSupabaseErrorHint(lastError);
  const reason = (lastError && lastError.message) || 'errore sconosciuto';
  const details = hint ? `${reason}. ${hint}` : reason;
  throw new Error(`Upload fallito su Supabase (${bucket}/${objectPath}): ${details}`);
};

const buildSupabasePublicUrl = (bucket, objectPath) => {
  const normalizedBucket = String(bucket || '').trim();
  const normalizedPath = String(objectPath || '').trim().replace(/^\/+/, '');
  if (!normalizedBucket || !normalizedPath) {
    throw new Error('Percorso storage non valido per URL pubblico');
  }
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL non configurato: impossibile generare URL pubblico');
  }
  try {
    const origin = new URL(SUPABASE_URL);
    return new URL(`/storage/v1/object/public/${normalizedBucket}/${normalizedPath}`, origin).toString();
  } catch (error) {
    const message = error?.message || 'URL Supabase non valido';
    throw new Error(`Impossibile generare URL pubblico: ${message}`);
  }
};

const extractLogoStoragePath = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const bucketIndex = segments.findIndex((segment) => segment === 'logos');
      if (bucketIndex >= 0 && bucketIndex < segments.length - 1) {
        return segments.slice(bucketIndex + 1).join('/');
      }
      return '';
    } catch {
      return '';
    }
  }
  return raw.replace(/^logos\//i, '').replace(/^\/+/, '');
};

const SUPABASE_LOGO_BUCKET = 'logos';

const deleteProfileLogoFromSupabase = async (storagePathOrUrl) => {
  if (!storagePathOrUrl) {
    return false;
  }
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  const objectPath = extractLogoStoragePath(storagePathOrUrl);
  if (!objectPath) {
    return false;
  }
  const { error } = await supabase.storage.from(SUPABASE_LOGO_BUCKET).remove([objectPath]);
  if (error && error.statusCode !== 404) {
    throw new Error(`Impossibile eliminare il logo Supabase (${objectPath}): ${error.message}`);
  }
  return true;
};

const guessLogoContentType = (fileName, fallbackType = 'application/octet-stream') => {
  if (!fileName) {
    return fallbackType;
  }
  const ext = path.extname(String(fileName)).toLowerCase();
  return LOGO_CONTENT_TYPE_MAP.get(ext) || fallbackType;
};

const uploadProfileLogoToSupabase = async (filePath, options = {}) => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  if (!filePath) {
    throw new Error('Percorso file logo non valido');
  }

  const workspaceSegment = sanitizeSlug(options.workspaceId || 'workspace', 'workspace');
  const profileSegment = sanitizeSlug(options.profileId || options.slug || 'profile', 'profile');
  const safeFileName = sanitizeStorageFileName(options.fileName || path.basename(filePath) || 'logo.pdf', 'logo.pdf');
  const timestamp = Date.now().toString(36);
  const objectPath = `${workspaceSegment}/${profileSegment}/${timestamp}_${safeFileName}`;
  const buffer = await fsp.readFile(filePath);
  const resolvedContentType = guessLogoContentType(options.fileName, options.contentType || 'application/octet-stream');

  const { error } = await supabase.storage.from(SUPABASE_LOGO_BUCKET).upload(objectPath, buffer, {
    cacheControl: '86400',
    contentType: resolvedContentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload logo su Supabase fallito (${objectPath}): ${error.message}`);
  }

  if (options.previousStoragePath) {
    try {
      const previousPath = extractLogoStoragePath(options.previousStoragePath);
      if (previousPath && previousPath !== objectPath) {
        await deleteProfileLogoFromSupabase(previousPath);
      }
    } catch (cleanupError) {
      console.warn('⚠️  Impossibile eliminare il logo precedente:', cleanupError?.message || cleanupError);
    }
  }

  const publicUrl = buildSupabasePublicUrl(SUPABASE_LOGO_BUCKET, objectPath);
  return {
    storagePath: objectPath,
    publicUrl,
    fileName: safeFileName,
    contentType: resolvedContentType,
  };
};

const DEFAULT_SUPABASE_DOWNLOAD_ATTEMPTS = 3;
const DEFAULT_SUPABASE_DOWNLOAD_DELAY = 250;

const isRetryableSupabaseDownloadError = (status, message) => {
  if (status === 404) {
    return true;
  }
  if (status >= 500 && status < 600) {
    return true;
  }
  if (!status) {
    const normalized = String(message || '').toLowerCase();
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes('fetch failed') ||
      normalized.includes('network') ||
      normalized.includes('timeout') ||
      normalized.includes('econn') ||
      normalized.includes('etimedout') ||
      normalized.includes('enotfound') ||
      normalized.includes('unexpected token <')
    );
  }
  return false;
};

const downloadFileFromBucket = async (bucket, objectPath, options = {}) => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  const attempts = Math.max(1, Number(options.attempts) || DEFAULT_SUPABASE_DOWNLOAD_ATTEMPTS);
  const initialDelay = Number(options.initialDelayMs) || DEFAULT_SUPABASE_DOWNLOAD_DELAY;

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    lastError = error || new Error('Download sconosciuto fallito');
    const status = Number(error?.status || error?.statusCode) || 0;
    const message = error?.message || error?.error || error?.name || '';
    const shouldRetry = attempt < attempts && isRetryableSupabaseDownloadError(status, message);

    if (!shouldRetry) {
      const failure = new Error(
        `Download fallito da Supabase (${bucket}/${objectPath}): ${message || 'errore sconosciuto'}`
      );
      if (status) {
        failure.statusCode = status;
      }
      throw failure;
    }

    const delayMs = initialDelay * 2 ** (attempt - 1);
    await sleep(delayMs);
  }

  const message = lastError?.message || lastError?.error || 'errore sconosciuto';
  const fallbackError = new Error(
    `Download fallito da Supabase (${bucket}/${objectPath}): ${message}`
  );
  const status = Number(lastError?.status || lastError?.statusCode) || 0;
  if (status) {
    fallbackError.statusCode = status;
  }
  throw fallbackError;
};

const normalizeStoragePrefix = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
};

// TROVA E SOSTITUISCI LA VECCHIA FUNZIONE listSupabaseObjects CON QUESTA

const listSupabaseObjects = async (bucket, prefix = '', options = {}) => {
  if (!supabase) {
    const error = new Error('Supabase client is not configured');
    error.statusCode = 500;
    throw error;
  }

  const normalizedBucket = String(bucket || '').trim();
  if (!normalizedBucket) {
    const error = new Error('Supabase bucket mancante');
    error.statusCode = 400;
    throw error;
  }

  const normalizedPrefix = normalizeStoragePrefix(prefix);
  console.log(`[listSupabaseObjects] Eseguo ricerca in bucket: "${normalizedBucket}", prefisso: "${normalizedPrefix}"`);

  const limit = 500;
  const offset = 0;
  const sortBy = { column: 'updated_at', order: 'desc' };

  const { data, error } = await supabase.storage
    .from(normalizedBucket)
    .list(normalizedPrefix || null, { limit, offset, sortBy });

  if (error) {
    console.error(`[listSupabaseObjects] Errore da Supabase:`, error);
    const listError = new Error(error.message || 'Impossibile elencare gli oggetti Supabase');
    listError.statusCode = Number(error.statusCode) || 500;
    throw listError;
  }

  const entries = Array.isArray(data) ? data : [];
  const filesOnly = entries.filter(item => item.id !== null);
  console.log(`[listSupabaseObjects] Trovati ${filesOnly.length} file.`);

  // ==========================================================
  // ==                  MODIFICA CHIAVE FINALE              ==
  // ==========================================================
  return filesOnly.map((item) => {
    // Il percorso completo dell'oggetto all'interno del bucket
    const objectPath = normalizedPrefix ? `${normalizedPrefix}/${item.name}` : item.name;
    
    return {
      // Campi standard di Supabase
      id: item.id,
      updated_at: item.updated_at,
      created_at: item.created_at,
      last_accessed_at: item.last_accessed_at,
      metadata: {
        ...item.metadata,
        size: Number(item.metadata.size) || 0,
      },
      // I nostri campi custom per il frontend
      name: item.name,         // Solo il nome del file (es. "documento_123.pdf")
      objectPath: objectPath,  // Il percorso completo (es. "processed/user-id/documento_123.pdf")
    };
  });
};

const parseStoragePath = (rawPath) => {
  const normalized = String(rawPath || '').trim().replace(/^\/+/, '');
  if (!normalized) {
    const error = new Error('Percorso storage mancante');
    error.statusCode = 400;
    throw error;
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) {
    const error = new Error('Percorso storage non valido');
    error.statusCode = 400;
    throw error;
  }
  const [bucket, ...objectParts] = segments;
  if (!bucket || objectParts.length === 0) {
    const error = new Error('Percorso storage non valido');
    error.statusCode = 400;
    throw error;
  }
  return { bucket, objectPath: objectParts.join('/') };
};

const DEFAULT_PROMPTS = [
  {
    id: 'prompt_brief_creativo',
    slug: 'brief_creativo',
    title: 'Brief creativo',
    description:
      'Trasforma un brainstorming di concept in un brief chiaro per team creativi, con obiettivi, insight di audience e deliverable.',
    persona: 'Creative strategist',
    color: '#f472b6',
    tags: ['marketing', 'concept', 'campagna'],
    cueCards: [
      { key: 'hook', title: 'Hook narrativo', hint: "Qual è l'idea centrale che vuoi esplorare?" },
      { key: 'audience', title: 'Audience', hint: 'Descrivi il target ideale e il loro bisogno principale.' },
      { key: 'promise', title: 'Promessa', hint: 'Che trasformazione o beneficio vuoi comunicare?' },
      { key: 'proof', title: 'Proof point', hint: 'Cita esempi, dati o insight a supporto.' },
    ],
    markdownRules: {
      tone: "Ispirazionale ma concreto, con verbi d'azione e payoff sintetici.",
      voice: 'Seconda persona plurale, orientata al team.',
      bulletStyle: 'Elenchi brevi con keyword evidenziate in **grassetto**.',
      includeCallouts: true,
      summaryStyle: 'Executive summary iniziale con tre bullet',
    },
    pdfRules: {
      accentColor: '#f472b6',
      layout: 'bold',
      includeCover: true,
      includeToc: false,
    },
    checklist: {
      sections: [
        'Executive summary',
        'Obiettivi della campagna',
        'Insight audience',
        'Tone of voice',
        'Deliverable e call-to-action',
      ],
    },
    builtIn: true,
  },
  {
    id: 'prompt_business_case',
    slug: 'business_case',
    title: 'Business case',
    description:
      "Guida il ragionamento verso un business case strutturato: contesto, opportunità, analisi economica e piano d'azione.",
    persona: 'Business analyst',
    color: '#38bdf8',
    tags: ['strategy', 'analisi', 'finance'],
    cueCards: [
      { key: 'scenario', title: 'Scenario', hint: 'Qual è il contesto competitivo e qual è la tensione principale?' },
      { key: 'value', title: 'Valore', hint: 'Quantifica benefici, risparmi o opportunità.' },
      { key: 'risks', title: 'Rischi', hint: 'Evidenzia rischi, mitigazioni e assunzioni critiche.' },
      { key: 'roadmap', title: 'Roadmap', hint: 'Descrivi le fasi operative e i responsabili.' },
    ],
    markdownRules: {
      tone: 'Professionale, sintetico e orientato ai numeri.',
      voice: 'Prima persona plurale per coinvolgere stakeholder.',
      bulletStyle: 'Liste puntate con metriche e KPI.',
      includeCallouts: true,
      summaryStyle: 'Sintesi in apertura con raccomandazione chiave.',
    },
    pdfRules: {
      accentColor: '#38bdf8',
      layout: 'consulting',
      includeCover: true,
      includeToc: true,
    },
    checklist: {
      sections: [
        'Executive summary',
        'Analisi del problema',
        'Opzioni valutate',
        'Impatto economico',
        'Piano di implementazione',
      ],
    },
    builtIn: true,
  },
  
  {
    // --- ID CORRETTO ---
    id: '1a7a4a2a-7c3d-4b8e-9d2a-8e3b1c4b9c4d',
    // --------------------
    slug: 'elevator_pitch',
    title: 'Elevator Pitch Strategico',
    description:
      "Trasforma un'idea grezza in un elevator pitch incisivo e memorabile, progettato per catturare l'attenzione e ottenere il buy-in da stakeholder C-Level.",
    persona: 'Senior Strategy Advisor',
    color: '#1e3a8a', // Un blu corporate, che ispira fiducia e serietà
    tags: ['strategy', 'c-level', 'funding', 'pitch'],
    cueCards: [
      {
        key: 'problem_statement',
        title: 'Il Problema Rilevante',
        hint: 'Descrivi il problema di business che il CEO riconosce e vuole risolvere. Usa dati per quantificare il costo o l\'opportunità persa (es. "Oggi perdiamo il X% di MQL per...").',
      },
      {
        key: 'solution_concept',
        title: 'La Nostra Soluzione Unica',
        hint: 'In una frase, qual è la tua soluzione? Qual è il suo nome o concetto chiave (es. "Proponiamo una piattaforma di IA predittiva chiamata \'Project Foresight\'...").',
      },
      {
        key: 'value_proposition',
        title: 'Il Valore e l\'Impatto',
        hint: 'Perché questa soluzione vincerà? Quantifica l\'impatto atteso in termini che contano per il business: +X% revenue, -Y% costi operativi, Z% market share, +W punti di NPS.',
      },
      {
        key: 'the_ask',
        title: 'La Richiesta Chiara',
        hint: "Cosa ti serve per procedere? Sii specifico. (Es. 'Un meeting di 30 min per la demo', 'Approvazione del budget di €X per la fase pilota', 'La sua sponsorizzazione per il prossimo board').",
      },
    ],
    markdownRules: {
      tone: 'Assertivo, sicuro e orientato al valore. Evita gergo tecnico non essenziale. Ogni parola deve avere uno scopo.',
      voice: "Prima persona plurale ('noi proponiamo', 'il nostro team ha sviluppato') per creare un senso di team e ownership.",
      bulletStyle: 'Nessuno. La struttura deve essere un discorso fluido e narrativo, non un elenco puntato.',
      summaryStyle: "La prima frase deve essere un 'hook' che cattura immediatamente l'attenzione, legando il problema a un obiettivo strategico aziendale.",
      pointOfView: "Quello di un partner strategico che parla al suo pari (il CEO), non di un venditore o di un tecnico.",
    },
    pdfRules: {
      accentColor: '#1e3a8a',
      layout: 'consulting', // Layout pulito e professionale
      includeCover: true, // Deve apparire come un memo formale, anche se breve
      includeToc: false, // Troppo corto per un indice
    },
    checklist: {
      sections: [
        'Aggancio Iniziale (Hook)',
        'Definizione del Problema e Rilevanza Strategica',
        'Presentazione della Soluzione',
        'Proposta di Valore Unica (Why Us, Why Now)',
        'Impatto sul Business (Quantificato)',
        'La Chiamata all\'Azione (The Ask)',
      ],
    },
    builtIn: true,
  },
  {
    id: 'prompt_meeting_minutes',
    slug: 'verbale_meeting',
    title: 'Verbale riunione executive',
    summary: 'Genera verbali completi e azionabili a partire da trascrizioni di meeting.',
    description:
      "Trasforma la trascrizione di una riunione in un verbale pronto per il template HTML meeting. Apri il documento con un front matter YAML che imposti `pdfRules.layout: verbale_meeting` (o il campo `layout`) e opzionalmente `styles.css: Templates/verbale_meeting.css`. Il front matter deve includere tre array obbligatori: `action_items` (oggetti con description, assignee.name, assignee.role, due_date), `key_points` (voci sintetiche) e `transcript` (blocchi con speaker, role, timestamp, paragraphs). Struttura il corpo usando le sezioni esatte: 'Riepilogo esecutivo', 'Decisioni e approvazioni', 'Azioni assegnate', 'Punti chiave', 'Trascrizione integrale' e chiudi con eventuali allegati o note operative.",
    persona: 'Chief of Staff',
    color: '#f97316',
    tags: ['meeting', 'verbale', 'operations'],
    cueCards: [
      { key: 'context', title: 'Contesto', hint: 'Qual era lo scopo della riunione e quali team erano coinvolti?' },
      { key: 'decisions', title: 'Decisioni', hint: 'Quali decisioni o approvazioni sono state prese e da chi?' },
      { key: 'actions', title: 'Azioni', hint: 'Elenca le attività con owner, ruolo e scadenza stimata.' },
      { key: 'risks', title: 'Criticità', hint: 'Segnala blocchi, rischi aperti o richieste di follow-up.' },
      { key: 'transcript', title: 'Trascrizione', hint: 'Evidenzia passaggi chiave da riportare nel blocco transcript.' },
    ],
    markdownRules: {
      tone: 'Professionale e sintetico, orientato al follow-up.',
      voice: 'Terza persona con riferimenti ai ruoli aziendali.',
      bulletStyle: 'Liste numerate per decisioni e puntate per punti chiave.',
      includeCallouts: true,
      summaryStyle: 'Tabella o elenco iniziale con data, durata e partecipanti.',
    },
    pdfRules: {
      accentColor: '#f97316',
      layout: 'verbale_meeting',
      template: 'verbale_meeting.html',
      includeCover: false,
      includeToc: false,
    },
    checklist: {
      sections: [
        'Riepilogo esecutivo',
        'Decisioni e approvazioni',
        'Azioni assegnate',
        'Punti chiave',
        'Trascrizione integrale',
      ],
    },
    builtIn: true,
  },
  {
    id: 'prompt_format_base',
    slug: 'format_base',
    title: 'Format base',
    summary: 'Trasforma gli appunti in un documento Markdown professionale.',
    description:
      "Trasforma gli appunti in un documento Markdown professionale. La struttura del documento DEVE includere sezioni con i titoli esatti: 'Introduzione', 'Punti Chiave', 'Analisi Dettagliata', 'Prossime Azioni'. Inserisci almeno una tabella con un massimo di 4 colonne e una tabella dei 3 principali rischi. NON usare backticks di codice per l'intero blocco di codice.",
    persona: 'Senior consultant',
    color: '#00FF00',
    tags: ['test', 'beta'],
    cueCards: [
      { key: 'scenario', title: 'Scenario', hint: 'Qual è il contesto competitivo e qual è la tensione principale?' },
      { key: 'value', title: 'Valore', hint: 'Quantifica benefici, risparmi o opportunità.' },
      { key: 'risks', title: 'Rischi', hint: 'Evidenzia rischi, mitigazioni e assunzioni critiche.' },
      { key: 'roadmap', title: 'Roadmap', hint: 'Descrivi le fasi operative e i responsabili.' },
    ],
    markdownRules: null,
    pdfRules: {
      accentColor: '#38bdf8',
      layout: 'consulting',
      includeCover: true,
      includeToc: true,
    },
    checklist: {
      sections: [
        'Executive Summary',
        'Punti Chiave',
        'Analisi Dettagliata',
        'Prossime Azioni',
      ],
    },
    builtIn: true,
  },
  {
    id: 'prompt_post_mortem',
    slug: 'post_mortem',
    title: 'Post-mortem & retrospettiva',
    description:
      'Racconta lezioni apprese, metriche e azioni correttive dopo un progetto o sprint, con tono costruttivo.',
    persona: 'Project manager',
    color: '#facc15',
    tags: ['retrospettiva', 'continuous improvement'],
    cueCards: [
      { key: 'success', title: 'Successi', hint: 'Quali risultati hanno funzionato particolarmente bene?' },
      { key: 'metrics', title: 'Metriche', hint: 'Condividi indicatori e outcome misurabili.' },
      { key: 'lessons', title: 'Lezioni', hint: 'Quali pattern negativi hai osservato e come evitarli?' },
      { key: 'actions', title: 'Azioni', hint: 'Proponi next step, owner e tempistiche.' },
    ],
    markdownRules: {
      tone: 'Onesto ma orientato al miglioramento continuo.',
      voice: 'Prima persona plurale, tono collaborativo.',
      bulletStyle: 'Liste con emoji/simboli per evidenziare + e −.',
      includeCallouts: false,
      summaryStyle: 'Tabella iniziale con KPI e stato',
    },
    pdfRules: {
      accentColor: '#facc15',
      layout: 'workshop',
      includeCover: false,
      includeToc: false,
    },
    checklist: {
      sections: [
        'Contesto e obiettivi',
        'Metriche principali',
        'Cosa è andato bene',
        'Cosa migliorare',
        'Piano di azione',
      ],
    },
    builtIn: true,
  },
];

const SUPABASE_PROMPT_COLUMNS = [
  'id',
  'legacy_id',
  'workspace_id',
  'slug',
  'title',
  'summary',
  'description',
  'persona',
  'color',
  'tags',
  'cue_cards',
  'markdown_rules',
  'pdf_rules',
  'checklist',
  'built_in',
  'created_at',
  'updated_at',
].join(', ');

const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const parseJsonObject = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const formatPromptForResponse = (record, { fallback = false } = {}) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const rawTags = record.tags;
  const tags = parseJsonArray(rawTags)
    .map((tag) => String(tag || '').trim())
    .filter(Boolean);

  const rawCueCards = fallback ? record.cueCards : record.cue_cards;
  const cueCards = normalizeCueCards(parseJsonArray(rawCueCards));

  const checklistSource = (() => {
    if (fallback) {
      return record.checklist;
    }
    const parsed = parseJsonObject(record.checklist);
    if (parsed) {
      return parsed;
    }
    const asArray = parseJsonArray(record.checklist);
    return asArray.length ? { sections: asArray } : null;
  })();
  const checklistSections = normalizeChecklistSections(
    (checklistSource && (checklistSource.sections || checklistSource)) || []
  );

  let focusPrompts = [];
  if (checklistSource && (checklistSource.focusPrompts || checklistSource.focus_prompts)) {
    focusPrompts = parseJsonArray(checklistSource.focusPrompts || checklistSource.focus_prompts);
  }
  if (!focusPrompts.length && Array.isArray(record.focusPrompts)) {
    focusPrompts = record.focusPrompts;
  }
  focusPrompts = focusPrompts.map((item) => String(item || '').trim()).filter(Boolean);

  const markdownRules = (() => {
    if (fallback) {
      return record.markdownRules ? { ...record.markdownRules } : null;
    }
    const parsed = parseJsonObject(record.markdown_rules);
    return parsed ? parsed : null;
  })();

  const pdfRules = (() => {
    if (fallback) {
      return record.pdfRules ? { ...record.pdfRules } : null;
    }
    const parsed = parseJsonObject(record.pdf_rules);
    return parsed ? parsed : null;
  })();

  const id = fallback ? record.id : record.legacy_id || record.id;
  const legacyId = fallback ? record.id : record.legacy_id || null;
  const supabaseId = fallback ? null : record.id || null;

  const checklist = { sections: checklistSections };
  if (focusPrompts.length) {
    checklist.focusPrompts = focusPrompts;
  }

  const prompt = {
    id,
    legacyId,
    supabaseId,
    workspaceId: fallback ? record.workspaceId || null : record.workspace_id || null,
    slug: record.slug || '',
    title: record.title || '',
    summary: record.summary || '',
    description: record.description || '',
    persona: record.persona || '',
    color: record.color ? normalizeColor(record.color) : '#6366f1',
    tags,
    cueCards,
    markdownRules,
    pdfRules,
    checklist,
    builtIn: Boolean(fallback ? record.builtIn : record.built_in),
    createdAt: fallback ? record.createdAt || null : record.created_at || null,
    updatedAt: fallback ? record.updatedAt || null : record.updated_at || null,
  };

  if (focusPrompts.length) {
    prompt.focusPrompts = focusPrompts;
  }

  return prompt;
};

const listPrompts = async () => {
  if (!supabase) {
    return DEFAULT_PROMPTS.map((prompt) => formatPromptForResponse(prompt, { fallback: true })).filter(Boolean);
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('prompts')
      .select(SUPABASE_PROMPT_COLUMNS)
      .order('created_at', { ascending: true, nullsLast: true });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
      return DEFAULT_PROMPTS.map((prompt) => formatPromptForResponse(prompt, { fallback: true })).filter(Boolean);
    }

    return data.map((row) => formatPromptForResponse(row)).filter(Boolean);
  } catch (error) {
    console.error('Errore durante il recupero dei prompt da Supabase:', error?.message || error);
    throw error;
  }
};

const fetchPromptByIdentifier = async (identifier) => {
  const normalized = typeof identifier === 'string' ? identifier.trim() : '';
  if (!normalized) {
    return null;
  }

  if (!supabase) {
    const prompts = await listPrompts();
    return findPromptById(prompts, normalized);
  }

  const client = getSupabaseClient();
  const baseQuery = () =>
    client
      .from('prompts')
      .select(SUPABASE_PROMPT_COLUMNS);

  const byLegacy = await baseQuery().eq('legacy_id', normalized).maybeSingle();
  if (byLegacy.error) {
    throw byLegacy.error;
  }
  if (byLegacy.data) {
    return formatPromptForResponse(byLegacy.data);
  }

  const byId = await baseQuery().eq('id', normalized).maybeSingle();
  if (byId.error) {
    throw byId.error;
  }
  return byId.data ? formatPromptForResponse(byId.data) : null;
};

const promptToDbRecord = (prompt) => {
  if (!prompt || typeof prompt !== 'object') {
    return {};
  }

  const normalizedTags = Array.isArray(prompt.tags)
    ? prompt.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];

  const normalizedCueCards = Array.isArray(prompt.cueCards)
    ? prompt.cueCards
    : [];

  const baseChecklist =
    prompt.checklist && typeof prompt.checklist === 'object' ? { ...prompt.checklist } : {};
  const sections = normalizeChecklistSections(baseChecklist.sections || baseChecklist);
  let focusPrompts = [];
  if (Array.isArray(prompt.focusPrompts)) {
    focusPrompts = prompt.focusPrompts;
  } else if (Array.isArray(baseChecklist.focusPrompts)) {
    focusPrompts = baseChecklist.focusPrompts;
  } else if (Array.isArray(baseChecklist.focus_prompts)) {
    focusPrompts = baseChecklist.focus_prompts;
  }
  const normalizedFocusPrompts = focusPrompts
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const checklistPayload = {
    ...baseChecklist,
    sections,
  };
  delete checklistPayload.focus_prompts;
  if (normalizedFocusPrompts.length) {
    checklistPayload.focusPrompts = normalizedFocusPrompts;
  } else {
    delete checklistPayload.focusPrompts;
  }

  return {
    legacy_id: prompt.legacyId || prompt.id || null,
    workspace_id: prompt.workspaceId || null,
    slug: prompt.slug || null,
    title: prompt.title || null,
    summary: prompt.summary || null,
    description: prompt.description || null,
    persona: prompt.persona || null,
    color: prompt.color || null,
    tags: normalizedTags,
    cue_cards: normalizedCueCards,
    markdown_rules: prompt.markdownRules || null,
    pdf_rules: prompt.pdfRules || null,
    checklist: checklistPayload,
    built_in: Boolean(prompt.builtIn),
  };
};

const mergeWorkspaceUpdate = (workspace, patch) => {
  const updated = { ...workspace };
  updated.profiles = Array.isArray(workspace.profiles)
    ? workspace.profiles.map((profile) => ({ ...profile }))
    : [];
  if (patch.name) updated.name = String(patch.name).trim();
  if (patch.client) updated.client = String(patch.client).trim();
  if (patch.color) updated.color = normalizeColor(patch.color);
  if (patch.slug) updated.slug = String(patch.slug).trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  if (patch.destDir !== undefined) {
    updated.destDir = sanitizeDestDirInput(patch.destDir || '');
  }
  if (patch.versioningPolicy && typeof patch.versioningPolicy === 'object') {
    updated.versioningPolicy = {
      retentionLimit: Number.isFinite(patch.versioningPolicy.retentionLimit)
        ? Math.max(1, Number(patch.versioningPolicy.retentionLimit))
        : (workspace.versioningPolicy?.retentionLimit || 10),
      freezeOnPublish: Boolean(
        patch.versioningPolicy.freezeOnPublish ?? workspace.versioningPolicy?.freezeOnPublish
      ),
      namingConvention:
        patch.versioningPolicy.namingConvention || workspace.versioningPolicy?.namingConvention || 'timestamped',
    };
  }

  if (Array.isArray(patch.projects)) {
    updated.projects = patch.projects.map((project) => ({
      id: project.id || generateId('proj'),
      name: String(project.name || 'Project').trim(),
      color: normalizeColor(project.color || updated.color || '#6366f1'),
      destDir: sanitizeDestDirInput(project.destDir || ''),
      statuses: Array.isArray(project.statuses) && project.statuses.length
        ? project.statuses.map((status) => String(status).trim()).filter(Boolean)
        : [...DEFAULT_STATUSES],
      createdAt: project.createdAt || Date.now(),
      updatedAt: Date.now(),
    }));
  }

  if (Array.isArray(patch.defaultStatuses) && patch.defaultStatuses.length) {
    updated.defaultStatuses = patch.defaultStatuses
      .map((status) => String(status).trim())
      .filter(Boolean);
  }

  if (Array.isArray(patch.profiles)) {
    updated.profiles = normalizeWorkspaceProfiles(patch.profiles, {
      existingProfiles: workspace.profiles || [],
    });
  }

  updated.updatedAt = Date.now();
  return updated;
};

const shouldRetryWorkspaceCreation = (error) => {
  if (!error) {
    return false;
  }

  const message = (error?.message || String(error || '')).toLowerCase();
  return (
    message.includes('row-level security') ||
    message.includes('foreign key constraint') ||
    message.includes('owner_id') ||
    message.includes('profiles')
  );
};

app.get('/api/workspaces', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  try {
    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }
    const workspaces = await listWorkspacesFromDb(ownerId);
    const payload = workspaces.map((workspace) => ({
      ...workspace,
      profiles: profilesForResponse(workspace.id, workspace.profiles || []),
    }));
    res.json({ ok: true, workspaces: payload });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  }
});

app.post('/api/workspaces', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  try {
    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato a creare workspace' });
    }
    await ensureProfileForUser(req);
    const parsed = workspaceInputSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: 'Dati workspace non validi', details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const prompts = await listPrompts();
    const normalizedProfiles = Array.isArray(data.profiles)
      ? data.profiles.map((profile) => ({
          id: profile.id || '',
          label: profile.label,
          slug: profile.slug || profile.label,
          promptId: profile.promptId || '',
          pdfTemplate: profile.pdfTemplate || '',
          pdfLogoPath: profile.pdfLogoPath || '',
          pdfLogo: profile.pdfLogo || null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }))
      : [];
    const profileErrors = await validateWorkspaceProfiles(normalizedProfiles, { prompts });
    if (profileErrors.length) {
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: profileErrors });
    }

    const color = normalizeColor(data.color || '');
    const defaultStatuses = normalizeDefaultStatuses(data.defaultStatuses);
    const workspacePayload = {
      id: '',
      ownerId,
      name: data.name.trim(),
      client: data.client || data.name.trim(),
      color,
      slug: sanitizeSlug(data.slug || data.name, data.name),
      versioningPolicy: data.versioningPolicy
        ? {
            retentionLimit: data.versioningPolicy.retentionLimit || DEFAULT_VERSIONING_POLICY.retentionLimit,
            freezeOnPublish:
              data.versioningPolicy.freezeOnPublish ?? DEFAULT_VERSIONING_POLICY.freezeOnPublish,
            namingConvention:
              data.versioningPolicy.namingConvention || DEFAULT_VERSIONING_POLICY.namingConvention,
          }
        : { ...DEFAULT_VERSIONING_POLICY },
      defaultStatuses,
      projects: normalizeProjects(data.projects, { fallbackColor: color, fallbackStatuses: defaultStatuses }),
      profiles: [],
    };

    const attemptInsert = async () => insertWorkspaceIntoDb(workspacePayload, { ownerId });

    let createdWorkspace;
    try {
      createdWorkspace = await attemptInsert();
    } catch (workspaceError) {
      if (!shouldRetryWorkspaceCreation(workspaceError)) {
        throw workspaceError;
      }
      await ensureProfileForUser(req);
      createdWorkspace = await attemptInsert();
    }

    let createdProfiles = [];
    if (normalizedProfiles.length) {
      try {
        const promises = normalizedProfiles.map((profile) =>
          insertProfileIntoDb(createdWorkspace.id, profile)
        );
        createdProfiles = await Promise.all(promises);
      } catch (profileError) {
        await deleteWorkspaceFromDb(createdWorkspace.id);
        throw profileError;
      }
    }

    const responseWorkspace = createdProfiles.length
      ? { ...createdWorkspace, profiles: createdProfiles }
      : createdWorkspace;

    const normalizedWorkspace = {
      ...responseWorkspace,
      profiles: profilesForResponse(responseWorkspace.id, responseWorkspace.profiles || []),
    };

    res.status(201).json({ ok: true, workspace: normalizedWorkspace });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  }
});

app.put('/api/workspaces/:id', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  try {
    const workspaceId = String(req.params?.id || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ ok: false, message: 'Workspace non valido' });
    }

    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }
    await ensureProfileForUser(req);
    const existing = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!existing) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }

    const parsed = workspaceUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: 'Dati workspace non validi', details: parsed.error.flatten() });
    }

    const patch = parsed.data;
    const merged = mergeWorkspaceUpdate(existing, patch);
    const prompts = await listPrompts();
    const profileErrors = await validateWorkspaceProfiles(merged.profiles, { prompts });
    if (profileErrors.length) {
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: profileErrors });
    }

    const updated = await updateWorkspaceInDb(workspaceId, merged, { ownerId: existing.ownerId });
    const normalizedWorkspace = {
      ...updated,
      profiles: profilesForResponse(updated.id, updated.profiles || []),
    };
    res.json({ ok: true, workspace: normalizedWorkspace });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  }
});

app.delete('/api/workspaces/:id', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  try {
    const workspaceId = String(req.params?.id || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ ok: false, message: 'Workspace non valido' });
    }
    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }
    await ensureProfileForUser(req);
    const existing = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!existing) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
    await deleteWorkspaceFromDb(workspaceId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  }
});

app.post(
  '/api/workspaces/:workspaceId/ingest',
  knowledgeUploadMiddleware,
  async (req, res) => {
    const rawUploads = Array.isArray(req.files) ? req.files : [];
    const uploadedFiles = [];
    const discardedUploads = [];
    for (const file of rawUploads) {
      const normalizedField = normalizeKnowledgeFieldName(file?.fieldname);
      if (normalizedField && KNOWLEDGE_UPLOAD_FIELDS.has(normalizedField)) {
        uploadedFiles.push(file);
      } else {
        discardedUploads.push(file);
      }
    }

    if (discardedUploads.length) {
      await cleanupKnowledgeFiles(discardedUploads);
    }
    const paramId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
    const workspaceId = paramId || getWorkspaceIdFromRequest(req);
    const rawProjectId =
      typeof req.body?.projectId === 'string'
        ? req.body.projectId
        : typeof req.body?.workspaceProjectId === 'string'
          ? req.body.workspaceProjectId
          : typeof req.query?.projectId === 'string'
            ? req.query.projectId
            : typeof req.query?.workspaceProjectId === 'string'
              ? req.query.workspaceProjectId
              : '';
    const requestedProjectId = sanitizeProjectIdentifier(rawProjectId);
    const rawProjectName =
      typeof req.body?.projectName === 'string'
        ? req.body.projectName
        : typeof req.body?.workspaceProjectName === 'string'
          ? req.body.workspaceProjectName
          : typeof req.query?.projectName === 'string'
            ? req.query.projectName
            : typeof req.query?.workspaceProjectName === 'string'
              ? req.query.workspaceProjectName
              : '';
    const requestedProjectName = sanitizeProjectName(rawProjectName);

    if (!workspaceId) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res.status(400).json({ ok: false, message: 'workspaceId obbligatorio' });
    }

    if (!supabase) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res
        .status(503)
        .json({ ok: false, message: 'Supabase non configurato: impossibile indicizzare la knowledge base.' });
    }

    try {
      getAIService('openai', process.env.OPENAI_API_KEY);
    } catch (error) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res
        .status(503)
        .json({ ok: false, message: 'OpenAI non configurato: impossibile generare embedding per la knowledge base.' });
    }

    if (!uploadedFiles.length) {
      return res.status(400).json({ ok: false, message: 'Carica almeno un file da indicizzare.' });
    }

    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }

    let workspace;
    try {
      workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
      if (!workspace) {
        await cleanupKnowledgeFiles(uploadedFiles);
        return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
      }
    } catch (workspaceError) {
      await cleanupKnowledgeFiles(uploadedFiles);
      return res.status(500).json({ ok: false, message: workspaceError?.message || 'Recupero workspace non riuscito' });
    }

    let knowledgeProjectScopeId = '';
    let knowledgeProjectOriginalId = '';
    let knowledgeProjectName = '';
    if (workspace && (requestedProjectId || requestedProjectName)) {
      const projects = Array.isArray(workspace.projects) ? workspace.projects : [];
      const normalizedProjectId = sanitizeProjectIdentifier(requestedProjectId);
      const normalizedProjectName = sanitizeProjectName(requestedProjectName);
      const projectById = normalizedProjectId
        ? projects.find((proj) => sanitizeProjectIdentifier(proj?.id) === normalizedProjectId)
        : null;
      const normalizedName = normalizedProjectName ? normalizedProjectName.toLowerCase() : '';
      const projectByName = !projectById && normalizedName
        ? projects.find(
            (proj) => sanitizeProjectName(proj?.name).toLowerCase() === normalizedName
          )
        : null;
      const targetProject = projectById || projectByName || null;
      if (!targetProject) {
        if (!normalizedProjectId) {
          await cleanupKnowledgeFiles(uploadedFiles);
          return res.status(404).json({ ok: false, message: 'Progetto non trovato nel workspace' });
        }
        console.warn(
          `⚠️  Progetto ${normalizedProjectId} non trovato nel workspace ${workspaceId}: procedo utilizzando l'ID fornito.`
        );
        const fallbackScope = resolveProjectScopeIdentifiers(normalizedProjectId);
        knowledgeProjectScopeId = fallbackScope.canonicalId;
        knowledgeProjectOriginalId = fallbackScope.originalId || normalizedProjectId;
        knowledgeProjectName = normalizedProjectName || '';
      } else {
        const resolvedScope = resolveProjectScopeIdentifiers(targetProject.id);
        knowledgeProjectScopeId = resolvedScope.canonicalId;
        knowledgeProjectOriginalId = resolvedScope.originalId;
        knowledgeProjectName = sanitizeProjectName(targetProject.name) || normalizedProjectName || '';
      }
    }

    const ingestionId = crypto.randomUUID();
    const normalizedFiles = uploadedFiles.map((file) => ({
      path: file.path,
      originalName: file.originalname || file.filename || path.basename(file.path),
      mimetype: file.mimetype || '',
      size: Number.isFinite(file.size) ? file.size : Number(file.size) || undefined,
    }));

    enqueueKnowledgeIngestion({
      workspaceId: workspaceId.trim(),
      projectId: knowledgeProjectScopeId || null,
      projectOriginalId: knowledgeProjectOriginalId || null,
      projectName: knowledgeProjectName || null,
      files: normalizedFiles,
      ingestionId,
    });

    res.status(202).json({
      ok: true,
      ingestionId,
      filesQueued: normalizedFiles.length,
      projectId: knowledgeProjectOriginalId || null,
      projectScopeId: knowledgeProjectScopeId || null,
      projectName: knowledgeProjectName || null,
      message: 'Ingestion avviata: la knowledge base verrà aggiornata in background.',
    });
  }
);

app.get('/api/workspaces/:workspaceId/knowledge', async (req, res) => {
  const paramId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
  const workspaceId = paramId || getWorkspaceIdFromRequest(req);
  const rawProjectId =
    typeof req.query?.projectId === 'string'
      ? req.query.projectId
      : typeof req.query?.workspaceProjectId === 'string'
        ? req.query.workspaceProjectId
        : '';
  const requestedProjectScopeId = canonicalizeProjectScopeId(rawProjectId);

  if (!workspaceId) {
    return res.status(400).json({ ok: false, message: 'workspaceId obbligatorio' });
  }

  if (!supabase) {
    return res
      .status(503)
      .json({ ok: false, message: 'Supabase non configurato: impossibile recuperare la knowledge base.' });
  }

  const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
  if (!ownerId) {
    return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
  }

  let workspace;
  try {
    workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!workspace) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
  } catch (workspaceError) {
    return res.status(500).json({ ok: false, message: workspaceError?.message || 'Recupero workspace non riuscito' });
  }

  try {
    let query = supabase
      .from('knowledge_chunks')
      .select('metadata, created_at, project_id')
      .eq('workspace_id', workspaceId.trim());

    if (requestedProjectScopeId) {
      query = query.or(`project_id.eq.${requestedProjectScopeId},project_id.is.null`);
    } else {
      query = query.is('project_id', null);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false, nullsLast: true })
      .limit(2000);

    if (error) {
      return res
        .status(500)
        .json({ ok: false, message: error?.message || 'Impossibile recuperare la knowledge base.' });
    }

    const projectLookup = new Map(
      (Array.isArray(workspace?.projects) ? workspace.projects : [])
        .map((proj) => {
          const { canonicalId, originalId } = resolveProjectScopeIdentifiers(proj?.id);
          if (!canonicalId) {
            return null;
          }
          const label = sanitizeProjectName(proj?.name) || originalId;
          return [canonicalId, { label, originalId }];
        })
        .filter(Boolean)
    );

    const aggregated = new Map();
    (Array.isArray(data) ? data : []).forEach((row) => {
      const metadata = row?.metadata || {};
      const fileName = extractSourceFileName(metadata);
      if (!fileName) {
        return;
      }
      const rowProjectId = typeof row?.project_id === 'string' && row.project_id ? row.project_id.toLowerCase() : null;
      const metadataProjectId =
        typeof metadata?.projectId === 'string' && metadata.projectId
          ? canonicalizeProjectScopeId(metadata.projectId)
          : null;
      const effectiveProjectId = rowProjectId || metadataProjectId || null;
      if (!requestedProjectScopeId && effectiveProjectId) {
        return;
      }
      const ingestedAt = metadata?.ingestedAt || row?.created_at || null;
      const rawSize = Number(metadata?.size);
      const size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : null;
      const mimeType = typeof metadata?.mimeType === 'string' ? metadata.mimeType : '';

      const key = `${effectiveProjectId || 'workspace'}::${fileName}`;

      const metadataOriginalProjectId =
        typeof metadata?.projectOriginalId === 'string'
          ? sanitizeProjectIdentifier(metadata.projectOriginalId)
          : '';
      const legacyProjectId =
        !metadataOriginalProjectId && typeof metadata?.projectId === 'string'
          ? sanitizeProjectIdentifier(metadata.projectId)
          : '';
      const lookupEntry = effectiveProjectId ? projectLookup.get(effectiveProjectId) : null;
      const projectOriginalId = metadataOriginalProjectId || lookupEntry?.originalId || legacyProjectId || null;
      const projectDisplayName = effectiveProjectId
        ? lookupEntry?.label || sanitizeProjectName(metadata?.projectName) || null
        : null;

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          name: fileName,
          chunkCount: 0,
          lastIngestedAt: ingestedAt,
          mimeType: mimeType || null,
          size: size || null,
          projectId: projectOriginalId,
          projectScopeId: effectiveProjectId,
          projectName: projectDisplayName,
        });
      }

      const entry = aggregated.get(key);
      entry.chunkCount += 1;
      if (ingestedAt) {
        const current = entry.lastIngestedAt ? new Date(entry.lastIngestedAt).getTime() : 0;
        const candidate = new Date(ingestedAt).getTime();
        if (Number.isFinite(candidate) && candidate > current) {
          entry.lastIngestedAt = ingestedAt;
        }
      }
      if (!entry.mimeType && mimeType) {
        entry.mimeType = mimeType;
      }
      if (!entry.size && size) {
        entry.size = size;
      }
    });

    const files = Array.from(aggregated.values()).sort((a, b) => {
      const aTime = a.lastIngestedAt ? new Date(a.lastIngestedAt).getTime() : 0;
      const bTime = b.lastIngestedAt ? new Date(b.lastIngestedAt).getTime() : 0;
      return bTime - aTime;
    });

    res.json({ ok: true, files });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Errore inatteso nella lettura della knowledge base.' });
  }
});

app.delete('/api/workspaces/:workspaceId/knowledge', async (req, res) => {
  const paramId = typeof req.params?.workspaceId === 'string' ? req.params.workspaceId.trim() : '';
  const workspaceId = paramId || getWorkspaceIdFromRequest(req);

  if (!workspaceId) {
    return res.status(400).json({ ok: false, message: 'workspaceId obbligatorio' });
  }

  if (!supabase) {
    return res
      .status(503)
      .json({ ok: false, message: 'Supabase non configurato: impossibile rimuovere la knowledge base.' });
  }

  const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
  if (!ownerId) {
    return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
  }

  let workspace;
  try {
    workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!workspace) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
  } catch (workspaceError) {
    return res.status(500).json({ ok: false, message: workspaceError?.message || 'Recupero workspace non riuscito' });
  }

  const fileCandidates = [
    req.body?.fileName,
    req.body?.file,
    req.body?.name,
    req.query?.fileName,
    req.query?.file,
    req.query?.name,
  ];

  let targetFileName = '';
  for (const candidate of fileCandidates) {
    const sanitized = sanitizeKnowledgeFileName(candidate);
    if (sanitized) {
      targetFileName = sanitized;
      break;
    }
  }

  if (!targetFileName) {
    return res.status(400).json({ ok: false, message: 'fileName obbligatorio' });
  }

  const projectCandidates = [
    req.body?.projectScopeId,
    req.body?.projectId,
    req.body?.workspaceProjectId,
    req.query?.projectScopeId,
    req.query?.projectId,
    req.query?.workspaceProjectId,
  ];

  let requestedProjectId = '';
  for (const candidate of projectCandidates) {
    const sanitized = sanitizeProjectIdentifier(candidate);
    if (sanitized) {
      requestedProjectId = sanitized;
      break;
    }
  }

  const requestedProjectScopeId = canonicalizeProjectScopeId(requestedProjectId);

  const applyBaseFilters = (query) => {
    let filtered = query.eq('workspace_id', workspaceId.trim());
    if (requestedProjectScopeId) {
      filtered = filtered.eq('project_id', requestedProjectScopeId);
    } else {
      filtered = filtered.is('project_id', null);
    }
    return filtered;
  };

  const deleteByMetadataKey = async (column) => {
    const { data, error } = await applyBaseFilters(supabase.from('knowledge_chunks').delete())
      .filter(column, 'eq', targetFileName)
      .select('id');
    if (error) {
      throw new Error(error.message || 'Eliminazione knowledge non riuscita');
    }
    return Array.isArray(data) ? data : [];
  };

  try {
    let removedRows = await deleteByMetadataKey('metadata->>sourceFile');
    if (!removedRows.length) {
      removedRows = await deleteByMetadataKey('metadata->>source');
    }

    if (!removedRows.length) {
      return res.status(404).json({ ok: false, message: 'Documento knowledge non trovato.' });
    }

    const projectLookup = new Map(
      (Array.isArray(workspace?.projects) ? workspace.projects : [])
        .map((proj) => {
          const { canonicalId, originalId } = resolveProjectScopeIdentifiers(proj?.id);
          if (!canonicalId) {
            return null;
          }
          const label = sanitizeProjectName(proj?.name) || originalId;
          return [canonicalId, { label, originalId }];
        })
        .filter(Boolean)
    );

    const projectDetails = requestedProjectScopeId ? projectLookup.get(requestedProjectScopeId) : null;
    const removedChunks = removedRows.length;
    const baseMessage =
      removedChunks === 1
        ? `Documento "${targetFileName}" rimosso dalla knowledge base.`
        : `Rimossi ${removedChunks} chunk del documento "${targetFileName}".`;

    return res.json({
      ok: true,
      removed: removedChunks,
      fileName: targetFileName,
      projectScopeId: requestedProjectScopeId || null,
      projectId: projectDetails?.originalId || null,
      projectName: projectDetails?.label || null,
      message: baseMessage,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Impossibile rimuovere il documento dalla knowledge base.',
    });
  }
});

const workspaceProfilesRouter = express.Router({ mergeParams: true });

workspaceProfilesRouter.get('/', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  try {
    const workspaceId = String(req.params?.workspaceId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ ok: false, message: 'Workspace non valido' });
    }
    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }
    const workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!workspace) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
    res.json({ ok: true, profiles: profilesForResponse(workspace.id, workspace.profiles || []) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  }
});

workspaceProfilesRouter.post('/', optionalProfileUpload, async (req, res) => {
  if (!supabase) {
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  let uploadResult = null;
  try {
    const workspaceId = String(req.params?.workspaceId || '').trim();
    if (!workspaceId) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(400).json({ ok: false, message: 'Workspace non valido' });
    }

    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }
    const workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!workspace) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }

    const parsed = profileInputSchema.safeParse(req.body || {});
    if (!parsed.success) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: parsed.error.flatten() });
    }

    const payload = parsed.data;
    const now = Date.now();
    const resolvedProfileId = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : generateId('profile');
    const slug = sanitizeSlug(payload.slug || payload.label, payload.label);
    const basePdfLogo = payload.pdfLogo && typeof payload.pdfLogo === 'object'
      ? {
          fileName: sanitizeStorageFileName(
            payload.pdfLogo.fileName || payload.pdfLogoPath || 'logo.pdf',
            'logo.pdf'
          ),
          originalName: String(payload.pdfLogo.originalName || payload.pdfLogo.fileName || '').trim(),
          storagePath:
            typeof payload.pdfLogo.storagePath === 'string' && payload.pdfLogo.storagePath.trim()
              ? payload.pdfLogo.storagePath.trim()
              : '',
          updatedAt: Number.isFinite(payload.pdfLogo.updatedAt)
            ? Number(payload.pdfLogo.updatedAt)
            : now,
        }
      : null;

    const profilePayload = {
      id: resolvedProfileId,
      label: payload.label,
      slug,
      promptId: payload.promptId || '',
      pdfTemplate: payload.pdfTemplate || '',
      pdfLogoPath: typeof payload.pdfLogoPath === 'string' ? payload.pdfLogoPath.trim() : '',
      pdfLogo: basePdfLogo,
      createdAt: now,
      updatedAt: now,
    };

    if (req.file) {
      const tempPath = await ensureTempFileHasExtension(req.file, VALID_LOGO_EXTENSIONS);
      try {
        uploadResult = await uploadProfileLogoToSupabase(tempPath, {
          workspaceId,
          profileId: resolvedProfileId,
          slug,
          fileName: req.file.originalname,
          contentType: req.file.mimetype,
        });
      } catch (uploadError) {
        const message = uploadError?.message || 'Caricamento logo su Supabase non riuscito';
        return res.status(500).json({ ok: false, message });
      }

      const originalLabel = String(req.file.originalname || payload.label || slug || 'logo.pdf').trim();
      profilePayload.pdfLogoPath = uploadResult.publicUrl;
      profilePayload.pdfLogo = {
        fileName: uploadResult.fileName,
        originalName: originalLabel,
        storagePath: uploadResult.storagePath,
        updatedAt: now,
      };
    }

    const prompts = await listPrompts();
    const validationErrors = await validateWorkspaceProfiles([profilePayload], { prompts });
    if (validationErrors.length) {
      if (uploadResult?.storagePath) {
        try {
          await deleteProfileLogoFromSupabase(uploadResult.storagePath);
        } catch (cleanupError) {
          console.warn('⚠️  Pulizia logo fallita dopo la validazione:', cleanupError?.message || cleanupError);
        }
      }
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: validationErrors });
    }

    const created = await insertProfileIntoDb(workspaceId, profilePayload);
    res.status(201).json({ ok: true, profile: profileForResponse(workspaceId, created) });
  } catch (error) {
    if (uploadResult?.storagePath) {
      try {
        await deleteProfileLogoFromSupabase(uploadResult.storagePath);
      } catch (cleanupError) {
        console.warn('⚠️  Pulizia logo fallita dopo errore:', cleanupError?.message || cleanupError);
      }
    }
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  } finally {
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
  }
});

workspaceProfilesRouter.put('/:profileId', optionalProfileUpload, async (req, res) => {
  if (!supabase) {
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  let uploadResult = null;
  try {
    const workspaceId = String(req.params?.workspaceId || '').trim();
    const profileId = String(req.params?.profileId || '').trim();
    if (!workspaceId || !profileId) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(400).json({ ok: false, message: 'Identificativi non validi' });
    }

    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }
    const workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!workspace) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }

    const existingProfile = (workspace.profiles || []).find((profile) => profile.id === profileId);
    if (!existingProfile) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(404).json({ ok: false, message: 'Profilo non trovato' });
    }

    const parsed = profileInputSchema.safeParse(req.body || {});
    if (!parsed.success) {
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: parsed.error.flatten() });
    }

    const payload = parsed.data;
    const now = Date.now();
    const slug = sanitizeSlug(payload.slug || existingProfile.slug || existingProfile.label, existingProfile.label);
    const rawRemove = req.body?.removePdfLogo;
    const removePdfLogo = (() => {
      if (typeof rawRemove === 'boolean') return rawRemove;
      if (typeof rawRemove === 'string') {
        const normalized = rawRemove.trim().toLowerCase();
        return ['1', 'true', 'yes', 'on'].includes(normalized);
      }
      if (typeof rawRemove === 'number') {
        return Number(rawRemove) === 1;
      }
      return false;
    })();

    const basePdfLogo = payload.pdfLogo && typeof payload.pdfLogo === 'object'
      ? {
          fileName: sanitizeStorageFileName(
            payload.pdfLogo.fileName || payload.pdfLogoPath || existingProfile.pdfLogo?.fileName || 'logo.pdf',
            'logo.pdf'
          ),
          originalName: String(
            payload.pdfLogo.originalName ||
              payload.pdfLogo.fileName ||
              existingProfile.pdfLogo?.originalName ||
              ''
          ).trim(),
          storagePath:
            typeof payload.pdfLogo.storagePath === 'string' && payload.pdfLogo.storagePath.trim()
              ? payload.pdfLogo.storagePath.trim()
              : existingProfile.pdfLogo?.storagePath || '',
          updatedAt: Number.isFinite(payload.pdfLogo.updatedAt)
            ? Number(payload.pdfLogo.updatedAt)
            : Number.isFinite(existingProfile.pdfLogo?.updatedAt)
              ? Number(existingProfile.pdfLogo.updatedAt)
              : now,
        }
      : existingProfile.pdfLogo
        ? { ...existingProfile.pdfLogo }
        : null;

    const updatedProfile = {
      ...existingProfile,
      label: payload.label || existingProfile.label,
      slug,
      promptId: payload.promptId ?? existingProfile.promptId,
      pdfTemplate: payload.pdfTemplate ?? existingProfile.pdfTemplate,
      pdfLogoPath:
        typeof payload.pdfLogoPath === 'string'
          ? payload.pdfLogoPath.trim()
          : existingProfile.pdfLogoPath,
      pdfLogo: basePdfLogo,
      updatedAt: now,
    };

    const previousStoragePath = existingProfile?.pdfLogo?.storagePath || existingProfile?.pdfLogoPath || '';

    if (req.file) {
      const tempPath = await ensureTempFileHasExtension(req.file, VALID_LOGO_EXTENSIONS);
      try {
        uploadResult = await uploadProfileLogoToSupabase(tempPath, {
          workspaceId,
          profileId,
          slug,
          fileName: req.file.originalname,
          contentType: req.file.mimetype,
        });
      } catch (uploadError) {
        const message = uploadError?.message || 'Caricamento logo su Supabase non riuscito';
        return res.status(500).json({ ok: false, message });
      }

      const originalLabel = String(
        req.file.originalname ||
          payload.pdfLogo?.originalName ||
          existingProfile.pdfLogo?.originalName ||
          slug ||
          'logo.pdf'
      ).trim();
      updatedProfile.pdfLogoPath = uploadResult.publicUrl;
      updatedProfile.pdfLogo = {
        fileName: uploadResult.fileName,
        originalName: originalLabel,
        storagePath: uploadResult.storagePath,
        updatedAt: now,
      };
    }

    if (removePdfLogo && !uploadResult) {
      updatedProfile.pdfLogoPath = '';
      updatedProfile.pdfLogo = null;
    }

    const prompts = await listPrompts();
    const validationErrors = await validateWorkspaceProfiles([updatedProfile], { prompts });
    if (validationErrors.length) {
      if (uploadResult?.storagePath) {
        try {
          await deleteProfileLogoFromSupabase(uploadResult.storagePath);
        } catch (cleanupError) {
          console.warn('⚠️  Pulizia logo fallita dopo la validazione (update):', cleanupError?.message || cleanupError);
        }
      }
      if (req.file?.path) {
        await safeUnlink(req.file.path);
      }
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: validationErrors });
    }

    const saved = await updateProfileInDb(workspaceId, profileId, updatedProfile);

    if (removePdfLogo && previousStoragePath) {
      try {
        await deleteProfileLogoFromSupabase(previousStoragePath);
      } catch (cleanupError) {
        console.warn('⚠️  Impossibile eliminare il logo precedente:', cleanupError?.message || cleanupError);
      }
    } else if (uploadResult && previousStoragePath) {
      try {
        await deleteProfileLogoFromSupabase(previousStoragePath);
      } catch (cleanupError) {
        console.warn('⚠️  Impossibile eliminare il logo precedente:', cleanupError?.message || cleanupError);
      }
    }

    res.json({ ok: true, profile: profileForResponse(workspaceId, saved) });
  } catch (error) {
    if (uploadResult?.storagePath) {
      try {
        await deleteProfileLogoFromSupabase(uploadResult.storagePath);
      } catch (cleanupError) {
        console.warn('⚠️  Pulizia logo fallita dopo errore (update):', cleanupError?.message || cleanupError);
      }
    }
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  } finally {
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
  }
});

workspaceProfilesRouter.delete('/:profileId', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
  }
  try {
    const workspaceId = String(req.params?.workspaceId || '').trim();
    const profileId = String(req.params?.profileId || '').trim();
    if (!workspaceId || !profileId) {
      return res.status(400).json({ ok: false, message: 'Identificativi non validi' });
    }
    const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!ownerId) {
      return res.status(403).json({ ok: false, message: 'Utente non autorizzato' });
    }
    const workspace = await getWorkspaceFromDb(workspaceId, { ownerId });
    if (!workspace) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
    const existingProfile = (workspace.profiles || []).find((profile) => profile.id === profileId);
    if (!existingProfile) {
      return res.status(404).json({ ok: false, message: 'Profilo non trovato' });
    }
    const logoStoragePath = existingProfile?.pdfLogo?.storagePath || existingProfile?.pdfLogoPath || '';
    await deleteProfileFromDb(workspaceId, profileId);
    if (logoStoragePath) {
      try {
        await deleteProfileLogoFromSupabase(logoStoragePath);
      } catch (cleanupError) {
        console.warn('⚠️  Impossibile eliminare il logo del profilo rimosso:', cleanupError?.message || cleanupError);
      }
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || String(error) });
  }
});

workspaceProfilesRouter.get('/:profileId/logo', async (req, res) => {
  res.status(404).json({ ok: false, message: 'Logo non disponibile' });
});

app.use('/api/workspaces/:workspaceId/profiles', workspaceProfilesRouter);

app.get('/api/prompts', async (req, res) => {
  try {
    const prompts = await listPrompts();
    res.json({ ok: true, prompts });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.get('/api/templates', async (req, res) => {
  try {
    const templates = await listTemplatesMetadata();
    return res.json({ ok: true, templates });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error('❌ Errore durante la lettura dei template:', message);
    return res.status(500).json({ ok: false, message });
  }
});

app.post('/api/prompts', async (req, res) => {
  if (!supabase) {
    return res
      .status(503)
      .json({ ok: false, message: 'Supabase non configurato: impossibile creare nuovi prompt.' });
  }

  try {
    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'Titolo prompt obbligatorio' });
    }

    const slug = sanitizeSlug(req.body?.slug || title, title);
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
      : typeof req.body?.tags === 'string'
        ? req.body.tags
          .split(/,|\r?\n/)
          .map((tag) => String(tag || '').trim())
          .filter(Boolean)
        : [];
    const cueCards = normalizeCueCards(req.body?.cueCards);
    const checklistSections = normalizeChecklistSections(
      req.body?.checklist?.sections || req.body?.checklistSections || req.body?.checklist
    );
    const markdownRules = normalizePromptRules(req.body?.markdownRules || {});
    const pdfRules = normalizePdfRules(req.body?.pdfRules || {});
    const focusPrompts = Array.isArray(req.body?.focusPrompts)
      ? req.body.focusPrompts.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const workspaceId =
      typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() || null : null;

    const legacyId =
      String(req.body?.id || req.body?.legacyId || '').trim() || generateId('prompt');
    const timestamp = new Date().toISOString();

    const promptPayload = {
      id: legacyId,
      legacyId,
      workspaceId,
      slug,
      title,
      summary: String(req.body?.summary || '').trim(),
      description: String(req.body?.description || '').trim(),
      persona: String(req.body?.persona || '').trim(),
      color: normalizeColor(req.body?.color || '#6366f1'),
      tags,
      cueCards,
      checklist: { sections: checklistSections },
      markdownRules: markdownRules || null,
      pdfRules: pdfRules || null,
      focusPrompts,
      builtIn: Boolean(req.body?.builtIn === true),
    };

    if (focusPrompts.length) {
      promptPayload.checklist.focusPrompts = focusPrompts;
    }

    const dbPayload = promptToDbRecord(promptPayload);
    const { data, error } = await getSupabaseClient()
      .from('prompts')
      .insert({ ...dbPayload, created_at: timestamp, updated_at: timestamp })
      .select(SUPABASE_PROMPT_COLUMNS)
      .maybeSingle();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      const message =
        error.code === '23505'
          ? 'Slug o identificatore prompt già esistente.'
          : error.message || 'Impossibile creare il prompt.';
      return res.status(status).json({ ok: false, message });
    }

    if (!data) {
      return res.status(500).json({ ok: false, message: 'Impossibile creare il prompt.' });
    }

    const prompt = formatPromptForResponse(data) || promptPayload;
    return res.status(201).json({ ok: true, prompt });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.put('/api/prompts/:id', async (req, res) => {
  if (!supabase) {
    return res
      .status(503)
      .json({ ok: false, message: 'Supabase non configurato: impossibile aggiornare i prompt.' });
  }

  try {
    const existing = await fetchPromptByIdentifier(req.params.id);
    if (!existing) {
      return res.status(404).json({ ok: false, message: 'Prompt non trovato' });
    }

    const merged = mergePromptUpdate(existing, req.body || {});
    merged.legacyId = existing.legacyId || existing.id;
    merged.workspaceId =
      typeof req.body?.workspaceId === 'string'
        ? req.body.workspaceId.trim() || existing.workspaceId || null
        : existing.workspaceId || null;

    const dbPayload = promptToDbRecord(merged);
    let updateQuery = getSupabaseClient()
      .from('prompts')
      .update({ ...dbPayload, updated_at: new Date().toISOString() });

    if (existing.supabaseId) {
      updateQuery = updateQuery.eq('id', existing.supabaseId);
    } else if (existing.legacyId) {
      updateQuery = updateQuery.eq('legacy_id', existing.legacyId);
    } else {
      updateQuery = updateQuery.eq('legacy_id', existing.id);
    }

    const { data, error } = await updateQuery.select(SUPABASE_PROMPT_COLUMNS).maybeSingle();

    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      const message =
        error.code === '23505'
          ? 'Slug o identificatore prompt già esistente.'
          : error.message || 'Impossibile aggiornare il prompt.';
      return res.status(status).json({ ok: false, message });
    }

    if (!data) {
      return res.status(500).json({ ok: false, message: 'Impossibile aggiornare il prompt.' });
    }

    const prompt = formatPromptForResponse(data) || merged;
    return res.json({ ok: true, prompt });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.delete('/api/prompts/:id', async (req, res) => {
  if (!supabase) {
    return res
      .status(503)
      .json({ ok: false, message: 'Supabase non configurato: impossibile eliminare i prompt.' });
  }

  try {
    const prompt = await fetchPromptByIdentifier(req.params.id);
    if (!prompt) {
      return res.status(404).json({ ok: false, message: 'Prompt non trovato' });
    }

    const force = String(req.query?.force || '').toLowerCase().trim();
    const isForceEnabled = force && ['1', 'true', 'yes', 'on'].includes(force);
    if (prompt.builtIn && !isForceEnabled) {
      return res
        .status(400)
        .json({ ok: false, message: 'I template predefiniti non possono essere eliminati' });
    }

    let deleteQuery = getSupabaseClient().from('prompts').delete();
    if (prompt.supabaseId) {
      deleteQuery = deleteQuery.eq('id', prompt.supabaseId);
    } else if (prompt.legacyId) {
      deleteQuery = deleteQuery.eq('legacy_id', prompt.legacyId);
    } else {
      deleteQuery = deleteQuery.eq('legacy_id', prompt.id);
    }

    const { error } = await deleteQuery;
    if (error) {
      return res
        .status(500)
        .json({ ok: false, message: error.message || 'Impossibile eliminare il prompt.' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.get('/api/health', (req, res) => { res.json({ ok: true, ts: Date.now() }); });

app.get('/api/ai/providers', (req, res) => {
  try {
    const providers = listAiProviders();
    const defaults = getDefaultAiProviderMap();
    const configured = providers.filter((provider) => provider.configured).map((provider) => provider.id);
    return res.json({
      providers,
      defaults,
      configured,
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error?.message || 'Impossibile recuperare i provider AI';
    return res.status(500).json({ message });
  }
});

app.post('/api/pre-analyze', async (req, res) => {
  const workspaceId = getWorkspaceIdFromRequest(req);
  const anomalies = [];

  const aiOverrides = extractAiProviderOverrides(req);
  const transcriptionCandidates = [req.body?.transcription, req.body?.transcript, req.body?.text];
  let transcription = '';
  for (const candidate of transcriptionCandidates) {
    const sanitized = sanitizeMultilineString(candidate);
    if (sanitized) {
      transcription = sanitized;
      break;
    }
  }

  if (!transcription) {
    return res.status(400).json({ ok: false, message: 'Campo "transcription" obbligatorio.' });
  }

  if (!Array.isArray(req.body?.cueCards)) {
    return res.status(400).json({ ok: false, message: '"cueCards" deve essere un array.' });
  }

  const cueCards = sanitizeRefinedCueCardList(req.body.cueCards);
  if (!cueCards.length) {
    return res.status(400).json({ ok: false, message: 'Nessuna cue card valida fornita.' });
  }

  let provider;
  try {
    provider = resolveAiProvider('text', aiOverrides.text);
  } catch (error) {
    console.error('❌ Provider AI non disponibile per /api/pre-analyze:', error);
    return res
      .status(503)
      .json({ ok: false, message: error?.message || 'Provider AI non disponibile per la pre-analisi.' });
  }

  const promptPayload = {
    transcription,
    cueCards,
  };

  if (workspaceId) {
    promptPayload.workspaceId = workspaceId;
  }

  let prompt;
  try {
    prompt = await promptService.render('pre_analyze', promptPayload);
  } catch (error) {
    console.error('❌ Errore durante il rendering del prompt pre-analyze:', error);
    return res.status(500).json({ ok: false, message: 'Impossibile preparare il prompt di analisi.' });
  }

  if (process.env.DEBUG_PROMPTS === 'true') {
    console.log('\n--- PRE-ANALYZE PROMPT ---\n', prompt, '\n--- END PRE-ANALYZE PROMPT ---\n');
  }

  const aiClient = getAIService(provider.id, provider.apiKey, provider.model);

  let aiOutput = '';
  try {
    aiOutput = await aiOrchestrator.generateContentWithFallback(prompt, { 
      textProvider: aiOverrides.text,
      taskComplexity: 'low' // <--- FORZA MODELLO FLASH/MINI (Default, ma esplicito è meglio)
    });
  } catch (error) {
    console.error('❌ Errore AI /api/pre-analyze (tutti i provider hanno fallito):', error);
    return res.status(502).json({ ok: false, message: 'Errore durante la generazione delle risposte suggerite.' });
  }

  const cleanedOutput = (aiOutput || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed = {};
  if (cleanedOutput) {
    try {
      parsed = JSON.parse(cleanedOutput);
    } catch (error) {
      anomalies.push(`json_parse_error:${error.message}`);
      const start = cleanedOutput.indexOf('{');
      const end = cleanedOutput.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const candidate = cleanedOutput.slice(start, end + 1);
        try {
          parsed = JSON.parse(candidate);
        } catch (fallbackError) {
          anomalies.push(`json_parse_fallback_error:${fallbackError.message}`);
          parsed = {};
        }
      }
    }
  }

  let suggestionsSource = [];
  if (Array.isArray(parsed.suggestedAnswers)) {
    suggestionsSource = parsed.suggestedAnswers;
  } else if (Array.isArray(parsed.answers)) {
    anomalies.push('missing_suggestedAnswers_field');
    suggestionsSource = parsed.answers;
  } else if (Array.isArray(parsed.cueCards)) {
    anomalies.push('missing_suggestedAnswers_field');
    suggestionsSource = parsed.cueCards;
  } else if (cleanedOutput) {
    anomalies.push('missing_suggestions_array');
  }

  const suggestedAnswers = buildSuggestedAnswers(suggestionsSource, cueCards, anomalies);

  const modelName = aiClient.modelName || provider.model || '';

  if (anomalies.length) {
    console.warn('⚠️ /api/pre-analyze anomalies', {
      anomalies,
      provider: provider.id,
      model: modelName,
      workspaceId: workspaceId || null,
      rawOutputSample: cleanedOutput.slice(0, 400),
    });
  }

  return res.json({ ok: true, suggestedAnswers });
});

app.get('/api/diag', async (req, res) => {
  const logs = [];
  const out = (s) => { logs.push(s); };
  try {
    const ff = await commandVersion('ffmpeg');
    out(ff.ok ? `✅ ffmpeg: ${ff.detail}` : '❌ ffmpeg non trovato');
  } catch { out('❌ ffmpeg non eseguibile'); }

  try {
    
  } catch { out('❌ whisper non eseguibile'); }

  try {
    const wx = await run('bash', [
      '-lc',
      'if command -v whisperx >/dev/null 2>&1; then whisperx --help >/dev/null 2>&1 && echo whisperx-ok || echo whisperx-help-failed; else echo whisperx-missing; fi'
    ]);
    const diagToken = wx.stdout.trim();
    if (diagToken === 'whisperx-ok') {
      out('✅ whisperX: disponibile');
    } else if (diagToken === 'whisperx-help-failed') {
      out('⚠️ whisperX rilevato ma non eseguibile (controlla dipendenze)');
    } else {
      out('⚠️ whisperX non trovato (richiesto per diarizzazione)');
    }
  } catch {
    out('⚠️ whisperX non eseguibile');
  }

  out(HUGGING_FACE_TOKEN ? '✅ HUGGING_FACE_TOKEN configurato' : '⚠️ HUGGING_FACE_TOKEN non impostato');

  try {
    const g = await run('bash', ['-lc', 'command -v gemini']);
    out(g.code === 0 ? '✅ gemini: trovato' : '❌ gemini non trovato. Necessario per la generazione Markdown.');
  } catch { out('❌ gemini non eseguibile'); }

  try {
    const ppub = await bash('command -v ppubr >/dev/null || command -v PPUBR >/dev/null && echo OK || echo NO');
    out(ppub.stdout.includes('OK') ? `✅ ppubr/PPUBR: disponibile` : '❌ ppubr/PPUBR non trovato');
  } catch { out('❌ ppubr non disponibile'); }

  try {
    const pandoc = await bash('command -v pandocPDF >/dev/null && echo pandocPDF || command -v pandoc >/dev/null && echo pandoc || echo NO');
    out(/pandoc/i.test(pandoc.stdout) ? `✅ pandoc: ${pandoc.stdout.trim()}` : '⚠️ pandoc non trovato');
  } catch { out('⚠️ pandoc non disponibile'); }

  try {
    const defaultDest = DEFAULT_DEST_DIR;
    const writable = await ensureWritableDirectory(defaultDest);
    out(writable.ok ? `✅ Permessi scrittura OK su ${defaultDest}` : `❌ Permessi scrittura insufficienti su ${defaultDest}`);
  } catch { out('⚠️ Impossibile verificare permessi di scrittura'); }

  const ok = logs.some(l => l.startsWith('✅ ffmpeg')) && logs.some(l => /whisper: trovato/.test(l));
  res.json({ ok, logs });
});

// == REFACTORING ASYNC: runPipeline (estrazione logica) ==
const runPipeline = async (job = {}) => {
  const logs = [];
  // === INCOLLA QUI LO SNIPPET DI DEBUG ===
  try {
    const fs = require('fs');
    const path = require('path');
    // Verifica percorso assoluto previsto in Docker
    const checkPath = path.resolve(__dirname, '..', 'Templates', 'verbale_meeting.html'); 
    console.log(`[DEBUG DEPLOY] __dirname: ${__dirname}`);
    console.log(`[DEBUG DEPLOY] Cerco template in: ${checkPath}`);
    
    if (fs.existsSync(checkPath)) {
        console.log('✅ [DEBUG DEPLOY] Il file esiste su disco!');
    } else {
        console.log('❌ [DEBUG DEPLOY] FILE NON TROVATO.');
        // Listiamo cosa c'è nella cartella padre per capire dove siamo
        const parentDir = path.resolve(__dirname, '..');
        console.log(`Contenuto di ${parentDir}:`, fs.readdirSync(parentDir));
        // Se esiste la cartella Templates, vediamo cosa c'è dentro
        const tplDir = path.join(parentDir, 'Templates');
        if (fs.existsSync(tplDir)) {
           console.log(`Contenuto di Templates:`, fs.readdirSync(tplDir));
        }
    }
} catch (e) { console.log('[DEBUG ERROR]', e.message); }
// =======================================
  const stageEvents = [];
  let lastStageKey = null;
  let selectedPrompt = null;
  let promptRulePayload = null;
  let promptEnv = null;
  let promptFocus = '';
  let promptNotes = '';
  let promptCuesCompleted = [];
  let refinedDataPayload = null;
  const tempFiles = new Set();
  const tempDirs = new Set();
  let speakerLabels = [];
  let diarizedTranscriptEntries = [];
  let retrievedWorkspaceContext = '';

  const logStageEvent = (stage, status = 'info', message = '') => {
    if (!stage) return;
    const normalizedStatus = String(status || 'info').toLowerCase();
    stageEvents.push({ stage, status: normalizedStatus, message, ts: Date.now() });
    if (normalizedStatus === 'running') {
      lastStageKey = stage;
    } else if (['completed', 'done', 'success'].includes(normalizedStatus)) {
      if (lastStageKey === stage) lastStageKey = null;
    } else if (['failed', 'error'].includes(normalizedStatus)) {
      lastStageKey = stage;
    }
  };

  const out = (message, stage, status) => {
    logs.push(message);
    if (stage) {
      logStageEvent(stage, status || 'info', message);
    }
  };

  const registerTempDir = (dir) => {
    if (dir) tempDirs.add(dir);
    return dir;
  };

  const registerTempFile = (file) => {
    if (file) tempFiles.add(file);
    return file;
  };

  if (!supabase) {
    throw new Error('Supabase non configurato: impossibile elaborare il job');
  }

  const payload = isPlainObject(job.request_payload) ? job.request_payload : {};
  const userId = typeof job.user_id === 'string' && job.user_id.trim() ? job.user_id.trim() : 'anonymous';
  const userEmail = typeof job.user_email === 'string' ? job.user_email.trim() : String(payload.userEmail || '').trim();
  const audioStoragePath = typeof job.input_file_path === 'string' ? job.input_file_path.trim() : '';

  if (!audioStoragePath) {
    throw new Error('Percorso file audio mancante nel job');
  }

  const aiOverrides = {
    text: sanitizeAiProviderInput(
      payload.aiTextProvider || payload.textProvider || payload.aiOverrides?.text || payload.requestedTextProvider
    ),
    embedding: sanitizeAiProviderInput(
      payload.aiEmbeddingProvider || payload.embeddingProvider || payload.aiOverrides?.embedding
    ),
  };

  const updateJobStatus = async (statusPayload) => {
    if (!supabase || !job.id) {
      return;
    }
    try {
      await supabase.from(SUPABASE_JOBS_TABLE).update(statusPayload).eq('id', job.id);
    } catch (statusError) {
      logs.push(`⚠️ Aggiornamento stato job fallito: ${statusError.message || statusError}`);
    }
  };

  const throwWithStage = (stage, message) => {
    logStageEvent(stage, 'failed', message);
    throw new Error(message);
  };

  try {
    await updateJobStatus({ status: 'processing', processing_started_at: new Date().toISOString() });

    let slugInput = String(payload.slug || '').trim();
    const workspaceId = String(payload.workspaceId || '').trim();
    const workspaceProjectId = String(payload.workspaceProjectId || '').trim();
    const workspaceProjectName = String(payload.workspaceProjectName || payload.workspaceProject || '').trim();
    const workspaceStatus = String(payload.workspaceStatus || '').trim();
    const workspaceProfileId = String(payload.workspaceProfileId || '').trim();
    // ✅ CODICE CORRETTO (Sostituisci con questo)
const workspaceProfileTemplate = String(
  payload.workspaceProfileTemplate || // Usa 'payload', non 'bodyPayload'
  payload.pdfTemplate || 
  ''
).trim();
    const workspaceProfileLabel = String(payload.workspaceProfileLabel || '').trim();
    const workspaceProfileLogoPath = String(payload.workspaceProfileLogoPath || '').trim();
    const workspaceProfileLogoLabel = String(payload.workspaceProfileLogoLabel || '').trim();
    const workspaceProfileLogoDownloadUrl = String(payload.workspaceProfileLogoDownloadUrl || '').trim();
    promptFocus = String(payload.promptFocus || '').trim();
    promptNotes = String(payload.promptNotes || '').trim();

    if (payload.promptCuesCompleted) {
      try {
        const parsed =
          typeof payload.promptCuesCompleted === 'string'
            ? JSON.parse(payload.promptCuesCompleted)
            : payload.promptCuesCompleted;
        if (Array.isArray(parsed)) {
          promptCuesCompleted = parsed.map((item) => String(item || '').trim()).filter(Boolean);
        }
      } catch {
        promptCuesCompleted = [];
      }
    }

    const refinedExtraction = extractRefinedDataFromBody(payload || {});
    if (refinedExtraction.found) {
      if (refinedExtraction.error) {
        out(`⚠️ ${refinedExtraction.error}`, 'upload', 'warning');
      }
      const refinedResult = sanitizeRefinedDataInput(refinedExtraction.value);
      if (!refinedResult.ok) {
        out(`⚠️ refinedData non valido: ${refinedResult.error}`, 'upload', 'warning');
      } else if (refinedResult.value) {
        refinedDataPayload = refinedResult.value;
        out('✨ Dati di raffinazione ricevuti', 'upload', 'info');
      }
    }

    if (refinedDataPayload) {
      let mergedRefined = refinedDataPayload;
      if (!promptFocus && refinedDataPayload.focus) {
        promptFocus = refinedDataPayload.focus;
      } else if (promptFocus && refinedDataPayload.focus !== promptFocus) {
        mergedRefined = { ...mergedRefined, focus: promptFocus };
      }

      if (!promptNotes && refinedDataPayload.notes) {
        promptNotes = refinedDataPayload.notes;
      } else if (promptNotes && refinedDataPayload.notes !== promptNotes) {
        mergedRefined = { ...mergedRefined, notes: promptNotes };
      }

      refinedDataPayload = mergedRefined;
    }

    // --- FIX: Lettura robusta del flag diarizzazione ---
    // Controlliamo tutte le possibili chiavi che il frontend potrebbe inviare
    const rawDiarize = payload.diarize || payload.diarizeEnabled || payload.identifySpeakers;
    
    // Normalizziamo il valore per accettare booleani o stringhe ('true', 'on', '1')
    const diarizeEnabled = 
      rawDiarize === true || 
      String(rawDiarize).trim().toLowerCase() === 'true' || 
      String(rawDiarize).trim().toLowerCase() === 'on' || 
      String(rawDiarize).trim() === '1';
    // ---------------------------------------------------
    // --- DEBUG 1: Verifica il flag ---
    console.log(`[DEBUG PIPELINE] Flag Diarizzazione: ${diarizeEnabled} (Raw: ${rawDiarize})`);
    // --------------------------------
    out(
      diarizeEnabled
        ? '🗣️ Modalità riunione con diarizzazione WhisperX attivata.'
        : '🗣️ Modalità standard (voce singola) attiva.',
      'upload',
      'info'
    );

    let promptId = String(payload.promptId || '').trim();
    if (promptId) {
      const prompts = await listPrompts();
      selectedPrompt = findPromptById(prompts, promptId);
      if (!selectedPrompt) {
        out(`⚠️ Prompt ${promptId} non trovato`, 'upload', 'info');
      } else {
        promptRulePayload = buildPromptRulePayload(selectedPrompt, {
          focus: promptFocus,
          notes: promptNotes,
          completedCues: promptCuesCompleted,
        });
        if (promptRulePayload) {
          promptEnv = { REC2PDF_PROMPT_RULES: promptRulePayload };
          out(`🎯 Prompt attivo: ${selectedPrompt.title}`, 'upload', 'info');
        }
      }
    }

    let workspaceMeta = null;
    let workspaceProject = null;
    let destDir = DEFAULT_DEST_DIR;
    let workspaceProfile = null;
    if (workspaceId && supabase) {
      try {
        const foundWorkspace = await getWorkspaceFromDb(workspaceId, userId ? { ownerId: userId } : {});
        if (!foundWorkspace) {
          out(`⚠️ Workspace ${workspaceId} non trovato`, 'upload', 'info');
        } else {
          const { workspace: updatedWorkspace, changed, project } = upsertProjectInWorkspace(foundWorkspace, {
            projectId: workspaceProjectId,
            projectName: workspaceProjectName,
            status: workspaceStatus,
          });
          workspaceMeta = updatedWorkspace;
          workspaceProject = project;
          if (workspaceProfileId) {
            const profiles = Array.isArray(updatedWorkspace.profiles) ? updatedWorkspace.profiles : [];
            workspaceProfile = profiles.find((profile) => profile.id === workspaceProfileId) || null;
            if (!workspaceProfile) {
              out(`⚠️ Profilo ${workspaceProfileId} non trovato nel workspace ${updatedWorkspace.name}`, 'upload', 'info');
            } else {
              out(`✨ Profilo applicato: ${workspaceProfile.label || workspaceProfile.id}`, 'upload', 'info');
            }
          }
          if (changed) {
            try {
              workspaceMeta = await updateWorkspaceInDb(updatedWorkspace.id, updatedWorkspace);
              out(
                `📁 Workspace aggiornato con il progetto ${project?.name || workspaceProjectName || workspaceProjectId}`,
                'upload',
                'info'
              );
            } catch (persistError) {
              out(
                `⚠️ Aggiornamento workspace non riuscito: ${persistError?.message || persistError}`,
                'upload',
                'warning'
              );
            }
          }
        }
      } catch (workspaceError) {
        out(
          `⚠️ Errore nel recupero del workspace ${workspaceId}: ${workspaceError?.message || workspaceError}`,
          'upload',
          'warning'
        );
      }
    } else if (workspaceId && !supabase) {
      out('⚠️ Supabase non configurato: impossibile recuperare i workspace.', 'upload', 'warning');
    }

    if (!workspaceMeta && workspaceProfileId && !workspaceProfile && supabase) {
      try {
        const fallbackWorkspace = await findWorkspaceByProfileId(workspaceProfileId);
        if (fallbackWorkspace) {
          workspaceMeta = fallbackWorkspace;
          workspaceProfile = (fallbackWorkspace.profiles || []).find((profile) => profile.id === workspaceProfileId) || null;
          if (workspaceProfile) {
            out(
              `✨ Profilo applicato da workspace ${fallbackWorkspace.name}: ${workspaceProfile.label || workspaceProfile.id}`,
              'upload',
              'info'
            );
          }
        }
      } catch (fallbackError) {
        out(
          `⚠️ Errore nel recupero del profilo ${workspaceProfileId}: ${fallbackError?.message || fallbackError}`,
          'upload',
          'warning'
        );
      }
    }

    if (workspaceProfileLogoPath) {
      const labelCandidate =
        workspaceProfileLogoLabel ||
        workspaceProfile?.pdfLogo?.originalName ||
        workspaceProfileLabel ||
        workspaceProfile?.label ||
        workspaceProfileId ||
        '';
      if (workspaceProfile) {
        workspaceProfile = {
          ...workspaceProfile,
          pdfLogoPath: workspaceProfileLogoPath,
          pdfLogo: {
            ...(workspaceProfile.pdfLogo || {}),
            originalName: labelCandidate || workspaceProfile?.pdfLogo?.originalName || '',
            fileName:
              (workspaceProfile.pdfLogo && workspaceProfile.pdfLogo.fileName) ||
              path.basename(workspaceProfileLogoPath) ||
              'logo.pdf',
            updatedAt:
              (workspaceProfile.pdfLogo && workspaceProfile.pdfLogo.updatedAt) ||
              Date.now(),
          },
        };
      } else if (workspaceProfileId) {
        workspaceProfile = {
          id: workspaceProfileId,
          label: workspaceProfileLabel || labelCandidate || workspaceProfileId,
          slug: '',
          promptId: '',
          pdfTemplate: workspaceProfileTemplate || '',
          pdfLogoPath: workspaceProfileLogoPath,
          pdfLogo: labelCandidate
            ? {
                originalName: labelCandidate,
                fileName: path.basename(workspaceProfileLogoPath) || 'logo.pdf',
                updatedAt: Date.now(),
              }
            : null,
        };
      }
    }

    if (!slugInput && workspaceProfile?.slug) {
      slugInput = String(workspaceProfile.slug || '').trim();
    }
    if (!promptId && workspaceProfile?.promptId) {
      promptId = String(workspaceProfile.promptId || '').trim();
    }

    const resolveDestination = async () => {
      try {
        const manualDestInput = payload.dest;
        const projectDestCandidate =
          (workspaceProject && workspaceProject.destDir) ||
          sanitizeDestDirInput(payload.workspaceProjectDestDir || payload.projectDestDir || '');
        const workspaceDestCandidate =
          (workspaceMeta && workspaceMeta.destDir) ||
          sanitizeDestDirInput(payload.workspaceDestDir || payload.workspaceDestination || '');
        const destSource = manualDestInput || projectDestCandidate || workspaceDestCandidate || '';
        const destOrigin = manualDestInput
          ? 'manuale'
          : projectDestCandidate
            ? 'progetto'
            : workspaceDestCandidate
              ? 'workspace'
              : 'predefinita';
        const destConfig = await resolveDestinationDirectory(destSource);
        destDir = destConfig.dir;
        if (destOrigin === 'predefinita') {
          out(`📁 Cartella destinazione predefinita: ${destDir}`, 'upload', 'info');
        } else {
          const originLabel = destOrigin === 'manuale' ? 'manuale' : destOrigin === 'progetto' ? 'progetto' : 'workspace';
          out(`📁 Cartella destinazione (${originLabel}): ${destDir}`, 'upload', 'info');
        }
      } catch (destError) {
        const reason = destError?.reason || destError?.message || 'Cartella destinazione non scrivibile';
        out(`❌ Cartella destinazione non utilizzabile: ${reason}`, 'upload', 'failed');
        throwWithStage('upload', `Cartella destinazione non scrivibile: ${reason}`);
      }
    };

    await resolveDestination();

    const pipelineDir = registerTempDir(await fsp.mkdtemp(path.join(os.tmpdir(), 'rec2pdf_pipeline_')));

    const originalAudioName = String(payload.originalAudioName || path.basename(audioStoragePath) || 'audio').trim() || 'audio';
    const sanitizedOriginalName = sanitizeStorageFileName(payload.sanitizedAudioName || originalAudioName, 'audio');

    const slug = sanitizeSlug(slugInput || 'meeting', 'meeting');

    await resolveDestination();

    const baseName = workspaceMeta
      ? await buildWorkspaceBaseName(workspaceMeta, destDir, slug)
      : `${yyyymmddHHMMSS(new Date())}_${slug}`;

    const processedBasePath = `processed/${userId}`;
    const wavStoragePath = `${processedBasePath}/${baseName}.wav`;
    const transcriptExt = diarizeEnabled ? '.json' : '.txt';
    const transcriptStoragePath = `${processedBasePath}/${baseName}${transcriptExt}`;
    // --- DEBUG 2: Verifica i percorsi ---
    console.log(`[DEBUG PIPELINE] Path Trascrizione: ${transcriptStoragePath}`);
    console.log(`[DEBUG PIPELINE] Estensione: ${transcriptExt}`);
    // -----------------------------------
    const mdStoragePath = `${processedBasePath}/documento_${baseName}.md`;
    const pdfStoragePath = `${processedBasePath}/documento_${baseName}.pdf`;

    out('🧩 Esecuzione pipeline con Supabase Storage…', 'upload', 'info');

    out('🎛️ Transcodifica in WAV…', 'transcode', 'running');
    const originalExt = path.extname(sanitizedOriginalName) || path.extname(originalAudioName) || '';
    const audioLocalPath = registerTempFile(path.join(pipelineDir, `${baseName}${originalExt || '.audio'}`));
    const wavLocalPath = registerTempFile(path.join(pipelineDir, `${baseName}.wav`));
    try {
      const downloadedAudio = await downloadFileFromBucket(SUPABASE_AUDIO_BUCKET, audioStoragePath);
      await fsp.writeFile(audioLocalPath, downloadedAudio);

      const transcodeAndValidate = async (targetPath) => {
        const ffmpegArgs = ['-y', '-i', audioLocalPath, '-ac', '1', '-ar', '16000', '-loglevel', 'error', targetPath];
        const ff = await run('ffmpeg', ffmpegArgs);
        if (ff.code !== 0) {
          const ffMessage =
            (typeof ff.stderr === 'string' && ff.stderr.trim()) ||
            (typeof ff.stdout === 'string' && ff.stdout.trim()) ||
            'ffmpeg ha restituito un codice di errore non-zero.';
          out(ffMessage, 'transcode', 'failed');
          throw new Error(`Transcodifica fallita: ${ff.stderr || ffMessage}`);
        }

        try {
          const stats = await fsp.stat(targetPath);
          if (stats.size < 1024) {
            throw new Error('Il file WAV generato è vuoto o corrotto.');
          }
        } catch (statError) {
          out(`Verifica del file WAV fallita: ${statError.message}`, 'transcode', 'failed');
          throw new Error('Transcodifica fallita: il file WAV di output non è stato creato correttamente.');
        }
      };

      if (audioLocalPath === wavLocalPath) {
        const tempWavPath = registerTempFile(path.join(pipelineDir, `${baseName}_temp.wav`));
        await transcodeAndValidate(tempWavPath);
        await fsp.rename(tempWavPath, wavLocalPath);
      } else {
        await transcodeAndValidate(wavLocalPath);
      }

      await uploadFileToBucket(
        SUPABASE_PROCESSED_BUCKET,
        wavStoragePath,
        await fsp.readFile(wavLocalPath),
        'audio/wav'
      );
      out('✅ Transcodifica completata', 'transcode', 'completed');
    } finally {
      await safeUnlink(audioLocalPath);
      await safeUnlink(wavLocalPath);
    }

    out(
      diarizeEnabled
        ? '🎧 Trascrizione + diarizzazione con WhisperX…'
        : '🎧 Trascrizione con Whisper…',
      'transcribe',
      'running'
    );
    const wavLocalForTranscribe = registerTempFile(path.join(pipelineDir, `${baseName}.wav`));
    let transcriptLocalPath = '';
    const performTranscription = async () => {
      // --- DEBUG 3: Verifica dentro la funzione ---
      console.log(`[DEBUG WORKER] Avvio trascrizione. Diarize attivo? ${diarizeEnabled}`);
      // --------------------------------------------
      const wavBuffer = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, wavStoragePath);
      await fsp.writeFile(wavLocalForTranscribe, wavBuffer);
      const transcribeOutputDir = pipelineDir;
      if (diarizeEnabled) {
        if (!HUGGING_FACE_TOKEN) {
          out('❌ HUGGING_FACE_TOKEN mancante: impossibile eseguire diarizzazione', 'transcribe', 'failed');
          throw new Error('Diarizzazione WhisperX non disponibile: HUGGING_FACE_TOKEN non configurato');
        }
        const diarizeCmd = [
          'whisperx',
          JSON.stringify(wavLocalForTranscribe),
          '--language it',
          '--compute_type float32',
          '--diarize',
          `--hf_token ${JSON.stringify(HUGGING_FACE_TOKEN)}`,
          `--output_dir ${JSON.stringify(transcribeOutputDir)}`,
          '--output_format json'
        ].join(' ');
        const wx = await run('bash', ['-lc', diarizeCmd]);
        if (wx.code !== 0) {
          out(wx.stderr || wx.stdout || 'whisperX failed', 'transcribe', 'failed');
          throw new Error('Trascrizione fallita (whisperX)');
        }
        const candidates = (await fsp.readdir(transcribeOutputDir)).filter(
          (file) => file.startsWith(baseName) && file.endsWith('.json')
        );
        if (!candidates.length) {
          throw new Error('Trascrizione diarizzata .json non trovata');
        }
        transcriptLocalPath = registerTempFile(path.join(transcribeOutputDir, candidates[0]));
      } else {
        const whisperxCmd = [
          'whisperx',
          JSON.stringify(wavLocalForTranscribe),
          '--language it',
          '--model small',
          '--device cpu',
          '--compute_type float32',
          '--output_format txt',
          `--output_dir ${JSON.stringify(transcribeOutputDir)}`
        ].join(' ');
        const w = await run('bash', ['-lc', whisperxCmd]);
        if (w.code !== 0) {
          out(w.stderr || w.stdout || 'whisper failed', 'transcribe', 'failed');
          throw new Error('Trascrizione fallita');
        }
        const dirEntries = await fsp.readdir(transcribeOutputDir);
        const txtCandidates = dirEntries.filter((file) => file.endsWith('.txt'));
        const preferredTxt =
          txtCandidates.find((file) => file.startsWith(baseName)) || txtCandidates[0] || '';

        if (preferredTxt) {
          transcriptLocalPath = registerTempFile(path.join(transcribeOutputDir, preferredTxt));
        } else {
          // Fallback: alcune build di whisperx producono solo .json/.vtt/.srt/.tsv
          const fallback = dirEntries.find(
            (file) =>
              file.startsWith(baseName) &&
              (file.endsWith('.json') || file.endsWith('.vtt') || file.endsWith('.srt') || file.endsWith('.tsv'))
          );
          if (fallback) {
            out(`ℹ️ Trascrizione .txt assente, uso file ${fallback}`, 'transcribe', 'warning');
            transcriptLocalPath = registerTempFile(path.join(transcribeOutputDir, fallback));
          } else {
            // Secondo fallback: prova CLI whisper standard se presente
            const whisperTxtPath = path.join(transcribeOutputDir, `${baseName}.txt`);
            const whisperAvailable = await run('bash', ['-lc', 'command -v whisper >/dev/null']);
            if (whisperAvailable.code !== 0) {
              const filesFound = dirEntries.length ? dirEntries.join(', ') : 'nessun file';
              throwWithStage(
                'transcribe',
                `Trascrizione .txt non trovata (file presenti: ${filesFound}); CLI whisper non installata per il fallback`
              );
            }

            const whisperCmd = [
              'whisper',
              JSON.stringify(wavLocalForTranscribe),
              '--language it',
              '--model base',
              '--output_format txt',
              `--output_dir ${JSON.stringify(transcribeOutputDir)}`
            ].join(' ');
            const whisperRun = await run('bash', ['-lc', whisperCmd]);
            if (whisperRun.code === 0) {
              try {
                await fsp.access(whisperTxtPath);
                out('ℹ️ Fallback whisper CLI riuscito', 'transcribe', 'warning');
                transcriptLocalPath = registerTempFile(whisperTxtPath);
              } catch {
                const filesFound = dirEntries.length ? dirEntries.join(', ') : 'nessun file';
                throwWithStage('transcribe', `Trascrizione .txt non trovata (file presenti: ${filesFound})`);
              }
            } else {
              const filesFound = dirEntries.length ? dirEntries.join(', ') : 'nessun file';
              const stderr = whisperRun.stderr || whisperRun.stdout || 'whisper non disponibile';
              throwWithStage(
                'transcribe',
                `Trascrizione .txt non trovata (file presenti: ${filesFound}) - fallback whisper: ${stderr}`
              );
            }
          }
        }
      }
      const transcriptMime = diarizeEnabled ? 'application/json' : 'text/plain';
      await uploadFileToBucket(
        SUPABASE_PROCESSED_BUCKET,
        transcriptStoragePath,
        await fsp.readFile(transcriptLocalPath),
        transcriptMime
      );
      out(
        diarizeEnabled
          ? `✅ Trascrizione diarizzata completata: ${path.basename(transcriptLocalPath)}`
          : `✅ Trascrizione completata: ${path.basename(transcriptLocalPath)}`,
        'transcribe',
        'completed'
      );
    };

    try {
      await performTranscription();
    } finally {
      await safeUnlink(wavLocalForTranscribe);
      await safeUnlink(transcriptLocalPath);
    }

    const manualTemplateSelection = workspaceProfileTemplate;
    const profileTemplateSetting = workspaceProfile?.pdfTemplate;

    let activeTemplateDescriptor = null;
    let activeTemplateIsFallback = false;
    let isSimpleMode = false; // <--- AGGIUNGI QUESTO

    if (manualTemplateSelection) {
      if (isPandocFallbackTemplate(manualTemplateSelection)) {
        out('📄 Template manuale: Semplice (Mappato su default.tex)', 'publish', 'info');
        try {
          activeTemplateDescriptor = await resolveTemplateDescriptor('default.tex');
          activeTemplateIsFallback = false;
          isSimpleMode = true; // <--- ATTIVIAMO LA MODALITÀ SEMPLICE
        } catch (err) {
          out(`⚠️ Impossibile caricare default.tex per il fallback: ${err.message}`, 'publish', 'warning');
          activeTemplateIsFallback = true; // Solo se fallisce il caricamento usiamo il vecchio metodo
        }
      } else {
        try {
          activeTemplateDescriptor = await resolveTemplateDescriptor(manualTemplateSelection);
          out(`📄 Template manuale applicato: ${activeTemplateDescriptor.fileName}`, 'publish', 'info');
        } catch (templateError) {
           // ... gestione errore esistente ...
        }
      }
    }

    if (!activeTemplateDescriptor && !activeTemplateIsFallback && profileTemplateSetting) {
      if (isPandocFallbackTemplate(profileTemplateSetting)) {
        out('📄 Template del profilo: Semplice (Mappato su default.tex)', 'publish', 'info');
        try {
            activeTemplateDescriptor = await resolveTemplateDescriptor('default.tex');
            activeTemplateIsFallback = false;
        } catch (err) {
            activeTemplateIsFallback = true;
        }
      } else {
         // ... resto del codice esistente ...
         try {
          activeTemplateDescriptor = await resolveTemplateDescriptor(profileTemplateSetting);
          out(`📄 Template del profilo applicato: ${activeTemplateDescriptor.fileName}`, 'publish', 'info');
        } catch (templateError) {
           // ...
        }
      }
    }

    if (!activeTemplateDescriptor && !activeTemplateIsFallback && selectedPrompt) {
      activeTemplateDescriptor = await resolvePromptTemplateDescriptor(selectedPrompt, { logger: out });
    }

    if (!activeTemplateDescriptor && !activeTemplateIsFallback && diarizeEnabled) {
      try {
        activeTemplateDescriptor = await resolveTemplateDescriptor('verbale_meeting.html');
        out(`📄 Template diarizzazione fallback: ${activeTemplateDescriptor.fileName}`, 'publish', 'info');
      } catch (templateError) {
        const reason =
          templateError instanceof TemplateResolutionError
            ? templateError.userMessage
            : templateError?.message || templateError;
        out(`⚠️ Template fallback diarizzazione non accessibile: ${reason}`, 'publish', 'warning');
      }
    }

    const forcePandocFallback = activeTemplateIsFallback;

    out('📝 Generazione Markdown…', 'markdown', 'running');
    let transcriptLocalForMarkdown = '';
    let mdLocalPath = '';
    try {
      const transcriptBuffer = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, transcriptStoragePath);
      transcriptLocalForMarkdown = registerTempFile(path.join(pipelineDir, `${baseName}${transcriptExt}`));
      await fsp.writeFile(transcriptLocalForMarkdown, transcriptBuffer);
      let transcriptTextForQuery = '';
      if (diarizeEnabled) {
        try {
          const parsedTranscript = JSON.parse(transcriptBuffer.toString('utf8'));
          console.log(`[DEBUG DIARIZE] Segmenti trovati nel JSON: ${parsedTranscript?.segments?.length}`);
          const normalizedSegments = normalizeDiarizedSegments(parsedTranscript?.segments || []);
          // --- FIX: Popolamento esplicito ---
         // --- FIX: Pulizia caratteri e uso 'message' ---
         diarizedTranscriptEntries = normalizedSegments.map(seg => ({
          speaker: String(seg.speakerLabel || 'Speaker Sconosciuto').trim(),
          timestamp: String(seg.timestamp || '').trim(),
          // Rimuoviamo caratteri di controllo strani che potrebbero rompere il PDF
          message: String(seg.text || '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "").trim()
        }));
        // ----------------------------------------------
  

// Opzioni per il dump YAML per renderlo più digeribile a Pandoc
const yamlFrontMatter = yaml.dump(frontMatter, {
  lineWidth: -1,      // Evita di spezzare le righe lunghe (causa spesso problemi)
  noRefs: true,       // Evita alias YAML (&ref) che Pandoc odia
  quotingType: '"'    // Forza virgolette doppie per evitare problemi con apostrofi
});
          if (normalizedSegments.length) {
            const speakerSet = new Set();
            const transcriptTexts = [];
            diarizedTranscriptEntries = normalizedSegments.map((segment) => {
              if (segment.speakerRaw) {
                speakerSet.add(segment.speakerRaw);
              } else if (segment.speakerLabel) {
                speakerSet.add(segment.speakerLabel);
              }
              if (segment.text) {
                transcriptTexts.push(segment.text);
              }
              return {
                speaker: segment.speakerLabel,
                timestamp: segment.timestamp,
                paragraphs: [segment.text],
                raw_label: segment.speakerRaw,
              };
            });
            speakerLabels = Array.from(speakerSet).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
            transcriptTextForQuery = transcriptTexts.join(' ');
          } else {
            speakerLabels = [];
            diarizedTranscriptEntries = [];
          }
        } catch (parseError) {
          out(
            `⚠️ Impossibile analizzare gli speaker diarizzati: ${parseError?.message || parseError}`,
            'transcribe',
            'warning'
          );
          speakerLabels = [];
          diarizedTranscriptEntries = [];
        }
      } else {
        transcriptTextForQuery = transcriptBuffer.toString('utf8');
      }

      mdLocalPath = registerTempFile(path.join(pipelineDir, `documento_${baseName}.md`));

      const {
        title: aiTitle,
        summary: aiSummary,
        author: aiAuthor,
        content: markdownBody,
        modelName: aiModel,
        key_points: aiKeyPoints, // <--- AGGIUNGI QUESTO
      } = await generateMarkdown(
        transcriptLocalForMarkdown,
        promptRulePayload,
        {
          workspaceId,
          projectId: workspaceProjectId,
          textProvider: aiOverrides.text,
          embeddingProvider: aiOverrides.embedding,
          refinedData: refinedDataPayload,
          focus: promptFocus,
          notes: promptNotes,
        }
      );

      const now = new Date();
      const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
// ==================================================================================
    // === [FIX DEFINITIVO $200] COSTRUZIONE E INIEZIONE SICURA DEL FRONTMATTER ===
    // ==================================================================================
    
    // 1. Creazione oggetto base
    const frontMatter = {
      title: aiTitle || String(payload.title || baseName).trim(),
      author: aiAuthor || userEmail || 'rec2pdf',
      owner: workspaceProject?.name || workspaceMeta?.client || '',
      project_name: workspaceProject?.name || workspaceProjectName || '',
      project_code: workspaceMeta?.slug || workspaceId || '',
      artifact_type: 'Report',
      version: 'v1_0_0',
      identifier: baseName,
      location: destDir,
      summary: aiSummary || String(payload.summary || '').trim(),
      // === FIX: INIEZIONE DATI PER TEMPLATE ===
      key_points: aiKeyPoints, 
      // ========================================
      ssot: false,
      status: workspaceStatus || '',
      created: localTimestamp,
      updated: localTimestamp,
      tags: selectedPrompt?.tags || [],
      ai: {
        generated: true,
        model: aiModel || '',
        prompt_id: selectedPrompt?.id || '',
      },
      // Campi legacy per compatibilità
      BLDTitle: aiTitle || String(payload.title || baseName).trim(),
      BLDVersion: 'v1_0_0',
      BLDUpdated: new Date().toLocaleDateString('it-IT'),
      BLDAuthor: aiAuthor || userEmail || 'rec2pdf',
      // Regole PDF
      pdfRules: selectedPrompt?.pdfRules || { layout: 'verbale_meeting', template: 'verbale_meeting.html' }
  };

  // 2. Logica FAIL-SAFE per la trascrizione
  // Se la variabile in memoria è vuota, proviamo a ricaricare il JSON dal disco per sicurezza
  let finalTranscriptData = diarizedTranscriptEntries;

  if ((!finalTranscriptData || finalTranscriptData.length === 0) && diarizeEnabled) {
      console.warn("⚠️ [FIX SICUREZZA] Variabile in memoria vuota. Tento ricaricamento d'emergenza dal JSON...");
      try {
          const jsonRaw = await fsp.readFile(transcriptLocalForMarkdown, 'utf8');
          const jsonParsed = JSON.parse(jsonRaw);
          if (jsonParsed.segments) {
               finalTranscriptData = jsonParsed.segments.map(seg => ({
                  speaker: String(seg.speakerLabel || seg.speaker || "Speaker").trim(),
                  timestamp: String(seg.timestamp || "").trim(),
                  message: String(seg.text || "").trim()
              }));
              console.log(`✅ [FIX SICUREZZA] Recuperati ${finalTranscriptData.length} segmenti dal disco.`);
          }
      } catch (err) {
          console.error("❌ [FIX SICUREZZA] Ricaricamento fallito:", err.message);
      }
  }

  // 3. Iniezione Finale
  if (finalTranscriptData && finalTranscriptData.length > 0) {
      console.log(`🚀 [INIEZIONE AVVENUTA] Scrivo ${finalTranscriptData.length} segmenti nel meeting_transcript.`);
      
      // Iniezione pulita
      frontMatter.meeting_transcript = finalTranscriptData.map(entry => ({
          speaker: entry.speaker,
          timestamp: entry.timestamp,
          message: entry.message
      }));
      
      // Doppio check per template vecchi
      frontMatter.transcript = frontMatter.meeting_transcript;
      if (!frontMatter.metadata) frontMatter.metadata = {};
      frontMatter.metadata.transcript = frontMatter.meeting_transcript;
  } else {
      console.warn("⚠️ [ATTENZIONE] Il meeting_transcript sarà VUOTO nel PDF.");
  }

  // 4. Pulizia chiavi vuote (senza toccare array pieni)
  Object.keys(frontMatter).forEach((key) => {
      const value = frontMatter[key];
      if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
          delete frontMatter[key];
      }
  });

  // 5. Dump YAML Sicuro
  const yamlFrontMatter = yaml.dump(frontMatter, {
      lineWidth: -1,
      noRefs: true,
      quotingType: '"'
  });
  
  // ==================================================================================
      const cleanedMarkdownBody = normalizeAiMarkdownBody(markdownBody);
      const finalMarkdownContent = `---\n${yamlFrontMatter}---\n\n${cleanedMarkdownBody}`;
      await fsp.writeFile(mdLocalPath, finalMarkdownContent, 'utf8');
      // --- DEBUG TEMPORANEO ---
console.log('⚠️  [DEBUG MAC M1] Ispezione Frontmatter YAML:');
// Estraiamo solo la parte YAML (tra i primi due ---)
const debugYaml = finalMarkdownContent.split('---')[1]; 
console.log(debugYaml); 
console.log('⚠️  [DEBUG MAC M1] Fine Ispezione');
// ------------------------

      await uploadFileToBucket(
        SUPABASE_PROCESSED_BUCKET,
        mdStoragePath,
        await fsp.readFile(mdLocalPath),
        'text/markdown'
      );
      out(`✅ Markdown generato: ${path.basename(mdLocalPath)}`, 'markdown', 'completed');
    } finally {
      await safeUnlink(transcriptLocalForMarkdown);
      await safeUnlink(mdLocalPath);
    }

    out('📄 Pubblicazione PDF con publish.sh…', 'publish', 'running');
    let customLogoPath = '';

    const customLogoDescriptor = isPlainObject(payload.customLogo) ? payload.customLogo : null;
    const customLogoBucket = customLogoDescriptor?.bucket || payload.customLogoBucket || SUPABASE_LOGO_BUCKET;
    const customLogoObjectPath =
      customLogoDescriptor?.path || payload.customLogoPath || payload.pdfLogoStoragePath || payload.customLogoObjectPath || '';

    if (customLogoObjectPath) {
      try {
        const logoBuffer = await downloadFileFromBucket(customLogoBucket, customLogoObjectPath);
        const logoExt = path.extname(customLogoObjectPath) || '.png';
        const safeName = sanitizeStorageFileName(path.basename(customLogoObjectPath) || `logo${logoExt}`, `logo${logoExt}`);
        customLogoPath = registerTempFile(path.join(pipelineDir, safeName));
        await fsp.writeFile(customLogoPath, logoBuffer);
        out('🎨 Logo personalizzato recuperato dallo storage', 'publish', 'info');
      } catch (logoError) {
        out(`⚠️ Recupero logo personalizzato fallito: ${logoError?.message || logoError}`, 'publish', 'warning');
        customLogoPath = '';
      }
    }

    if (!customLogoPath && workspaceProfileLogoDownloadUrl) {
      try {
        const response = await fetch(workspaceProfileLogoDownloadUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const downloadUrl = new URL(workspaceProfileLogoDownloadUrl, 'http://localhost');
        const urlName = path.basename(downloadUrl.pathname) || 'logo.pdf';
        const preferredName =
          workspaceProfileLogoLabel ||
          workspaceProfile?.pdfLogo?.originalName ||
          urlName ||
          'logo.pdf';
        const safeName = sanitizeStorageFileName(preferredName, 'logo.pdf');
        const tempLogoPath = registerTempFile(path.join(pipelineDir, safeName));
        await fsp.writeFile(tempLogoPath, buffer);
        customLogoPath = tempLogoPath;
        out(`🎨 Logo scaricato dal profilo: ${safeName}`, 'publish', 'info');
      } catch (downloadError) {
        out(
          `⚠️ Download logo profilo fallito: ${downloadError?.message || downloadError}`,
          'publish',
          'warning'
        );
      }
    }

    const publishEnv = buildEnvOptions(
      promptEnv,
      customLogoPath ? { CUSTOM_PDF_LOGO: customLogoPath } : null,
      activeTemplateDescriptor ? buildTemplateEnv(activeTemplateDescriptor) : null,
      // AGGIUNGI QUESTA RIGA:
      isSimpleMode ? { PDF_SIMPLE_MODE: 'true' } : null
    );

    let mdLocalForPublish = '';
    let pdfLocalPath = '';
    let finalMdPath = '';
    let finalPdfPath = '';
    try {
      const mdBufferForPublish = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, mdStoragePath);
      mdLocalForPublish = registerTempFile(path.join(pipelineDir, `documento_${baseName}.md`));
      await fsp.writeFile(mdLocalForPublish, mdBufferForPublish);
      pdfLocalPath = registerTempFile(path.join(path.dirname(mdLocalForPublish), `documento_${baseName}.pdf`));

      await publishWithTemplateFallback({
        mdLocalPath: mdLocalForPublish,
        pdfLocalPath,
        publishEnv,
        templateInfo: activeTemplateDescriptor,
        logger: out,
        forcePandocFallback,
      });

      await uploadFileToBucket(
        SUPABASE_PROCESSED_BUCKET,
        pdfStoragePath,
        await fsp.readFile(pdfLocalPath),
        'application/pdf'
      );

      const destMdPath = path.join(destDir, path.basename(mdLocalForPublish));
      const destPdfPath = path.join(destDir, path.basename(pdfLocalPath));
      try {
        await fsp.copyFile(mdLocalForPublish, destMdPath);
        await fsp.copyFile(pdfLocalPath, destPdfPath);
        finalMdPath = destMdPath;
        finalPdfPath = destPdfPath;
        out(`📁 Artefatti salvati in ${destDir}`, 'publish', 'info');
      } catch (copyError) {
        const reason = copyError?.message || 'Salvataggio nella cartella di destinazione fallito';
        out(`❌ Salvataggio cartella destinazione fallito: ${reason}`, 'publish', 'failed');
        throw new Error(`Salvataggio cartella destinazione fallito: ${reason}`);
      }

      out(`✅ Fatto! PDF caricato su Supabase: ${path.basename(pdfLocalPath)}`, 'publish', 'completed');
    } finally {
      await safeUnlink(mdLocalForPublish);
      await safeUnlink(pdfLocalPath);
    }

    out('🎉 Pipeline completata', 'complete', 'completed');

    let structure = null;
    let analysisMdPath = '';
    try {
      const mdBufferForAnalysis = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, mdStoragePath);
      analysisMdPath = registerTempFile(path.join(pipelineDir, `documento_${baseName}_analysis.md`));
      await fsp.writeFile(analysisMdPath, mdBufferForAnalysis);
      structure = await analyzeMarkdownStructure(analysisMdPath, { prompt: selectedPrompt });
    } finally {
      await safeUnlink(analysisMdPath);
    }

    const workspaceAssignment = workspaceAssignmentForResponse(workspaceMeta, workspaceProject, workspaceStatus);
    if (workspaceAssignment && workspaceProfile) {
      workspaceAssignment.profileId = workspaceProfile.id;
      workspaceAssignment.profileLabel = workspaceProfile.label || workspaceProfile.id;
    }
    const promptAssignment = promptAssignmentForResponse(selectedPrompt, {
      focus: promptFocus,
      notes: promptNotes,
      completedCues: promptCuesCompleted,
    });

    const result = {
      ok: true,
      pdfPath: `${SUPABASE_PROCESSED_BUCKET}/${pdfStoragePath}`,
      mdPath: `${SUPABASE_PROCESSED_BUCKET}/${mdStoragePath}`,
      localPdfPath: finalPdfPath,
      localMdPath: finalMdPath,
      logs,
      stageEvents,
      workspace: workspaceAssignment,
      prompt: promptAssignment,
      structure,
      speakers: speakerLabels,
      refinedData: refinedDataPayload,
    };

    await updateJobStatus({
      status: 'completed',
      completed_at: new Date().toISOString(),
      output_pdf_path: pdfStoragePath,
      output_md_path: mdStoragePath,
      worker_log: logs.join('\n'),
    });

    return result;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const failureStage = lastStageKey || 'complete';
    const hasFailureEvent = stageEvents.some((evt) => evt.stage === failureStage && evt.status === 'failed');
    if (!hasFailureEvent) {
      logStageEvent(failureStage, 'failed', message);
    }
    if (!stageEvents.some((evt) => evt.stage === 'complete')) {
      logStageEvent('complete', 'failed', 'Pipeline interrotta');
    }
    out('❌ Errore durante la pipeline', 'complete', 'failed');
    out(message);

    const pipelineError = error instanceof Error ? error : new Error(message);
    pipelineError.logs = logs;
    pipelineError.stageEvents = stageEvents;

    await updateJobStatus({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: message,
      worker_log: logs.join('\n'),
    });

    return { ok: false, error: message, logs, stageEvents };
  } finally {
    for (const filePath of tempFiles) {
      await safeUnlink(filePath);
    }
    for (const dirPath of tempDirs) {
      await safeRemoveDir(dirPath);
    }
  }
};
// == REFACTORING ASYNC: fine runPipeline ==


// In server.js

// In server.js
app.post('/api/worker/trigger', async (req, res) => {
  try {
    const expectedSecretRaw = process.env.WORKER_SECRET;
    const receivedSecretRaw = req.headers['x-worker-secret'];
    const expectedSecret = typeof expectedSecretRaw === 'string' ? expectedSecretRaw.trim() : '';
    const receivedSecret = typeof receivedSecretRaw === 'string' ? receivedSecretRaw.trim() : '';

    if (!expectedSecret) {
      console.error('[WORKER TRIGGER] ERRORE CRITICO: WORKER_SECRET non è definito.');
      return res.status(500).json({ ok: false, message: 'Worker secret non configurato.' });
    }

    const expectedBuffer = Buffer.from(expectedSecret);
    const receivedBuffer = Buffer.from(receivedSecret);
    let isAuthorized = false;
    if (expectedBuffer.length === receivedBuffer.length && expectedBuffer.length > 0) {
      isAuthorized = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
    }

    if (!isAuthorized) {
      console.error('[WORKER TRIGGER] Fallimento autorizzazione (segreto mancante o non valido).');
      return res.status(401).json({ ok: false, message: 'Unauthorized worker request' });
    }
    
    const bodyPayload = req.body;
    const jobRecord = isPlainObject(bodyPayload.record) ? bodyPayload.record : null;

    if (!jobRecord || !jobRecord.id) {
      console.error('[WORKER TRIGGER] Payload job non valido.');
      return res.status(400).json({ ok: false, message: 'Payload job non valido.' });
    }

    console.log(`[WORKER TRIGGER] Avvio elaborazione per il job: ${jobRecord.id}`);
    runPipeline(jobRecord)
      .then((result) => {
        if (result && result.ok === false) {
          console.error(
            `[WORKER TRIGGER] Elaborazione job ${jobRecord.id} fallita:`,
            result.error || 'Errore sconosciuto'
          );
        }
      })
      .catch((pipelineError) => {
        console.error(
          `[WORKER TRIGGER] Elaborazione job ${jobRecord.id} fallita:`,
          pipelineError?.stack || pipelineError
        );
      });

    return res.status(202).json({ ok: true, message: 'Job trigger ricevuto.' });

  } catch (error) {
    console.error('❌ Errore grave nel worker trigger:', error);
    return res.status(500).json({ ok: false, message: 'Errore interno del worker trigger' });
  }
});
// == REFACTORING ASYNC: fine worker trigger ==

// == REFACTORING ASYNC: Endpoint stato job ==
app.get('/api/jobs/:id', authenticateRequest, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
    }

    const jobId = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
    if (!jobId) {
      return res.status(400).json({ ok: false, message: 'Identificatore job non valido' });
    }

    const userId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'Utente non autenticato' });
    }

    const { data: jobRecord, error } = await supabase
      .from(SUPABASE_JOBS_TABLE)
      .select('id, status, error_message, output_pdf_path, output_md_path, user_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Recupero job fallito:', error.message || error);
      return res.status(500).json({ ok: false, message: 'Impossibile recuperare il job' });
    }

    if (!jobRecord) {
      return res.status(404).json({ ok: false, message: 'Job non trovato' });
    }

    const response = {
      ok: true,
      job: {
        id: jobRecord.id,
        status: jobRecord.status,
        error_message: jobRecord.error_message || null,
        output_pdf_path: jobRecord.output_pdf_path || null,
        output_md_path: jobRecord.output_md_path || null,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Errore durante il recupero stato job:', error?.message || error);
    return res.status(500).json({ ok: false, message: 'Errore inatteso nel recupero del job' });
  }
});
// == REFACTORING ASYNC: fine endpoint stato job ==


app.post('/api/rec2pdf', uploadMiddleware.fields([{ name: 'audio', maxCount: 1 }, { name: 'pdfLogo', maxCount: 1 }]), async (req, res) => {
  const cleanupFiles = new Set();

  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ ok: false, message: 'Nessun file audio', logs: [], stageEvents: [] });
    }

    const audioFile = req.files.audio[0];
    const userId = req.user?.id || 'anonymous';
    const audioBuffer = await fsp.readFile(audioFile.path);
    cleanupFiles.add(audioFile.path);
    const sanitizedOriginalName = sanitizeStorageFileName(audioFile.originalname || 'audio', 'audio');
    const audioStoragePath = `uploads/${userId}/${Date.now()}_${sanitizedOriginalName}`;

    await uploadFileToBucket(
      SUPABASE_AUDIO_BUCKET,
      audioStoragePath,
      audioBuffer,
      audioFile.mimetype || 'application/octet-stream'
    );
    // === DEBUG UPLOAD ===
    console.log(`[REC2PDF ENDPOINT] File audio caricato con successo su: ${audioStoragePath}`);
// === FINE DEBUG ===

    const bodyPayload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const workspaceId = getWorkspaceIdFromRequest(req);
    const aiOverrides = extractAiProviderOverrides(req);

    const payload = {
      ...bodyPayload,
      slug: String(bodyPayload.slug || '').trim(),
      workspaceId,
      workspaceProjectId: String(bodyPayload.workspaceProjectId || '').trim(),
      workspaceProjectName: String(bodyPayload.workspaceProjectName || bodyPayload.workspaceProject || '').trim(),
      workspaceStatus: String(bodyPayload.workspaceStatus || '').trim(),
      workspaceProfileId: String(bodyPayload.workspaceProfileId || '').trim(),
      workspaceProfileTemplate: String(bodyPayload.workspaceProfileTemplate || '').trim(),
      workspaceProfileLabel: String(bodyPayload.workspaceProfileLabel || '').trim(),
      workspaceProfileLogoPath: String(bodyPayload.workspaceProfileLogoPath || '').trim(),
      workspaceProfileLogoLabel: String(bodyPayload.workspaceProfileLogoLabel || '').trim(),
      workspaceProfileLogoDownloadUrl: String(bodyPayload.workspaceProfileLogoDownloadUrl || '').trim(),
      promptFocus: String(bodyPayload.promptFocus || '').trim(),
      promptNotes: String(bodyPayload.promptNotes || '').trim(),
      promptId: String(bodyPayload.promptId || '').trim(),
      dest: bodyPayload.dest,
      workspaceProjectDestDir: bodyPayload.workspaceProjectDestDir,
      projectDestDir: bodyPayload.projectDestDir,
      workspaceDestDir: bodyPayload.workspaceDestDir,
      workspaceDestination: bodyPayload.workspaceDestination,
      title: bodyPayload.title,
      summary: bodyPayload.summary,
      aiTextProvider: aiOverrides.text,
      aiEmbeddingProvider: aiOverrides.embedding,
      originalAudioName: audioFile.originalname || 'audio',
      sanitizedAudioName: sanitizedOriginalName,
    };

    if (typeof req.user?.email === 'string') {
      payload.userEmail = req.user.email;
    }

    if (req.files && req.files.pdfLogo && req.files.pdfLogo.length) {
      const logoFile = req.files.pdfLogo[0];
      const ensuredPath = await ensureTempFileHasExtension(logoFile);
      if (ensuredPath) {
        cleanupFiles.add(ensuredPath);
        if (supabase) {
          try {
            const uploadResult = await uploadProfileLogoToSupabase(ensuredPath, {
              workspaceId: workspaceId || 'job',
              profileId: payload.workspaceProfileId || payload.slug || 'profile',
              fileName: logoFile.originalname || 'logo.pdf',
              contentType: logoFile.mimetype || guessLogoContentType(logoFile.originalname || 'logo.pdf'),
            });
            payload.pdfLogoStoragePath = uploadResult.storagePath;
            payload.customLogoBucket = SUPABASE_LOGO_BUCKET;
          } catch (logoError) {
            console.error('⚠️ Upload logo personalizzato fallito:', logoError?.message || logoError);
          }
        }
      }
    }

   // == REFACTORING ASYNC: Creazione job asincrono ==
   if (!supabase) {
    throw new Error('Supabase non configurato per la creazione del job');
  }

  // ============================================================
  // == INIZIO MODIFICA: Lettura Environment (Routing) ==
  // ============================================================
  // Leggiamo cosa ci ha mandato il frontend. Se manca, assumiamo 'production' per sicurezza.
  const rawEnv = req.body.environment; 
  // Validazione stretta: accettiamo solo 'development' o 'production'
  const jobEnvironment = rawEnv === 'development' ? 'development' : 'production';
  
  console.log(`[Backend] Creazione job per ambiente: ${jobEnvironment}`);
  // ============================================================

  const jobPayload = {
    user_id: userId,
    user_email: req.user?.email || '',
    input_file_path: audioStoragePath,
    request_payload: payload,
    status: 'pending',
    environment: jobEnvironment, // <--- CAMPO AGGIUNTO QUI
  };

  const { data: createdJob, error: jobError } = await supabase
    .from(SUPABASE_JOBS_TABLE)
    .insert(jobPayload)
    .select()
    .single();

    

    if (jobError || !createdJob) {
      console.error('❌ Creazione job fallita:', jobError?.message || jobError);
      throw new Error(jobError?.message || 'Impossibile creare il job di elaborazione');
    }

    return res.status(202).json({ ok: true, jobId: createdJob.id });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const responsePayload = { ok: false, message };
    if (error && typeof error === 'object') {
      if (Array.isArray(error.logs)) {
        responsePayload.logs = error.logs;
      }
      if (Array.isArray(error.stageEvents)) {
        responsePayload.stageEvents = error.stageEvents;
      }
    }
    return res.status(500).json(responsePayload);
  } finally {
    try { if (req.files && req.files.audio) await safeUnlink(req.files.audio[0].path); } catch { }
    try { if (req.files && req.files.pdfLogo) await safeUnlink(req.files.pdfLogo[0].path); } catch { }
    for (const filePath of cleanupFiles) {
      try {
        await safeUnlink(filePath);
      } catch {
        // ignore
      }
    }
  }
});
// == REFACTORING ASYNC: fine creazione job asincrono ==


// == REFACTORING ASYNC: Endpoint stato job ==
app.get('/api/jobs/:id', authenticateRequest, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
    }

    const jobId = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
    if (!jobId) {
      return res.status(400).json({ ok: false, message: 'Identificatore job non valido' });
    }

    const userId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
    if (!userId) {
      return res.status(401).json({ ok: false, message: 'Utente non autenticato' });
    }

    const { data: jobRecord, error } = await supabase
  .from(SUPABASE_JOBS_TABLE)
  .select('id, status, error_message, output_pdf_path, output_md_path, user_id, worker_log') // <-- AGGIUNGI QUI
  .eq('id', jobId)
  .eq('user_id', userId)
  .maybeSingle();

    if (error) {
      console.error('❌ Recupero job fallito:', error.message || error);
      return res.status(500).json({ ok: false, message: 'Impossibile recuperare il job' });
    }

    if (!jobRecord) {
      return res.status(404).json({ ok: false, message: 'Job non trovato' });
    }

    const response = {
      ok: true,
      job: {
        id: jobRecord.id,
        status: jobRecord.status,
        error_message: jobRecord.error_message || null,
        output_pdf_path: jobRecord.output_pdf_path || null,
        output_md_path: jobRecord.output_md_path || null,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Errore durante il recupero stato job:', error?.message || error);
    return res.status(500).json({ ok: false, message: 'Errore inatteso nel recupero del job' });
  }
});
// == REFACTORING ASYNC: fine endpoint stato job ==


app.post('/api/rec2pdf', uploadMiddleware.fields([{ name: 'audio', maxCount: 1 }, { name: 'pdfLogo', maxCount: 1 }]), async (req, res) => {
  const cleanupFiles = new Set();

  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ ok: false, message: 'Nessun file audio', logs: [], stageEvents: [] });
    }

    const audioFile = req.files.audio[0];
    const userId = req.user?.id || 'anonymous';
    const audioBuffer = await fsp.readFile(audioFile.path);
    cleanupFiles.add(audioFile.path);
    const sanitizedOriginalName = sanitizeStorageFileName(audioFile.originalname || 'audio', 'audio');
    const audioStoragePath = `uploads/${userId}/${Date.now()}_${sanitizedOriginalName}`;

    await uploadFileToBucket(
      SUPABASE_AUDIO_BUCKET,
      audioStoragePath,
      audioBuffer,
      audioFile.mimetype || 'application/octet-stream'
    );

    const bodyPayload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const workspaceId = getWorkspaceIdFromRequest(req);
    const aiOverrides = extractAiProviderOverrides(req);

    const payload = {
      ...bodyPayload,
      slug: String(bodyPayload.slug || '').trim(),
      workspaceId,
      workspaceProjectId: String(bodyPayload.workspaceProjectId || '').trim(),
      workspaceProjectName: String(bodyPayload.workspaceProjectName || bodyPayload.workspaceProject || '').trim(),
      workspaceStatus: String(bodyPayload.workspaceStatus || '').trim(),
      workspaceProfileId: String(bodyPayload.workspaceProfileId || '').trim(),
      workspaceProfileTemplate: String(bodyPayload.workspaceProfileTemplate || '').trim(),
      workspaceProfileLabel: String(bodyPayload.workspaceProfileLabel || '').trim(),
      workspaceProfileLogoPath: String(bodyPayload.workspaceProfileLogoPath || '').trim(),
      workspaceProfileLogoLabel: String(bodyPayload.workspaceProfileLogoLabel || '').trim(),
      workspaceProfileLogoDownloadUrl: String(bodyPayload.workspaceProfileLogoDownloadUrl || '').trim(),
      promptFocus: String(bodyPayload.promptFocus || '').trim(),
      promptNotes: String(bodyPayload.promptNotes || '').trim(),
      promptId: String(bodyPayload.promptId || '').trim(),
      dest: bodyPayload.dest,
      workspaceProjectDestDir: bodyPayload.workspaceProjectDestDir,
      projectDestDir: bodyPayload.projectDestDir,
      workspaceDestDir: bodyPayload.workspaceDestDir,
      workspaceDestination: bodyPayload.workspaceDestination,
      title: bodyPayload.title,
      summary: bodyPayload.summary,
      aiTextProvider: aiOverrides.text,
      aiEmbeddingProvider: aiOverrides.embedding,
      originalAudioName: audioFile.originalname || 'audio',
      sanitizedAudioName: sanitizedOriginalName,
    };

    if (typeof req.user?.email === 'string') {
      payload.userEmail = req.user.email;
    }

    if (req.files && req.files.pdfLogo && req.files.pdfLogo.length) {
      const logoFile = req.files.pdfLogo[0];
      const ensuredPath = await ensureTempFileHasExtension(logoFile);
      if (ensuredPath) {
        cleanupFiles.add(ensuredPath);
        if (supabase) {
          try {
            const uploadResult = await uploadProfileLogoToSupabase(ensuredPath, {
              workspaceId: workspaceId || 'job',
              profileId: payload.workspaceProfileId || payload.slug || 'profile',
              fileName: logoFile.originalname || 'logo.pdf',
              contentType: logoFile.mimetype || guessLogoContentType(logoFile.originalname || 'logo.pdf'),
            });
            payload.pdfLogoStoragePath = uploadResult.storagePath;
            payload.customLogoBucket = SUPABASE_LOGO_BUCKET;
          } catch (logoError) {
            console.error('⚠️ Upload logo personalizzato fallito:', logoError?.message || logoError);
          }
        }
      }
    }

    // == REFACTORING ASYNC: Creazione job asincrono ==
    if (!supabase) {
      throw new Error('Supabase non configurato per la creazione del job');
    }

    const jobPayload = {
      user_id: userId,
      user_email: req.user?.email || '',
      input_file_path: audioStoragePath,
      request_payload: payload,
      status: 'pending',
    };

    const { data: createdJob, error: jobError } = await supabase
      .from(SUPABASE_JOBS_TABLE)
      .insert(jobPayload)
      .select()
      .single();

    if (jobError || !createdJob) {
      console.error('❌ Creazione job fallita:', jobError?.message || jobError);
      throw new Error(jobError?.message || 'Impossibile creare il job di elaborazione');
    }

    return res.status(202).json({ ok: true, jobId: createdJob.id });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const responsePayload = { ok: false, message };
    if (error && typeof error === 'object') {
      if (Array.isArray(error.logs)) {
        responsePayload.logs = error.logs;
      }
      if (Array.isArray(error.stageEvents)) {
        responsePayload.stageEvents = error.stageEvents;
      }
    }
    return res.status(500).json(responsePayload);
  } finally {
    try { if (req.files && req.files.audio) await safeUnlink(req.files.audio[0].path); } catch { }
    try { if (req.files && req.files.pdfLogo) await safeUnlink(req.files.pdfLogo[0].path); } catch { }
    for (const filePath of cleanupFiles) {
      try {
        await safeUnlink(filePath);
      } catch {
        // ignore
      }
    }
  }
});
// == REFACTORING ASYNC: fine creazione job asincrono ==


app.post('/api/ppubr', uploadMiddleware.fields([{ name: 'pdfLogo', maxCount: 1 }]), async (req, res) => {
  const logs = [];
  const out = (s) => { logs.push(s); };
  let customLogoPath = null;
  let workDir = '';
  const cleanupFiles = new Set();
  let usedSupabaseFlow = false;
  const localPdfPathRaw = typeof req.body?.localPdfPath === 'string' ? req.body.localPdfPath.trim() : '';
  const localMdPathRaw = typeof req.body?.localMdPath === 'string' ? req.body.localMdPath.trim() : '';

  try {
    const mdPathRaw = String(req.body?.mdPath || '').trim();
    if (!mdPathRaw) {
      return res.status(400).json({ ok: false, message: 'Percorso Markdown mancante', logs });
    }

    let speakerMap = {};
    const rawSpeakerMap = typeof req.body?.speakerMap === 'string' ? req.body.speakerMap.trim() : '';
    if (rawSpeakerMap) {
      try {
        const parsed = JSON.parse(rawSpeakerMap);
        speakerMap = sanitizeSpeakerMapInput(parsed);
      } catch (parseError) {
        out(`⚠️ Mappatura speaker non valida: ${parseError?.message || parseError}`);
        speakerMap = {};
      }
    }
    const hasSpeakerMap = Object.keys(speakerMap).length > 0;
    if (hasSpeakerMap) {
      out(`🗣️ Mappatura speaker ricevuta (${Object.keys(speakerMap).length} etichette)`);
    }

    const looksLikeStoragePath =
      !!supabase &&
      !path.isAbsolute(mdPathRaw) &&
      !mdPathRaw.startsWith('./') &&
      !mdPathRaw.startsWith('../') &&
      mdPathRaw.includes('/');

    if (req.files?.pdfLogo?.length) {
      const logoFile = req.files.pdfLogo[0];
      customLogoPath = await ensureTempFileHasExtension(logoFile);
      if (customLogoPath) {
        out(`🎨 Utilizzo logo personalizzato: ${logoFile.originalname}`);
      }
    }

    const publishEnv = buildEnvOptions(
      customLogoPath ? { CUSTOM_PDF_LOGO: customLogoPath } : null
    );

    const resolvedLocalPdfPath = normalizeLocalFilePathInput(localPdfPathRaw);
    const resolvedLocalMdPath = normalizeLocalFilePathInput(localMdPathRaw);

    const copySupabaseArtifactsLocally = async (pdfSourcePath, mdSourcePath) => {
      let localPdfPath = '';
      let localMdPath = '';

      if (resolvedLocalMdPath) {
        const targetDir = path.dirname(resolvedLocalMdPath);
        const writable = await ensureWritableDirectory(targetDir);
        if (!writable.ok) {
          throw new Error(
            `Cartella locale non scrivibile per il Markdown: ${writable.error?.message || 'percorso non valido'}`
          );
        }
        await fsp.copyFile(mdSourcePath, resolvedLocalMdPath);
        localMdPath = resolvedLocalMdPath;
        out(`📁 Markdown aggiornato in locale: ${resolvedLocalMdPath}`);
      }

      if (resolvedLocalPdfPath) {
        const targetDir = path.dirname(resolvedLocalPdfPath);
        const writable = await ensureWritableDirectory(targetDir);
        if (!writable.ok) {
          throw new Error(
            `Cartella locale non scrivibile per il PDF: ${writable.error?.message || 'percorso non valido'}`
          );
        }
        await fsp.copyFile(pdfSourcePath, resolvedLocalPdfPath);
        localPdfPath = resolvedLocalPdfPath;
        out(`📁 PDF aggiornato in locale: ${resolvedLocalPdfPath}`);
      }

      return { localPdfPath, localMdPath };
    };

    const createMappedMarkdownCopy = async (sourcePath) => {
      if (!hasSpeakerMap) {
        return sourcePath;
      }
      try {
        const originalContent = await fsp.readFile(sourcePath, 'utf8');
        const mappedContent = applySpeakerMapToContent(originalContent, speakerMap);
        const ext = path.extname(sourcePath) || '.md';
        const baseName = path.basename(sourcePath, ext);
        const mappedPath = path.join(path.dirname(sourcePath), `${baseName}_speaker-map${ext}`);
        await fsp.writeFile(mappedPath, mappedContent, 'utf8');
        cleanupFiles.add(mappedPath);
        out('📝 Applicata mappatura speaker al Markdown temporaneo');
        return mappedPath;
      } catch (error) {
        out(`⚠️ Impossibile applicare la mappatura speaker: ${error?.message || error}`);
        return sourcePath;
      }
    };

    if (looksLikeStoragePath) {
      let bucket;
      let objectPath;
      try {
        ({ bucket, objectPath } = parseStoragePath(mdPathRaw));
      } catch (parseError) {
        const status = Number(parseError.statusCode) || 400;
        return res.status(status).json({ ok: false, message: parseError.message, logs });
      }

      if (!objectPath.toLowerCase().endsWith('.md')) {
        return res.status(400).json({ ok: false, message: 'Il file deve avere estensione .md', logs });
      }

      out(`♻️ Rigenerazione PDF da Supabase (${bucket}/${objectPath})`);

      const pdfObjectPath = objectPath.replace(/\.md$/i, '.pdf');
      workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rec2pdf_ppubr_'));
      usedSupabaseFlow = true;

      const mdLocalPath = path.join(workDir, path.basename(objectPath));
      const pdfLocalPath = path.join(workDir, path.basename(pdfObjectPath));
      cleanupFiles.add(mdLocalPath);
      cleanupFiles.add(pdfLocalPath);

      // --- FIX: Priorità al contenuto inviato dal client (Direct Injection) ---
      let mdBuffer;
      if (req.body.markdownContent) {
        console.log(`[PPUBR] Uso contenuto Markdown fornito direttamente dal client (${req.body.markdownContent.length} bytes)`);
        mdBuffer = Buffer.from(req.body.markdownContent, 'utf8');
      } else {
        console.log(`[PPUBR] Scarico Markdown da Supabase: ${bucket}/${objectPath}`);
        mdBuffer = await downloadFileFromBucket(bucket, objectPath);
      }
      
      await fsp.writeFile(mdLocalPath, mdBuffer);
      // -----------------------------------------------------------------------

      let activeTemplateDescriptor = null;
      const layoutCandidate = extractLayoutFromMarkdown(mdBuffer.toString('utf8'));
      if (layoutCandidate) {
        activeTemplateDescriptor = await resolveTemplateFromLayout(layoutCandidate, { logger: out });
      }
      if (!activeTemplateDescriptor && hasSpeakerMap) {
        try {
          activeTemplateDescriptor = await resolveTemplateDescriptor('verbale_meeting.html');
          out(`📄 Template fallback (speaker map): ${activeTemplateDescriptor.fileName}`, 'publish', 'info');
        } catch (templateError) {
          const reason =
            templateError instanceof TemplateResolutionError
              ? templateError.userMessage
              : templateError?.message || templateError;
          out(`⚠️ Template fallback non accessibile: ${reason}`, 'publish', 'warning');
        }
      }

      const mdPathForPublish = await createMappedMarkdownCopy(mdLocalPath);

      out(`--- DEBUG: START publishWithTemplateFallback in /api/ppubr ---`);
      out(`mdLocalPath for publish: ${mdPathForPublish}`);
      out(`pdfLocalPath for publish: ${pdfLocalPath}`);
      out(`publishEnv: ${JSON.stringify(publishEnv, null, 2)}`);
      out(`activeTemplateDescriptor: ${JSON.stringify(activeTemplateDescriptor, null, 2)}`);

      try {
        await publishWithTemplateFallback({
          mdLocalPath: mdPathForPublish,
          pdfLocalPath,
          publishEnv,
          templateInfo: activeTemplateDescriptor,
          logger: out,
        });
      } catch(e) {
          out(`--- DEBUG: ERROR in publishWithTemplateFallback ---`);
          out(`Error message: ${e.message}`);
          out(`Error stack: ${e.stack}`);
          throw e;
      }
      out(`--- DEBUG: END publishWithTemplateFallback in /api/ppubr ---`);


      out(`--- DEBUG: Checking if PDF exists locally after publishWithTemplateFallback ---`);
      if (fs.existsSync(pdfLocalPath)) {
          out(`File exists at ${pdfLocalPath}. Size: ${fs.statSync(pdfLocalPath).size} bytes.`);
      } else {
          out(`File NOT found at ${pdfLocalPath}.`);
      }

      try {
        await uploadFileToBucket(
          bucket,
          pdfObjectPath,
          await fsp.readFile(pdfLocalPath),
          'application/pdf'
        );
      } catch(e) {
          out(`--- DEBUG: ERROR in uploadFileToBucket ---`);
          out(`Error message: ${e.message}`);
          out(`Error stack: ${e.stack}`);
          throw e;
      }
      out(`☁️ PDF aggiornato su Supabase: ${pdfObjectPath}`);

      let localPdfPath = '';
      let localMdPath = '';
      if (resolvedLocalPdfPath || resolvedLocalMdPath) {
        try {
          const copied = await copySupabaseArtifactsLocally(pdfLocalPath, mdLocalPath);
          localPdfPath = copied.localPdfPath;
          localMdPath = copied.localMdPath;
        } catch (copyError) {
          out(`❌ Aggiornamento locale fallito: ${copyError.message}`);
          return res.status(500).json({
            ok: false,
            message: copyError.message,
            logs,
          });
        }
      }

      const normalizedMdPath = `${bucket}/${objectPath}`;
      const normalizedPdfPath = `${bucket}/${pdfObjectPath}`;
      return res.json({
        ok: true,
        pdfPath: normalizedPdfPath,
        mdPath: normalizedMdPath,
        localPdfPath,
        localMdPath,
        logs,
        speakerMap,
      });
    }

    const mdPath = path.resolve(mdPathRaw);
    if (!fs.existsSync(mdPath)) {
      throw new Error(`Markdown non trovato: ${mdPath}`);
    }

    if (!mdPath.toLowerCase().endsWith('.md')) {
      throw new Error('Il file deve essere un Markdown (.md)');
    }

    const dest = path.dirname(mdPath);
    out(`♻️ Rigenerazione PDF con publish.sh da ${mdPath}`);

    const baseName = path.basename(mdPath, path.extname(mdPath));
    const pdfPath = path.join(dest, `${baseName}.pdf`);
    const mdPathForPublish = await createMappedMarkdownCopy(mdPath);

    out(`--- DEBUG: START publishWithTemplateFallback (local file) ---`);
    out(`mdLocalPath for publish: ${mdPathForPublish}`);
    out(`pdfLocalPath for publish: ${pdfPath}`);
    out(`publishEnv: ${JSON.stringify(publishEnv, null, 2)}`);

    try {
      await publishWithTemplateFallback({
        mdLocalPath: mdPathForPublish,
        pdfLocalPath: pdfPath,
        publishEnv,
        logger: out,
      });
    } catch(e) {
        out(`--- DEBUG: ERROR in publishWithTemplateFallback (local file) ---`);
        out(`Error message: ${e.message}`);
        out(`Error stack: ${e.stack}`);
        throw e;
    }
    out(`--- DEBUG: END publishWithTemplateFallback (local file) ---`);

    out(`--- DEBUG: Checking if PDF exists locally after publishWithTemplateFallback (local file) ---`);
    if (fs.existsSync(pdfPath)) {
        out(`File exists at ${pdfPath}. Size: ${fs.statSync(pdfPath).size} bytes.`);
    } else {
        out(`File NOT found at ${pdfPath}.`);
    }


    out(`✅ Fatto! PDF creato: ${pdfPath}`);
    return res.json({
      ok: true,
      pdfPath,
      mdPath,
      localPdfPath: pdfPath,
      localMdPath: mdPath,
      logs,
      speakerMap,
    });
  } catch (err) {
    out('❌ Errore durante la rigenerazione');
    out(String(err && err.message ? err.message : err));
    console.error('PPUBR error', err);
    return res.status(500).json({ ok: false, message: String(err && err.message ? err.message : err), logs });
  } finally {
    if (customLogoPath) {
      await safeUnlink(customLogoPath);
    }
    for (const filePath of cleanupFiles) {
      await safeUnlink(filePath);
    }
    if (usedSupabaseFlow) {
      await safeRemoveDir(workDir);
    }
    try { if (req.files && req.files.pdfLogo) await safeUnlink(req.files.pdfLogo[0].path); } catch { }
  }
});

app.post('/api/ppubr-upload', uploadMiddleware.fields([{ name: 'markdown', maxCount: 1 }, { name: 'pdfLogo', maxCount: 1 }]), async (req, res) => {
  const logs = [];
  const stageEvents = [];
  let lastStageKey = null;
  let selectedPrompt = null;
  let promptRulePayload = null;
  let promptEnv = null;
  let promptFocus = '';
  let promptNotes = '';
  let promptCuesCompleted = [];

  const logStageEvent = (stage, status = 'info', message = '') => {
    if (!stage) return;
    const normalizedStatus = String(status || 'info').toLowerCase();
    stageEvents.push({ stage, status: normalizedStatus, message, ts: Date.now() });
    if (normalizedStatus === 'running') {
      lastStageKey = stage;
    } else if (['completed', 'done', 'success'].includes(normalizedStatus)) {
      if (lastStageKey === stage) lastStageKey = null;
    } else if (['failed', 'error'].includes(normalizedStatus)) {
      lastStageKey = stage;
    }
  };

  const out = (s, stage, status) => {
    logs.push(s);
    if (stage) {
      logStageEvent(stage, status || 'info', s);
    }
  };

  try {
    if (!req.files || !req.files.markdown) {
      logStageEvent('upload', 'failed', 'Nessun file Markdown');
      return res.status(400).json({ ok: false, message: 'Nessun file Markdown', logs, stageEvents });
    }

    const mdUpload = req.files.markdown[0];
    const originalName = mdUpload.originalname || 'documento.md';
    const lowerName = originalName.toLowerCase();

    logStageEvent('upload', 'running', 'Caricamento Markdown in corso…');

    if (!lowerName.endsWith('.md')) {
      logStageEvent('upload', 'failed', 'Il file non è un Markdown (.md)');
      return res.status(400).json({ ok: false, message: 'Il file deve essere un Markdown (.md)', logs, stageEvents });
    }

    const slugRaw = String(req.body?.slug || '').trim();
    const slug = sanitizeSlug(slugRaw || path.basename(originalName, path.extname(originalName)) || 'documento', 'documento');
    const workspaceId = String(req.body?.workspaceId || '').trim();
    const workspaceProjectId = String(req.body?.workspaceProjectId || '').trim();
    const workspaceProjectName = String(
      req.body?.workspaceProjectName || req.body?.workspaceProject || ''
    ).trim();
    const workspaceStatus = String(req.body?.workspaceStatus || '').trim();

    promptFocus = String(req.body?.promptFocus || '').trim();
    promptNotes = String(req.body?.promptNotes || '').trim();
    promptCuesCompleted = [];
    if (req.body?.promptCuesCompleted) {
      try {
        const parsed =
          typeof req.body.promptCuesCompleted === 'string'
            ? JSON.parse(req.body.promptCuesCompleted)
            : req.body.promptCuesCompleted;
        if (Array.isArray(parsed)) {
          promptCuesCompleted = parsed.map((item) => String(item || '').trim()).filter(Boolean);
        }
      } catch {
        promptCuesCompleted = [];
      }
    }

    const promptId = String(req.body?.promptId || '').trim();
    if (promptId) {
      const prompts = await listPrompts();
      selectedPrompt = findPromptById(prompts, promptId);
      if (!selectedPrompt) {
        out(`⚠️ Prompt ${promptId} non trovato`, 'upload', 'info');
      } else {
        promptRulePayload = buildPromptRulePayload(selectedPrompt, {
          focus: promptFocus,
          notes: promptNotes,
          completedCues: promptCuesCompleted,
        });
        if (promptRulePayload) {
          promptEnv = { REC2PDF_PROMPT_RULES: promptRulePayload };
          out(`🎯 Prompt attivo: ${selectedPrompt.title}`, 'upload', 'info');
        }
      }
    }

    let workspaceMeta = null;
    let workspaceProject = null;
    if (workspaceId && supabase) {
      try {
        const ownerId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
        const foundWorkspace = await getWorkspaceFromDb(workspaceId, ownerId ? { ownerId } : {});
        if (!foundWorkspace) {
          out(`⚠️ Workspace ${workspaceId} non trovato`, 'upload', 'info');
        } else {
          const { workspace: updatedWorkspace, changed, project } = upsertProjectInWorkspace(foundWorkspace, {
            projectId: workspaceProjectId,
            projectName: workspaceProjectName,
            status: workspaceStatus,
          });
          workspaceMeta = updatedWorkspace;
          workspaceProject = project;
          if (changed) {
            try {
              workspaceMeta = await updateWorkspaceInDb(updatedWorkspace.id, updatedWorkspace);
              out(
                `📁 Workspace aggiornato con il progetto ${project?.name || workspaceProjectName || workspaceProjectId}`,
                'upload',
                'info'
              );
            } catch (persistError) {
              out(
                `⚠️ Aggiornamento workspace non riuscito: ${persistError?.message || persistError}`,
                'upload',
                'warning'
              );
            }
          }
        }
      } catch (workspaceError) {
        out(
          `⚠️ Errore nel recupero del workspace ${workspaceId}: ${workspaceError?.message || workspaceError}`,
          'upload',
          'warning'
        );
      }
    } else if (workspaceId && !supabase) {
      out('⚠️ Supabase non configurato: impossibile recuperare i workspace.', 'upload', 'warning');
    }

    let destDir = DEFAULT_DEST_DIR;
    try {
      const manualDestInput = req.body?.dest;
      const projectDestCandidate =
        (workspaceProject && workspaceProject.destDir) ||
        sanitizeDestDirInput(req.body?.workspaceProjectDestDir || req.body?.projectDestDir || '');
      const workspaceDestCandidate =
        (workspaceMeta && workspaceMeta.destDir) ||
        sanitizeDestDirInput(req.body?.workspaceDestDir || req.body?.workspaceDestination || '');
      const destSource = manualDestInput || projectDestCandidate || workspaceDestCandidate || '';
      const destOrigin = manualDestInput
        ? 'manuale'
        : projectDestCandidate
          ? 'progetto'
          : workspaceDestCandidate
            ? 'workspace'
            : 'predefinita';
      const destConfig = await resolveDestinationDirectory(destSource);
      destDir = destConfig.dir;
      if (destOrigin === 'predefinita') {
        out(`📁 Cartella destinazione predefinita: ${destDir}`, 'upload', 'info');
      } else {
        const originLabel =
          destOrigin === 'manuale'
            ? 'manuale'
            : destOrigin === 'progetto'
              ? 'progetto'
              : 'workspace';
        out(`📁 Cartella destinazione (${originLabel}): ${destDir}`, 'upload', 'info');
      }
    } catch (destError) {
      const reason = destError?.reason || destError?.message || 'Cartella destinazione non scrivibile';
      out(`❌ Cartella destinazione non utilizzabile: ${reason}`, 'upload', 'failed');
      logStageEvent('upload', 'failed', reason);
      return res
        .status(Number(destError?.statusCode) || 400)
        .json({ ok: false, message: `Cartella destinazione non scrivibile: ${reason}`, logs, stageEvents });
    }

    const baseName = workspaceMeta
      ? await buildWorkspaceBaseName(workspaceMeta, destDir, slug)
      : `${yyyymmddHHMMSS(new Date())}_${slug}`;
    const userId = req.user?.id || 'anonymous';
    const processedBasePath = `processed/${userId}`;
    const mdStoragePath = `${processedBasePath}/${baseName}.md`;
    const pdfStoragePath = `${processedBasePath}/${baseName}.pdf`;

    const mdPath = path.join(destDir, `${baseName}.md`);

    await fsp.copyFile(mdUpload.path, mdPath);
    out(`📄 Markdown ricevuto: ${originalName}`, 'upload', 'completed');

    logStageEvent('transcode', 'completed', 'Step transcode non necessario per Markdown.');
    logStageEvent('transcribe', 'completed', 'Trascrizione non necessaria: Markdown fornito.');
    logStageEvent('markdown', 'completed', 'Markdown fornito manualmente.');

    out('📄 Pubblicazione PDF con publish.sh…', 'publish', 'running');

    const customLogoPath = req.files.pdfLogo
      ? await ensureTempFileHasExtension(req.files.pdfLogo[0])
      : null;
    if (customLogoPath) {
      out(`🎨 Utilizzo logo personalizzato: ${req.files.pdfLogo[0].originalname}`, 'publish', 'info');
    }
    const publishEnv = buildEnvOptions(
      promptEnv,
      customLogoPath ? { CUSTOM_PDF_LOGO: customLogoPath } : null
    );

    // Chiama publish.sh
    const pdfPath = path.join(destDir, `${baseName}.pdf`);

    await publishWithTemplateFallback({
      mdLocalPath: mdPath,
      pdfLocalPath: pdfPath,
      publishEnv,
      logger: out,
    });

    out(`✅ Fatto! PDF creato: ${pdfPath}`, 'publish', 'completed');

    out('☁️ Upload degli artefatti su Supabase…', 'publish', 'running');
    await uploadFileToBucket(
      SUPABASE_PROCESSED_BUCKET,
      mdStoragePath,
      await fsp.readFile(mdPath),
      'text/markdown; charset=utf-8'
    );
    await uploadFileToBucket(
      SUPABASE_PROCESSED_BUCKET,
      pdfStoragePath,
      await fsp.readFile(pdfPath),
      'application/pdf'
    );
    out('☁️ Artefatti caricati su Supabase Storage', 'publish', 'info');

    out('🎉 Pipeline completata', 'complete', 'completed');

    const structure = await analyzeMarkdownStructure(mdPath, { prompt: selectedPrompt });
    const workspaceAssignment = workspaceAssignmentForResponse(workspaceMeta, workspaceProject, workspaceStatus);
    const promptAssignment = promptAssignmentForResponse(selectedPrompt, {
      focus: promptFocus,
      notes: promptNotes,
      completedCues: promptCuesCompleted,
    });
    return res.json({
      ok: true,
      pdfPath: `${SUPABASE_PROCESSED_BUCKET}/${pdfStoragePath}`,
      mdPath: `${SUPABASE_PROCESSED_BUCKET}/${mdStoragePath}`,
      localPdfPath: pdfPath,
      localMdPath: mdPath,
      logs,
      stageEvents,
      workspace: workspaceAssignment,
      prompt: promptAssignment,
      structure,
    });
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    const failureStage = lastStageKey || 'publish';
    const hasFailureEvent = stageEvents.some(evt => evt.stage === failureStage && evt.status === 'failed');
    if (!hasFailureEvent) {
      logStageEvent(failureStage, 'failed', message);
    }
    if (!stageEvents.some(evt => evt.stage === 'complete')) {
      logStageEvent('complete', 'failed', 'Pipeline interrotta');
    }
    out('❌ Errore durante la pipeline');
    out(message);
    return res.status(500).json({ ok: false, message, logs, stageEvents });
  } finally {
    try { if (req.files && req.files.markdown) await fsp.unlink(req.files.markdown[0].path); } catch { }
    try { if (req.files && req.files.pdfLogo) await fsp.unlink(req.files.pdfLogo[0].path); } catch { }
  }
});

app.post(
  '/api/text-upload',
  uploadMiddleware.fields([{ name: 'transcript', maxCount: 1 }, { name: 'pdfLogo', maxCount: 1 }]),
  async (req, res) => {
    const logs = [];
    const stageEvents = [];
    let lastStageKey = null;
    let selectedPrompt = null;
    let promptRulePayload = null;
    let promptEnv = null;
    let promptFocus = '';
    let promptNotes = '';
    let promptCuesCompleted = [];
    const tempFiles = new Set();
    const tempDirs = new Set();

    const logStageEvent = (stage, status = 'info', message = '') => {
      if (!stage) return;
      const normalizedStatus = String(status || 'info').toLowerCase();
      stageEvents.push({ stage, status: normalizedStatus, message, ts: Date.now() });
      if (normalizedStatus === 'running') {
        lastStageKey = stage;
      } else if (['completed', 'done', 'success'].includes(normalizedStatus)) {
        if (lastStageKey === stage) lastStageKey = null;
      } else if (['failed', 'error'].includes(normalizedStatus)) {
        lastStageKey = stage;
      }
    };

    const out = (s, stage, status) => {
      logs.push(s);
      if (stage) {
        logStageEvent(stage, status || 'info', s);
      }
    };

    let finalMdPath = '';
    let finalPdfPath = '';

    try {
      if (!req.files || !req.files.transcript) {
        logStageEvent('upload', 'failed', 'Nessun file di testo');
        return res.status(400).json({ ok: false, message: 'Nessun file di testo', logs, stageEvents });
      }

      const txtUpload = req.files.transcript[0];
      const aiOverrides = extractAiProviderOverrides(req);
      res.locals.aiProviderOverrides = aiOverrides;
      const originalName = txtUpload.originalname || 'trascrizione.txt';
      const lowerName = originalName.toLowerCase();

      logStageEvent('upload', 'running', 'Caricamento trascrizione in corso…');

      if (!lowerName.endsWith('.txt') && !lowerName.endsWith('.text') && txtUpload.mimetype !== 'text/plain') {
        logStageEvent('upload', 'failed', 'Il file non è un .txt');
        return res.status(400).json({ ok: false, message: 'Il file deve essere un testo (.txt)', logs, stageEvents });
      }

      const slugRaw = String(req.body?.slug || '').trim();
      const slug = sanitizeSlug(slugRaw || path.basename(originalName, path.extname(originalName)) || 'documento', 'documento');
      const workspaceId = String(req.body?.workspaceId || '').trim();
      const workspaceProjectId = String(req.body?.workspaceProjectId || '').trim();
      const workspaceProjectName = String(
        req.body?.workspaceProjectName || req.body?.workspaceProject || ''
      ).trim();
      const workspaceStatus = String(req.body?.workspaceStatus || '').trim();

      promptFocus = String(req.body?.promptFocus || '').trim();
      promptNotes = String(req.body?.promptNotes || '').trim();
      promptCuesCompleted = [];
      if (req.body?.promptCuesCompleted) {
        try {
          const parsed =
            typeof req.body.promptCuesCompleted === 'string'
              ? JSON.parse(req.body.promptCuesCompleted)
              : req.body.promptCuesCompleted;
          if (Array.isArray(parsed)) {
            promptCuesCompleted = parsed.map((item) => String(item || '').trim()).filter(Boolean);
          }
        } catch {
          promptCuesCompleted = [];
        }
      }

      const promptId = String(req.body?.promptId || '').trim();
      if (promptId) {
        const prompts = await listPrompts();
        selectedPrompt = findPromptById(prompts, promptId);
        if (!selectedPrompt) {
          out(`⚠️ Prompt ${promptId} non trovato`, 'upload', 'info');
        } else {
          promptRulePayload = buildPromptRulePayload(selectedPrompt, {
            focus: promptFocus,
            notes: promptNotes,
            completedCues: promptCuesCompleted,
          });
          if (promptRulePayload) {
            promptEnv = { REC2PDF_PROMPT_RULES: promptRulePayload };
            out(`🎯 Prompt attivo: ${selectedPrompt.title}`, 'upload', 'info');
          }
        }
      }

      let workspaceMeta = null;
      let workspaceProject = null;
      if (workspaceId && supabase) {
        try {
          const foundWorkspace = await getWorkspaceFromDb(workspaceId);
          if (!foundWorkspace) {
            out(`⚠️ Workspace ${workspaceId} non trovato`, 'upload', 'info');
          } else {
            const { workspace: updatedWorkspace, changed, project } = upsertProjectInWorkspace(foundWorkspace, {
              projectId: workspaceProjectId,
              projectName: workspaceProjectName,
              status: workspaceStatus,
            });
            workspaceMeta = updatedWorkspace;
            workspaceProject = project;
            if (changed) {
              try {
                workspaceMeta = await updateWorkspaceInDb(updatedWorkspace.id, updatedWorkspace);
                out(
                  `📁 Workspace aggiornato con il progetto ${project?.name || workspaceProjectName || workspaceProjectId}`,
                  'upload',
                  'info'
                );
              } catch (persistError) {
                out(
                  `⚠️ Aggiornamento workspace non riuscito: ${persistError?.message || persistError}`,
                  'upload',
                  'warning'
                );
              }
            }
          }
        } catch (workspaceError) {
          out(
            `⚠️ Errore nel recupero del workspace ${workspaceId}: ${workspaceError?.message || workspaceError}`,
            'upload',
            'warning'
          );
        }
      } else if (workspaceId && !supabase) {
        out('⚠️ Supabase non configurato: impossibile recuperare i workspace.', 'upload', 'warning');
      }

      let destDir = DEFAULT_DEST_DIR;
      try {
        const manualDestInput = req.body?.dest;
        const projectDestCandidate =
          (workspaceProject && workspaceProject.destDir) ||
          sanitizeDestDirInput(req.body?.workspaceProjectDestDir || req.body?.projectDestDir || '');
        const workspaceDestCandidate =
          (workspaceMeta && workspaceMeta.destDir) ||
          sanitizeDestDirInput(req.body?.workspaceDestDir || req.body?.workspaceDestination || '');
        const destSource = manualDestInput || projectDestCandidate || workspaceDestCandidate || '';
        const destOrigin = manualDestInput
          ? 'manuale'
          : projectDestCandidate
            ? 'progetto'
            : workspaceDestCandidate
              ? 'workspace'
              : 'predefinita';
        const destConfig = await resolveDestinationDirectory(destSource);
        destDir = destConfig.dir;
        if (destOrigin === 'predefinita') {
          out(`📁 Cartella destinazione predefinita: ${destDir}`, 'upload', 'info');
        } else {
          const originLabel =
            destOrigin === 'manuale'
              ? 'manuale'
              : destOrigin === 'progetto'
                ? 'progetto'
                : 'workspace';
          out(`📁 Cartella destinazione (${originLabel}): ${destDir}`, 'upload', 'info');
        }
      } catch (destError) {
        const reason = destError?.reason || destError?.message || 'Cartella destinazione non scrivibile';
        out(`❌ Cartella destinazione non utilizzabile: ${reason}`, 'upload', 'failed');
        logStageEvent('upload', 'failed', reason);
        return res
          .status(Number(destError?.statusCode) || 400)
          .json({ ok: false, message: `Cartella destinazione non scrivibile: ${reason}`, logs, stageEvents });
      }

      const registerTempDir = (dir) => {
        if (dir) tempDirs.add(dir);
        return dir;
      };
      const registerTempFile = (file) => {
        if (file) tempFiles.add(file);
        return file;
      };

      const pipelineDir = registerTempDir(await fsp.mkdtemp(path.join(os.tmpdir(), 'rec2pdf_txt_pipeline_')));

      const userId = req.user?.id || 'anonymous';
      const sanitizedOriginalName = sanitizeStorageFileName(originalName, 'trascrizione');
      const textTimestamp = Date.now();
      const textStoragePath = `uploads/${userId}/${textTimestamp}_${sanitizedOriginalName}`;

      out('🚀 Preparazione upload…', 'upload', 'running');
      const txtBuffer = await fsp.readFile(txtUpload.path);
      await uploadFileToBucket(SUPABASE_TEXT_BUCKET, textStoragePath, txtBuffer, 'text/plain');
      out(`📦 Trascrizione ricevuta: ${originalName}`, 'upload', 'completed');
      out('☁️ File caricato su Supabase Storage', 'upload', 'info');

      const baseName = workspaceMeta
        ? await buildWorkspaceBaseName(workspaceMeta, destDir, slug)
        : `${yyyymmddHHMMSS(new Date())}_${slug}`;
      const processedBasePath = `processed/${userId}`;
      const mdStoragePath = `${processedBasePath}/documento_${baseName}.md`;
      const pdfStoragePath = `${processedBasePath}/documento_${baseName}.pdf`;

      logStageEvent('transcode', 'completed', 'Step transcode non necessario per TXT.');
      logStageEvent('transcribe', 'completed', 'Trascrizione fornita come TXT.');

      out('📝 Generazione Markdown…', 'markdown', 'running');
      let txtLocalPath = '';
      let mdLocalPath = '';
      try {
        const downloadedTxt = await downloadFileFromBucket(SUPABASE_TEXT_BUCKET, textStoragePath);
        txtLocalPath = registerTempFile(path.join(pipelineDir, `${baseName}.txt`));
        await fsp.writeFile(txtLocalPath, downloadedTxt);
        mdLocalPath = registerTempFile(path.join(pipelineDir, `documento_${baseName}.md`));
        let retrievedWorkspaceContext = res.locals?.retrievedWorkspaceContext || '';
        if (!retrievedWorkspaceContext && workspaceId) {
          try {
            const transcriptTextForQuery = downloadedTxt.toString('utf8');
            const queryParts = [];
            if (promptFocus) queryParts.push(promptFocus);
            if (promptNotes) queryParts.push(promptNotes);
            if (transcriptTextForQuery) queryParts.push(transcriptTextForQuery);
            const combinedQuery = queryParts.join('\n\n').slice(0, CONTEXT_QUERY_MAX_CHARS);
            if (combinedQuery) {
              console.log('--- DEBUG RAG: Inizio Recupero Contesto ---');
              console.log(`Workspace ID per la ricerca: ${workspaceId}`);
              console.log(`Project ID per la ricerca: ${workspaceProjectId}`);
              console.log(`Query di ricerca (primi 200 char): ${combinedQuery.substring(0, 200)}...`);
            
              retrievedWorkspaceContext = await retrieveRelevantContext(combinedQuery, workspaceId, {
                provider: aiOverrides.embedding,
                projectId: workspaceProjectId,
              });
            
              if (retrievedWorkspaceContext) {
                console.log(`✅ Contesto RAG recuperato con successo (${retrievedWorkspaceContext.length} caratteri).`);
                console.log(`Contesto (primi 200 char): ${retrievedWorkspaceContext.substring(0, 200)}...`);
              } else {
                console.warn('⚠️ ATTENZIONE: Nessun contesto RAG recuperato. La funzione ha restituito una stringa vuota.');
              }
              console.log('--- DEBUG RAG: Fine Recupero Contesto ---'); 
             
              if (retrievedWorkspaceContext) {
                res.locals.retrievedWorkspaceContext = retrievedWorkspaceContext;
              }
            }
          } catch (contextError) {
            out(
              `⚠️ Recupero contesto knowledge base fallito: ${contextError?.message || contextError}`,
              'markdown',
              'warning'
            );
          }
        }

        const {
          title: aiTitle,
          summary: aiSummary,
          author: aiAuthor,
          content: markdownBody,
          modelName: aiModel,
        } = await generateMarkdown(
          txtLocalPath,      
          promptRulePayload,
          retrievedWorkspaceContext || '',
          {
            textProvider: aiOverrides.text,
            refinedData: refinedDataPayload,
            focus: promptFocus,
            notes: promptNotes,
          }
        );

        const now = new Date();
        const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, -1);

        const metadata = {
          title: aiTitle || String(req.body?.title || baseName).trim(),
          author: aiAuthor || req.user?.email || 'rec2pdf',
          owner: workspaceProject?.name || workspaceMeta?.client || '',
          project_name: workspaceProject?.name || workspaceProjectName || '',
          project_code: workspaceMeta?.slug || workspaceId || '',
          artifact_type: 'Report',
          version: 'v1_0_0',
          identifier: baseName,
          location: destDir,
          summary: aiSummary || String(req.body?.summary || '').trim(),
          usageterms: '',
          ssot: false,
          status: workspaceStatus || '',
          created: localTimestamp,
          updated: localTimestamp,
          tags: selectedPrompt?.tags || [],
          ai: {
            generated: true,
            model: aiModel || '',
            prompt_id: selectedPrompt?.id || '',
          },
        };

        metadata.BLDTitle = metadata.title;
        metadata.BLDVersion = metadata.version;
        metadata.BLDUpdated = now.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
        metadata.BLDAuthor = metadata.author;
        metadata.BLDProject = metadata.project_name;

        Object.keys(metadata).forEach((key) => {
          const value = metadata[key];
          if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
            delete metadata[key];
          }
        });
       
        const yamlFrontMatter = yaml.dump(metadata);

        const cleanedMarkdownBody = normalizeAiMarkdownBody(markdownBody);

        const finalMarkdownContent = `---\n${yamlFrontMatter}---\n\n${cleanedMarkdownBody}`;
         // --- DEBUG: STAMPA IL FRONTMATTER ---
      console.log('--- DEBUG YAML START ---');
      // Stampiamo solo i primi 2000 caratteri per vedere l'intestazione e l'inizio della trascrizione
      console.log(finalMarkdownContent.substring(0, 2000));
      console.log('--- DEBUG YAML END ---');
      // ------------------------------------
        await fsp.writeFile(mdLocalPath, finalMarkdownContent, 'utf8');

        await uploadFileToBucket(
          SUPABASE_PROCESSED_BUCKET,
          mdStoragePath,
          await fsp.readFile(mdLocalPath),
          'text/markdown'
        );
        out(`✅ Markdown generato: ${path.basename(mdLocalPath)}`, 'markdown', 'completed');
      } finally {
        await safeUnlink(txtLocalPath);
        await safeUnlink(mdLocalPath);
      }

      out('📄 Pubblicazione PDF con publish.sh…', 'publish', 'running');

      const customLogoPath = req.files.pdfLogo
        ? await ensureTempFileHasExtension(req.files.pdfLogo[0])
        : null;
      if (customLogoPath) {
        out(`🎨 Utilizzo logo personalizzato: ${req.files.pdfLogo[0].originalname}`, 'publish', 'info');
      }
      const publishEnv = buildEnvOptions(
        promptEnv,
        customLogoPath ? { CUSTOM_PDF_LOGO: customLogoPath } : null
      );

      let mdLocalForPublish = '';
      let pdfLocalPath = '';
      try {
        const mdBufferForPublish = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, mdStoragePath);
        mdLocalForPublish = registerTempFile(path.join(pipelineDir, `documento_${baseName}.md`));
        await fsp.writeFile(mdLocalForPublish, mdBufferForPublish);
        pdfLocalPath = registerTempFile(path.join(path.dirname(mdLocalForPublish), `documento_${baseName}.pdf`));

        await publishWithTemplateFallback({
          mdLocalPath: mdLocalForPublish,
          pdfLocalPath,
          publishEnv,
          logger: out,
        });

        await uploadFileToBucket(
          SUPABASE_PROCESSED_BUCKET,
          pdfStoragePath,
          await fsp.readFile(pdfLocalPath),
          'application/pdf'
        );
        const destMdPath = path.join(destDir, path.basename(mdLocalForPublish));
        const destPdfPath = path.join(destDir, path.basename(pdfLocalPath));
        try {
          await fsp.copyFile(mdLocalForPublish, destMdPath);
          await fsp.copyFile(pdfLocalPath, destPdfPath);
          finalMdPath = destMdPath;
          finalPdfPath = destPdfPath;
          out(`📁 Artefatti salvati in ${destDir}`, 'publish', 'info');
        } catch (copyError) {
          const reason = copyError?.message || 'Salvataggio nella cartella di destinazione fallito';
          out(`❌ Salvataggio cartella destinazione fallito: ${reason}`, 'publish', 'failed');
          throw new Error(`Salvataggio cartella destinazione fallito: ${reason}`);
        }

        out(`✅ Fatto! PDF caricato su Supabase: ${path.basename(pdfLocalPath)}`, 'publish', 'completed');
      } finally {
        await safeUnlink(mdLocalForPublish);
        await safeUnlink(pdfLocalPath);
      }

      out('🎉 Pipeline completata', 'complete', 'completed');

      let structure = null;
      let analysisMdPath = '';
      try {
        const mdBufferForAnalysis = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, mdStoragePath);
        analysisMdPath = registerTempFile(path.join(pipelineDir, `documento_${baseName}_analysis.md`));
        await fsp.writeFile(analysisMdPath, mdBufferForAnalysis);
        structure = await analyzeMarkdownStructure(analysisMdPath, { prompt: selectedPrompt });
      } finally {
        await safeUnlink(analysisMdPath);
      }

      const workspaceAssignment = workspaceAssignmentForResponse(workspaceMeta, workspaceProject, workspaceStatus);
      const promptAssignment = promptAssignmentForResponse(selectedPrompt, {
        focus: promptFocus,
        notes: promptNotes,
        completedCues: promptCuesCompleted,
      });
      return res.json({
        ok: true,
        pdfPath: `${SUPABASE_PROCESSED_BUCKET}/${pdfStoragePath}`,
        mdPath: `${SUPABASE_PROCESSED_BUCKET}/${mdStoragePath}`,
        localPdfPath: finalPdfPath,
        localMdPath: finalMdPath,
        logs,
        stageEvents,
        workspace: workspaceAssignment,
        prompt: promptAssignment,
        structure,
      });
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      const failureStage = lastStageKey || 'markdown';
      const hasFailureEvent = stageEvents.some(evt => evt.stage === failureStage && evt.status === 'failed');
      if (!hasFailureEvent) {
        logStageEvent(failureStage, 'failed', message);
      }
      if (!stageEvents.some(evt => evt.stage === 'complete')) {
        logStageEvent('complete', 'failed', 'Pipeline interrotta');
      }
      out('❌ Errore durante la pipeline');
      out(message);
      return res.status(500).json({ ok: false, message, logs, stageEvents });
    } finally {
      try { if (req.files && req.files.transcript) await safeUnlink(req.files.transcript[0].path); } catch { }
      try { if (req.files && req.files.pdfLogo) await safeUnlink(req.files.pdfLogo[0].path); } catch { }
      for (const filePath of tempFiles) {
        await safeUnlink(filePath);
      }
      for (const dirPath of tempDirs) {
        await safeRemoveDir(dirPath);
      }
    }
  }
);

app.get('/api/storage', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ ok: false, message: 'Supabase non configurato' });
    }

    const bucket = String(req.query?.bucket || '').trim();
    if (!bucket) {
      return res.status(400).json({ ok: false, message: 'Parametro bucket mancante' });
    }

    const prefixRaw = typeof req.query?.prefix === 'string' ? req.query.prefix : '';
    const normalizedPrefix = normalizeStoragePrefix(prefixRaw);

    const files = await listSupabaseObjects(bucket, normalizedPrefix);
    return res.json({ ok: true, bucket, prefix: normalizedPrefix, files });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    const message = error && error.message ? error.message : 'Errore durante la lettura dello storage';
    return res.status(status).json({ ok: false, message });
  }
});

app.get('/api/markdown', async (req, res) => {
  try {
    const rawPath = String(req.query?.path || '').trim();
    if (!rawPath) {
      return res.status(400).json({ ok: false, message: 'Percorso Markdown mancante' });
    }
    if (!supabase) {
      return res.status(500).json({ ok: false, message: 'Supabase non configurato' });
    }

    let bucket;
    let objectPath;
    try {
      ({ bucket, objectPath } = parseStoragePath(rawPath));
    } catch (parseError) {
      const status = Number(parseError.statusCode) || 400;
      return res.status(status).json({ ok: false, message: parseError.message });
    }

    if (!objectPath.toLowerCase().endsWith('.md')) {
      return res.status(400).json({ ok: false, message: 'Il file deve avere estensione .md' });
    }

    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data) {
      const status = Number(error?.statusCode) === 404 ? 404 : 500;
      const message = error?.message || 'Download Markdown fallito';
      return res.status(status).json({ ok: false, message });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const content = buffer.toString('utf8');
    return res.json({ ok: true, path: `${bucket}/${objectPath}`, content });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const code = Number(err?.statusCode) || 500;
    return res.status(code).json({ ok: false, message });
  }
});

app.put('/api/markdown', async (req, res) => {
  try {
    const rawPath = String(req.body?.path || '').trim();
    if (!rawPath) {
      return res.status(400).json({ ok: false, message: 'Percorso Markdown mancante' });
    }
    if (!supabase) {
      return res.status(500).json({ ok: false, message: 'Supabase non configurato' });
    }

    const content = req.body?.content;
    if (typeof content !== 'string') {
      return res.status(400).json({ ok: false, message: 'Contenuto Markdown non valido' });
    }

    let bucket;
    let objectPath;
    try {
      ({ bucket, objectPath } = parseStoragePath(rawPath));
    } catch (parseError) {
      const status = Number(parseError.statusCode) || 400;
      return res.status(status).json({ ok: false, message: parseError.message });
    }

    if (!objectPath.toLowerCase().endsWith('.md')) {
      return res.status(400).json({ ok: false, message: 'Il file deve avere estensione .md' });
    }

    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data) {
      const status = Number(error?.statusCode) === 404 ? 404 : 500;
      const message = error?.message || 'Markdown non trovato';
      return res.status(status).json({ ok: false, message });
    }

    const existingBuffer = Buffer.from(await data.arrayBuffer());
    try {
      const backupObjectPath = `${objectPath}.${yyyymmddHHMMSS()}.bak`;
      await uploadFileToBucket(bucket, backupObjectPath, existingBuffer, 'text/markdown; charset=utf-8');
    } catch (backupError) {
      console.warn(`⚠️  Impossibile creare backup su Supabase: ${backupError.message}`);
    }

    const nextBuffer = Buffer.from(content, 'utf8');
    await uploadFileToBucket(
      bucket,
      objectPath,
      nextBuffer,
      'text/markdown; charset=utf-8'
    );

    return res.json({ ok: true, path: `${bucket}/${objectPath}`, bytes: nextBuffer.length });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const code = Number(err?.statusCode) || 500;
    return res.status(code).json({ ok: false, message });
  }
});

app.get('/api/file', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ ok: false, message: 'Supabase non configurato' });
    }

    // ==========================================================
    // ==                  MODIFICA CHIAVE QUI                 ==
    // ==========================================================
    const bucket = String(req.query?.bucket || '').trim();
    const objectPath = String(req.query?.path || '').trim(); // Rinominiamo per chiarezza

    if (!bucket || !objectPath) {
      return res.status(400).json({ ok: false, message: 'Parametri "bucket" e "path" mancanti' });
    }
    // ==========================================================

    console.log(`[API /file] Richiesta URL firmato per: ${bucket}/${objectPath}`);

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60); // 60 secondi di validità

    if (error) {
      // Se l'errore è "Object not found", restituiamo un 404
      if (error.message.toLowerCase().includes('object not found')) {
        return res.status(404).json({ ok: false, message: 'Oggetto non trovato in Supabase.' });
      }
      throw error; // Per altri errori, lancia e gestisci sotto
    }
    
    if (!data?.signedUrl) {
      throw new Error('Impossibile generare URL firmato.');
    }

    // ... (logica per normalizzare l'URL, se necessaria) ...

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, url: data.signedUrl });

  } catch (error) {
    console.error("❌ Errore in /api/file:", error);
    const message = error.message || 'Errore durante la generazione dell\'URL.';
    return res.status(500).json({ ok: false, message });
  }
});
app.post('/api/transcribe-only', uploadMiddleware.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'Nessun file audio fornito.' });
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rec2pdf_transcribe_'));
  let audioLocalPath = req.file.path;
  let wavLocalPath = path.join(tempDir, 'audio.wav');
  let transcriptLocalPath = '';

  try {
    // 1. Transcodifica
    const ff = await run('ffmpeg', ['-y', '-i', audioLocalPath, '-ac', '1', '-ar', '16000', wavLocalPath]);
    if (ff.code !== 0) throw new Error(ff.stderr || 'ffmpeg failed');

    // 2. Trascrizione
    const whisperxCmd = [
      'whisperx', JSON.stringify(wavLocalPath),
      '--language it', '--model small', '--device cpu', '--compute_type float32',
      '--output_format', 'txt',
      '--output_dir', JSON.stringify(tempDir)
    ].join(' ');
    const w = await run('bash', ['-lc', whisperxCmd]);
    if (w.code !== 0) throw new Error(w.stderr || 'whisper failed');
    
    const transcriptFileName = (await fsp.readdir(tempDir)).find(f => f.endsWith('.txt'));
    if (!transcriptFileName) throw new Error('File di trascrizione non trovato.');
    
    transcriptLocalPath = path.join(tempDir, transcriptFileName);
    const transcription = await fsp.readFile(transcriptLocalPath, 'utf8');

    return res.json({ ok: true, transcription, speakers: [] });

  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Errore durante la trascrizione.' });
  } finally {
    await safeRemoveDir(tempDir);
    await safeUnlink(req.file.path).catch(() => {});
  }
});


// ==========================================================
// == ENDPOINT DEDICATO PER LA VALUTAZIONE RAG (BASELINE) ==
// ==========================================================
// POSIZIONE CORRETTA: Prima del middleware 404
app.post('/api/rag/baseline', async (req, res) => {
  try {
    const rawTextInput = String(req.body?.query || '').trim(); // La "query" è la nostra trascrizione grezza
    const workspaceId = getWorkspaceIdFromRequest(req);
    const aiOverrides = extractAiProviderOverrides(req);

    if (!rawTextInput) {
      return res.status(400).json({ error: 'Il testo di input (query) è obbligatorio.' });
    }

    console.log(`[EVAL] Ricevuta richiesta per /api/rag/baseline. Input: "${rawTextInput.substring(0, 70)}..."`);

    // 1. Recupera il contesto usando il nostro RAG avanzato
    const contextString = await retrieveRelevantContext(rawTextInput, workspaceId, {
        textProvider: aiOverrides.text,
        embeddingProvider: aiOverrides.embedding,
    });

    // 2. GENERA LA RISPOSTA USANDO LA VERA LOGICA DI REC2PDF
    // Creiamo un file temporaneo con la trascrizione grezza, come si aspetta `generateMarkdown`
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rec2pdf_eval_'));
    const tempTxtPath = path.join(tempDir, 'transcript.txt');
    await fsp.writeFile(tempTxtPath, rawTextInput);

    let finalAnswer = "Errore durante la generazione del documento Markdown.";
    try {
        // Usiamo un prompt di default semplice per la valutazione, come 'prompt_format_base'
        const prompts = await listPrompts();
        const evalPrompt = findPromptById(prompts, 'prompt_format_base');

        const { content } = await generateMarkdown(
            tempTxtPath,
            evalPrompt, // Passiamo un payload di prompt di base
            contextString,
            { textProvider: aiOverrides.text }
        );
        finalAnswer = content;
    } finally {
        // Puliamo i file temporanei
        await fsp.rm(tempDir, { recursive: true, force: true });
    }
    
    // 3. Formatta il contesto per il report
    const contextChunks = contextString.split(CONTEXT_SEPARATOR).map((text, i) => ({
      id: `eval_chunk_${i}`,
      content: text
    }));

    // 4. Invia la risposta reale e il contesto
    res.json({
      answer: finalAnswer.trim(), // `answer` ora contiene il documento Markdown generato
      context: contextChunks
    });

  } catch (error) {
    console.error("❌ Errore grave nell'endpoint /api/rag/baseline:", error);
    res.status(500).json({ error: 'Errore interno del server.', details: error.message });
  }
});

// ==========================================================
// ==         ENDPOINT DI DEBUG PER LA PIPELINE RAG        ==
// ==========================================================
app.post('/api/rag/debug', async (req, res) => {
  try {
    const rawTextInput = String(req.body?.query || '').trim();
    const workspaceId = getWorkspaceIdFromRequest(req);
    const aiOverrides = extractAiProviderOverrides(req);

    if (!rawTextInput) {
      return res.status(400).json({ error: 'Il testo di input (query) è obbligatorio.' });
    }
    if (!workspaceId) {
      return res.status(400).json({ error: 'Il workspaceId è obbligatorio.' });
    }

    console.log(`[DEBUG] Ricevuta richiesta per /api/rag/debug. Input: "${rawTextInput.substring(0, 70)}..."`);

    // Chiamiamo il nostro RAGService in modalità debug
    const debugResult = await retrieveRelevantContext(rawTextInput, workspaceId, {
        textProvider: aiOverrides.text,
        embeddingProvider: aiOverrides.embedding,
        debug: true // Attiviamo la modalità debug
    });

    res.json(debugResult);

  } catch (error) {
    console.error("❌ Errore grave nell'endpoint /api/rag/debug:", error);
    res.status(500).json({ error: 'Errore interno del server.', details: error.message });
  }
});
// ==========================================================
// == MIDDLEWARE PER GESTIRE ENDPOINT API NON TROVATI (404) ==
// ==========================================================
// Questa deve essere una delle ULTIME definizioni relative alle API.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    // Se la richiesta inizia con /api/ e non ha trovato una rotta corrispondente prima, è un 404.
    return res.status(404).json({ ok: false, message: `Endpoint ${req.method} ${req.path} non disponibile sul backend.` });
  }
  // Se non è una richiesta API, passa al prossimo middleware (es. servire il frontend)
  return next();
});


// ==========================================================
// == AVVIO DEL SERVER ==
// ==========================================================
const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`rec2pdf backend in ascolto sulla porta ${PORT}`);
  });
  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  buildPandocFallback,
  buildTemplateEnv,
  buildEnvOptions,
  listTemplatesMetadata,
  resolveTemplateDescriptor,
  TemplateResolutionError,
  publishWithTemplateFallback,
  resolvePromptTemplateDescriptor,
  DEFAULT_LAYOUT_TEMPLATE_MAP,
  generateMarkdown,
  normalizeAiMarkdownBody,
  applySpeakerMapToContent,
  resolveDestinationDirectory,
  sanitizeDestDirInput,
  extractRefinedDataFromBody,
  sanitizeRefinedDataInput,
};

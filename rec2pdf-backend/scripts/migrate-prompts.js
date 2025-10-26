#!/usr/bin/env node

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const PROJECT_ROOT = path.resolve(__dirname, '..');

loadEnv();

const args = process.argv.slice(2);
const options = parseCliArgs(args);

const DEFAULT_PROMPTS_PATH = path.join(os.homedir(), '.rec2pdf', 'prompts.json');
const promptsPath = options.file ? path.resolve(options.file) : DEFAULT_PROMPTS_PATH;

(async () => {
  try {
    const promptsPayload = await readPromptsFile(promptsPath);
    const datasetUpdated = parseTimestamp(promptsPayload.updatedAt || promptsPayload.updated_at);
    const promptsArray = extractPromptArray(promptsPayload);

    if (!Array.isArray(promptsArray) || promptsArray.length === 0) {
      throw new Error('Nessun prompt trovato nel file specificato.');
    }

    const normalized = promptsArray.map((prompt, index) => normalizePrompt(prompt, index, datasetUpdated));

    const duplicateIssues = detectDuplicates(normalized.map((item) => item.record));
    if (duplicateIssues.length > 0) {
      duplicateIssues.forEach((issue) => console.error(`❌ ${issue}`));
      throw new Error('Risolvi i duplicati prima di procedere con la migrazione.');
    }

    const updatedWarnings = checkUpdatedAtConsistency(normalized, datasetUpdated);
    updatedWarnings.forEach((warning) => console.warn(`⚠️  ${warning}`));

    console.log(`Trovati ${normalized.length} prompt in ${promptsPath}`);

    if (options.dryRun) {
      console.log('Esecuzione in modalità dry-run: nessun dato verrà inviato a Supabase.');
      previewRecords(normalized.map((item) => item.record));
      return;
    }

    const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);
    if (missingEnv.length > 0) {
      throw new Error(`Variabili ambiente mancanti: ${missingEnv.join(', ')}`);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const records = normalized.map((item) => item.record);
    const { withId, withoutId } = splitRecordsForUpsert(records);

    if (withId.length > 0) {
      const { error } = await supabase.from('prompts').upsert(withId, { onConflict: 'id' });
      if (error) {
        throw new Error(`Errore upsert per id: ${error.message || error}`);
      }
      console.log(`Upsert completato per ${withId.length} record (match su id).`);
    }

    if (withoutId.length > 0) {
      const { error } = await supabase.from('prompts').upsert(withoutId, { onConflict: 'slug' });
      if (error) {
        throw new Error(`Errore upsert per slug: ${error.message || error}`);
      }
      console.log(`Upsert completato per ${withoutId.length} record (match su slug).`);
    }

    console.log('Migrazione completata.');
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
})();

function loadEnv() {
  const envPaths = [
    path.join(PROJECT_ROOT, '.env.local'),
    path.join(PROJECT_ROOT, '.env'),
    path.join(process.cwd(), '.env'),
  ];

  for (const envPath of envPaths) {
    dotenv.config({ path: envPath, override: false });
  }
}

function parseCliArgs(argv = []) {
  const options = {
    dryRun: false,
    file: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if ((arg === '--file' || arg === '--path') && argv[index + 1]) {
      options.file = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

async function readPromptsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File non trovato: ${filePath}`);
  }

  const raw = await fsp.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Impossibile analizzare il JSON in ${filePath}: ${error.message}`);
  }
}

function extractPromptArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.prompts)) {
    return payload.prompts;
  }
  if (Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

function normalizePrompt(prompt, index, datasetUpdated) {
  const source = prompt && typeof prompt === 'object' ? { ...prompt } : {};
  const uuid = pickUuid([source.supabaseId, source.supabase_id, source.id]);
  const legacyId = pickLegacyId(source, uuid);
  const slug = sanitizeSlug(source.slug || legacyId || source.title || `prompt_${index + 1}`, `prompt_${index + 1}`);
  const title = parseString(source.title);
  if (!title) {
    throw new Error(`Prompt #${index + 1}: titolo mancante.`);
  }

  const summary = parseString(source.summary);
  const description = parseString(source.description);
  const persona = parseString(source.persona);
  const color = normalizeColor(source.color);
  const tags = normalizeTags(source.tags);
  const cueCards = normalizeCueCards(source.cueCards || source.cue_cards);
  const markdownRules = normalizePromptRules(source.markdownRules || source.markdown_rules);
  const pdfRules = normalizePdfRules(source.pdfRules || source.pdf_rules);
  const checklist = normalizeChecklist(source.checklist);
  const builtIn = Boolean(source.builtIn ?? source.built_in ?? false);
  const workspaceId = parseUuid(source.workspaceId || source.workspace_id) || null;

  const createdAt = parseTimestamp(source.created_at || source.createdAt) || datasetUpdated || new Date().toISOString();
  const updatedAt = parseTimestamp(source.updated_at || source.updatedAt || datasetUpdated) || createdAt;

  const createdAtMs = Date.parse(createdAt);
  let updatedAtMs = Date.parse(updatedAt);
  let adjustedUpdatedAt = updatedAt;
  if (Number.isFinite(createdAtMs) && Number.isFinite(updatedAtMs) && updatedAtMs < createdAtMs) {
    adjustedUpdatedAt = new Date(createdAtMs).toISOString();
    updatedAtMs = createdAtMs;
  }

  return {
    record: {
      ...(uuid ? { id: uuid } : {}),
      legacy_id: legacyId,
      workspace_id: workspaceId,
      slug,
      title,
      summary,
      description,
      persona,
      color,
      tags,
      cue_cards: cueCards,
      markdown_rules: markdownRules,
      pdf_rules: pdfRules,
      checklist,
      built_in: builtIn,
      created_at: createdAt,
      updated_at: adjustedUpdatedAt,
    },
    meta: {
      sourceUpdatedAt: updatedAtMs,
    },
  };
}

function pickUuid(candidates = []) {
  for (const candidate of candidates) {
    const parsed = parseUuid(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function pickLegacyId(source = {}, uuid) {
  const candidates = [source.legacyId, source.legacy_id];
  for (const candidate of candidates) {
    const normalized = parseString(candidate);
    if (normalized) return normalized;
  }
  if (uuid) {
    return null;
  }
  const idCandidate = parseString(source.id);
  if (idCandidate && !parseUuid(idCandidate)) {
    return idCandidate;
  }
  return null;
}

function parseString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => parseString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => parseString(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeCueCards(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((card, index) => {
      if (!card || typeof card !== 'object') return null;
      const key = parseString(card.key || card.id) || `cue_${index}`;
      const title = parseString(card.title || card.label);
      const hint = parseString(card.hint || card.description);
      if (!title) return null;
      return { key, title, hint };
    })
    .filter(Boolean);
}

function normalizePromptRules(rules = {}) {
  if (!rules || typeof rules !== 'object') return null;
  const normalized = {};
  if (rules.tone) normalized.tone = parseString(rules.tone);
  if (rules.voice) normalized.voice = parseString(rules.voice);
  if (rules.bulletStyle) normalized.bulletStyle = parseString(rules.bulletStyle);
  if (rules.summaryStyle) normalized.summaryStyle = parseString(rules.summaryStyle);
  if (typeof rules.includeCallouts === 'boolean') normalized.includeCallouts = rules.includeCallouts;
  if (rules.pointOfView) normalized.pointOfView = parseString(rules.pointOfView);
  if (rules.lengthGuideline) normalized.lengthGuideline = parseString(rules.lengthGuideline);
  return Object.keys(normalized).length ? normalized : null;
}

function normalizePdfRules(rules = {}) {
  if (!rules || typeof rules !== 'object') return null;
  const normalized = {};
  if (rules.accentColor || rules.accent_color || rules.color) {
    normalized.accentColor = normalizeColor(rules.accentColor || rules.accent_color || rules.color);
  }
  if (rules.layout) normalized.layout = parseString(rules.layout);
  if (typeof rules.includeCover === 'boolean') normalized.includeCover = rules.includeCover;
  if (typeof rules.includeToc === 'boolean') normalized.includeToc = rules.includeToc;
  if (rules.footerNote) normalized.footerNote = parseString(rules.footerNote);
  if (rules.template) normalized.template = parseString(rules.template);
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeChecklist(value) {
  if (!value) return null;
  let source = value;
  if (typeof value === 'string') {
    source = { sections: value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) };
  }
  if (!source || typeof source !== 'object') return null;
  const sections = normalizeChecklistSections(source.sections || source);
  const focusPrompts = normalizeStringArray(source.focusPrompts || source.focus_prompts);
  const normalized = {};
  if (sections.length) normalized.sections = sections;
  if (focusPrompts.length) normalized.focusPrompts = focusPrompts;
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeChecklistSections(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => parseString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => parseString(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => parseString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => parseString(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeColor(value) {
  if (!value) return '#6366f1';
  const hex = String(value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  return '#6366f1';
}

function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

function parseUuid(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

function sanitizeSlug(value, fallback) {
  const raw = String(value || '').trim();
  const base = raw || fallback || 'prompt';
  return base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function detectDuplicates(records = []) {
  const issues = [];
  const idMap = new Map();
  const slugMap = new Map();

  records.forEach((record, index) => {
    if (record.id) {
      if (idMap.has(record.id)) {
        issues.push(`Duplicato id tra record #${idMap.get(record.id) + 1} e #${index + 1} (${record.id})`);
      } else {
        idMap.set(record.id, index);
      }
    }
    if (record.slug) {
      if (slugMap.has(record.slug)) {
        issues.push(`Duplicato slug tra record #${slugMap.get(record.slug) + 1} e #${index + 1} (${record.slug})`);
      } else {
        slugMap.set(record.slug, index);
      }
    }
  });

  return issues;
}

function checkUpdatedAtConsistency(normalized = [], datasetUpdated) {
  const warnings = [];
  const datasetMs = datasetUpdated ? Date.parse(datasetUpdated) : null;
  let maxUpdatedMs = datasetMs || 0;

  normalized.forEach(({ record, meta }, index) => {
    const createdMs = Date.parse(record.created_at);
    const updatedMs = Date.parse(record.updated_at);
    if (Number.isFinite(updatedMs) && updatedMs > maxUpdatedMs) {
      maxUpdatedMs = updatedMs;
    }
    if (Number.isFinite(createdMs) && Number.isFinite(updatedMs) && updatedMs < createdMs) {
      warnings.push(`Prompt #${index + 1} (${record.slug}): updated_at precedente a created_at, normalizzato automaticamente.`);
    }
    if (!Number.isFinite(updatedMs)) {
      warnings.push(`Prompt #${index + 1} (${record.slug}): updated_at mancante, impostato al valore di fallback.`);
    }
    if (meta.sourceUpdatedAt && Number.isFinite(meta.sourceUpdatedAt) && datasetMs && meta.sourceUpdatedAt > datasetMs) {
      warnings.push(
        `Prompt #${index + 1} (${record.slug}): updatedAt (${new Date(meta.sourceUpdatedAt).toISOString()}) ` +
          `successivo al timestamp del file (${datasetUpdated}).`
      );
    }
  });

  if (datasetMs && maxUpdatedMs > datasetMs) {
    warnings.push(
      `Il campo updatedAt del file (${datasetUpdated}) è precedente all'ultimo prompt (${new Date(maxUpdatedMs).toISOString()}).`
    );
  }

  return warnings;
}

function splitRecordsForUpsert(records = []) {
  const withId = [];
  const withoutId = [];
  records.forEach((record) => {
    if (record.id) {
      withId.push(record);
    } else {
      withoutId.push(record);
    }
  });
  return { withId, withoutId };
}

function previewRecords(records = []) {
  const sample = records.slice(0, 3);
  sample.forEach((record, index) => {
    console.log(`— Prompt normalizzato #${index + 1}: ${record.slug}`);
    console.log(JSON.stringify(record, null, 2));
  });
  if (records.length > sample.length) {
    console.log(`… altri ${records.length - sample.length} record omessi dalla preview.`);
  }
}

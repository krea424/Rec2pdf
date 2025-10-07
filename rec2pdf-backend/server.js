require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile, exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 7788;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// DICHIARA QUI LA VARIABILE MANCANTE
const isAuthEnabled = !!supabase;

if (!isAuthEnabled) {
  console.warn('⚠️  Supabase non configurato: il backend è avviato senza autenticazione (MODALITÀ SVILUPPO).');
}
// ===== Configurazione Path =====
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..');
const PUBLISH_SCRIPT = process.env.PUBLISH_SCRIPT || path.join(PROJECT_ROOT, 'Scripts', 'publish.sh');
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.join(PROJECT_ROOT, 'Templates');
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(PROJECT_ROOT, 'rec2pdf-frontend', 'src', 'assets');

// Verifica che lo script esista all'avvio
if (!fs.existsSync(PUBLISH_SCRIPT)) {
  console.warn(`⚠️  ATTENZIONE: Script publish.sh non trovato in ${PUBLISH_SCRIPT}`);
  console.warn(`   Il sistema userà il fallback pandoc generico.`);
} else {
  console.log(`✅ Script publish.sh trovato: ${PUBLISH_SCRIPT}`);
}

app.use(cors({ origin: true, credentials: true }));
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
  if (req.path === '/health') {
    return next();
  }
  return authenticateRequest(req, res, next);
});

const DATA_DIR = path.join(os.homedir(), '.rec2pdf');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const PROMPTS_FILE = path.join(DATA_DIR, 'prompts.json');
const DEFAULT_STATUSES = ['Bozza', 'In lavorazione', 'Da revisionare', 'Completato'];

const run = (cmd, args, opts = {}) => new Promise((resolve) => {
  const child = execFile(cmd, args, opts, (err, stdout, stderr) => {
    resolve({
      code: err?.code || 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    });
  });
  child.on('error', (err) => {
    resolve({ code: -1, stdout: '', stderr: err.message });
  });
});

const zsh = (command, opts = {}) => run('zsh', ['-lc', command], opts);

const commandVersion = async (cmd) => {
  try {
    const result = await run(cmd, ['-version']);
    const detail = result.stdout.split('\n')[0].trim();
    return { ok: !!detail, detail };
  } catch {
    return { ok: false, detail: 'not found' };
  }
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

const ensureDir = (dir) => fsp.mkdir(dir, { recursive: true });







const writePrompts = async (prompts = []) => {
  await ensureDataStore();
  const payload = { prompts, updatedAt: Date.now() };
  await fsp.writeFile(PROMPTS_FILE, JSON.stringify(payload, null, 2));
  return payload;
};

const findPromptById = (prompts, id) => {
  if (!id) return null;
  return (prompts || []).find((prompt) => prompt.id === id) || null;
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

const generateMarkdown = async (txtPath, mdFile, promptPayload) => {
  try {
    const transcript = await fsp.readFile(txtPath, 'utf8');

    let promptLines = [
      "Sei un assistente AI specializzato nell'analisi di trascrizioni di riunioni.",
      "Il tuo compito è trasformare il testo grezzo in un documento Markdown ben strutturato, chiaro e utile.",
      "Organizza il contenuto usando intestazioni (es. `## Argomento`), elenchi puntati (`-`) e paragrafi concisi.",
      "L'output deve essere solo il Markdown, senza commenti o testo aggiuntivo.",
      "La lingua del documento finale deve essere l'italiano."
    ];

    if (promptPayload) {
      const { persona, description, markdownRules, focus, notes } = promptPayload;
      const rules = [];
      if (persona) rules.push(`Agisci con la persona di un: ${persona}.`);
      if (description) rules.push(`Il tuo obiettivo specifico è: ${description}.`);
      if (markdownRules) {
        if (markdownRules.tone) rules.push(`Usa un tono ${markdownRules.tone}.`);
        if (markdownRules.voice) rules.push(`Usa una voce in ${markdownRules.voice}.`);
        if (markdownRules.bulletStyle) rules.push(`Per gli elenchi, usa lo stile: ${markdownRules.bulletStyle}.`);
        if (markdownRules.summaryStyle) rules.push(`Includi un sommario in stile: ${markdownRules.summaryStyle}.`);
        if (markdownRules.includeCallouts) rules.push("Includi callout/citazioni per evidenziare punti importanti.");
        if (markdownRules.pointOfView) rules.push(`Adotta questo punto di vista: ${markdownRules.pointOfView}.`);
      }
      if (focus) rules.push(`Concentrati su: ${focus}.`);
      if (notes) rules.push(`Considera queste note: ${notes}.`);

      if (rules.length > 0) {
        promptLines.push("\nRegole specifiche da seguire:");
        promptLines.push(...rules);
      }
    }

    promptLines.push("\nEcco la trascrizione da elaborare:\n---\n");
    const prompt = promptLines.join('\n');

    const fullPrompt = `${prompt}${transcript}`;

    // Using 'gemini' CLI tool. Assuming it's in the PATH.
    // The command is constructed to prevent shell injection issues.
    const result = await run('gemini', [fullPrompt]);

    if (result.code !== 0) {
      const stderr = result.stderr || 'Errore sconosciuto dal comando gemini';
      // Check if gemini command is not found
      if (/command not found/i.test(stderr) || result.code === 127 || result.code === -1) {
        return { code: result.code, stdout: '', stderr: "Comando 'gemini' non trovato. Assicurati che sia installato e nel PATH." };
      }
      return { code: result.code, stdout: result.stdout, stderr: stderr };
    }

    // Post-processing: rimuovi wrapper markdown se presente
let cleanedContent = result.stdout;

// Rimuovi blocchi ```markdown all'inizio e ``` alla fine
cleanedContent = cleanedContent.replace(/^```markdown\s*/i, '');
cleanedContent = cleanedContent.replace(/\s*```\s*$/i, '');

// Rimuovi anche eventuali backticks tripli interni che wrappano tutto il contenuto
const lines = cleanedContent.split('\n');
if (lines.length > 2 && lines[0].trim() === '```markdown' && lines[lines.length - 1].trim() === '```') {
  cleanedContent = lines.slice(1, -1).join('\n');
}

await fsp.writeFile(mdFile, cleanedContent, 'utf8');
    return { code: 0, stdout: '', stderr: '' };
  } catch (error) {
    return { code: -1, stdout: '', stderr: error.message };
  }
};

const readWorkspaces = async () => {
  await ensureDataStore();
  try {
    const raw = await fsp.readFile(WORKSPACES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.workspaces)) {
      return parsed.workspaces;
    }
  } catch (error) {
    console.warn('Impossibile leggere workspaces.json:', error.message || error);
  }
  return [];
};

const writeWorkspaces = async (workspaces = []) => {
  await ensureDataStore();
  const payload = { workspaces, updatedAt: Date.now() };
  await fsp.writeFile(WORKSPACES_FILE, JSON.stringify(payload, null, 2));
  return payload;
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

const findWorkspaceById = (workspaces, id) => {
  if (!id) return null;
  return workspaces.find((ws) => ws.id === id) || null;
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

const VALID_LOGO_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.svg']);

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

const uploadFileToBucket = async (bucket, objectPath, buffer, contentType) => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    cacheControl: '3600',
    contentType: contentType || 'application/octet-stream',
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload fallito su Supabase (${bucket}/${objectPath}): ${error.message}`);
  }
};

const downloadFileFromBucket = async (bucket, objectPath) => {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) {
    throw new Error(`Download fallito da Supabase (${bucket}/${objectPath}): ${error.message}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const normalizeStoragePrefix = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
};

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
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.min(options.limit, 1000) : 1000;
  const offset = Number.isFinite(options.offset) && options.offset > 0 ? options.offset : 0;
  const sortBy = options.sortBy || { column: 'updated_at', order: 'desc' };

  const { data, error } = await supabase.storage
    .from(normalizedBucket)
    .list(normalizedPrefix || '', { limit, offset, sortBy });

  if (error) {
    const listError = new Error(error.message || 'Impossibile elencare gli oggetti Supabase');
    listError.statusCode = Number(error.statusCode) || 500;
    throw listError;
  }

  const entries = Array.isArray(data) ? data : [];
  return entries
    .filter((item) => item && item.name && item.metadata && typeof item.metadata.size === 'number')
    .map((item) => {
      const relativePath = normalizedPrefix ? `${normalizedPrefix}/${item.name}` : item.name;
      return {
        name: relativePath,
        size: Number(item.metadata.size) || 0,
        updatedAt: item.updated_at || item.created_at || null,
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
    id: 'prompt_format_base',
    slug: 'format_base',
    title: 'Format base',
    description: "Trasforma gli appunti in un documento Markdown professionale. Inserire all'inizio del file un blocco YAML senza righe vuote sopra, evita di inserire all'inizio del file markdownaltri segni,simboli o termini che non siano i 3 trattininella prima riga solo 3 trattini e 3 trattini alla fine del blocco YAML, con i campi nell’ordine seguente: title, author, owner, project_name, project_code, artifact_type, version, identifier, location, summary, usageterms, ssot, status, created, updated, tags, ai.generated, ai.model, ai.prompt_id. Versioni in forma SemVer con underscore (es. v1_0_0). La struttura del documento DEVE includere sezioni con i titoli esatti: 'Executive Summary', 'Punti Chiave', 'Analisi Dettagliata', 'Prossime Azioni'. Inserisci almeno una tabella con un massimo di 4 colonne e una tabella dei 3 principali rischi. NON usare backticks di codice.",
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

const bootstrapDefaultPrompts = () => {
  const now = Date.now();
  return DEFAULT_PROMPTS.map((prompt, index) => ({
    ...prompt,
    createdAt: prompt.createdAt || now + index,
    updatedAt: prompt.updatedAt || now + index,
  }));
};

const ensureDataStore = async () => {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(WORKSPACES_FILE, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(
      WORKSPACES_FILE,
      JSON.stringify({ workspaces: [], updatedAt: Date.now() }, null, 2)
    );
  }
  try {
    await fsp.access(PROMPTS_FILE, fs.constants.F_OK);
  } catch {
    const prompts = bootstrapDefaultPrompts();
    await fsp.writeFile(
      PROMPTS_FILE,
      JSON.stringify({ prompts, updatedAt: Date.now() }, null, 2)
    );
  }
};

const readPrompts = async () => {
  await ensureDataStore();
  try {
    const raw = await fsp.readFile(PROMPTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.prompts)) {
      return parsed.prompts;
    }
  } catch (error) {
    console.warn('Impossibile leggere prompts.json:', error.message || error);
  }
  const prompts = bootstrapDefaultPrompts();
  await writePrompts(prompts);
  return prompts;
};

const mergeWorkspaceUpdate = (workspace, patch) => {
  const updated = { ...workspace };
  if (patch.name) updated.name = String(patch.name).trim();
  if (patch.client) updated.client = String(patch.client).trim();
  if (patch.color) updated.color = normalizeColor(patch.color);
  if (patch.slug) updated.slug = String(patch.slug).trim().replace(/[^a-zA-Z0-9._-]/g, '_');
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

  updated.updatedAt = Date.now();
  return updated;
};

app.get('/api/workspaces', async (req, res) => {
  try {
    const workspaces = await readWorkspaces();
    res.json({ ok: true, workspaces });
  } catch (error) {
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.post('/api/workspaces', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ ok: false, message: 'Nome workspace obbligatorio' });
    }

    const workspaces = await readWorkspaces();
    const workspace = {
      id: generateId('ws'),
      name,
      client: String(req.body?.client || name).trim(),
      color: normalizeColor(req.body?.color || '#6366f1'),
      slug: String(req.body?.slug || name.toLowerCase().replace(/\s+/g, '-')).replace(/[^a-zA-Z0-9._-]/g, '_'),
      versioningPolicy: {
        retentionLimit: Number.isFinite(req.body?.versioningPolicy?.retentionLimit)
          ? Math.max(1, Number(req.body.versioningPolicy.retentionLimit))
          : 10,
        freezeOnPublish: Boolean(req.body?.versioningPolicy?.freezeOnPublish),
        namingConvention: req.body?.versioningPolicy?.namingConvention || 'timestamped',
      },
      defaultStatuses: Array.isArray(req.body?.defaultStatuses) && req.body.defaultStatuses.length
        ? req.body.defaultStatuses.map((status) => String(status).trim()).filter(Boolean)
        : [...DEFAULT_STATUSES],
      projects: Array.isArray(req.body?.projects)
        ? req.body.projects.map((project) => ({
          id: project.id || generateId('proj'),
          name: String(project.name || 'Project').trim(),
          color: normalizeColor(project.color || req.body?.color || '#6366f1'),
          statuses: Array.isArray(project.statuses) && project.statuses.length
            ? project.statuses.map((status) => String(status).trim()).filter(Boolean)
            : [...DEFAULT_STATUSES],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }))
        : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    workspaces.push(workspace);
    await writeWorkspaces(workspaces);
    res.status(201).json({ ok: true, workspace });
  } catch (error) {
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.put('/api/workspaces/:id', async (req, res) => {
  try {
    const workspaces = await readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }

    const merged = mergeWorkspaceUpdate(workspaces[index], req.body || {});
    workspaces[index] = merged;
    await writeWorkspaces(workspaces);
    res.json({ ok: true, workspace: merged });
  } catch (error) {
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.delete('/api/workspaces/:id', async (req, res) => {
  try {
    const workspaces = await readWorkspaces();
    const next = workspaces.filter((workspace) => workspace.id !== req.params.id);
    if (next.length === workspaces.length) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
    await writeWorkspaces(next);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.get('/api/prompts', async (req, res) => {
  try {
    const prompts = await readPrompts();
    res.json({ ok: true, prompts });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.post('/api/prompts', async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'Titolo prompt obbligatorio' });
    }

    const prompts = await readPrompts();
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

    const now = Date.now();
    const prompt = {
      id: generateId('prompt'),
      slug,
      title,
      description: String(req.body?.description || '').trim(),
      persona: String(req.body?.persona || '').trim(),
      color: normalizeColor(req.body?.color || '#6366f1'),
      tags,
      cueCards,
      checklist: { sections: checklistSections },
      markdownRules: markdownRules || null,
      pdfRules: pdfRules || null,
      focusPrompts,
      builtIn: Boolean(req.body?.builtIn && req.body.builtIn === true ? true : false),
      createdAt: now,
      updatedAt: now,
    };

    prompts.push(prompt);
    await writePrompts(prompts);
    res.status(201).json({ ok: true, prompt });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.put('/api/prompts/:id', async (req, res) => {
  try {
    const prompts = await readPrompts();
    const index = prompts.findIndex((prompt) => prompt.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Prompt non trovato' });
    }

    const merged = mergePromptUpdate(prompts[index], req.body || {});
    prompts[index] = merged;
    await writePrompts(prompts);
    res.json({ ok: true, prompt: merged });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.delete('/api/prompts/:id', async (req, res) => {
  try {
    const prompts = await readPrompts();
    const prompt = findPromptById(prompts, req.params.id);
    if (!prompt) {
      return res.status(404).json({ ok: false, message: 'Prompt non trovato' });
    }
    const force = String(req.query?.force || '')
      .toLowerCase()
      .trim();
    const isForceEnabled = force && ['1', 'true', 'yes', 'on'].includes(force);
    if (prompt.builtIn && !isForceEnabled) {
      return res
        .status(400)
        .json({ ok: false, message: 'I template predefiniti non possono essere eliminati' });
    }
    const next = prompts.filter((item) => item.id !== prompt.id);
    await writePrompts(next);
    res.json({ ok: true });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.get('/api/health', (req, res) => { res.json({ ok: true, ts: Date.now() }); });

app.get('/api/diag', async (req, res) => {
  const logs = [];
  const out = (s) => { logs.push(s); };
  try {
    const ff = await commandVersion('ffmpeg');
    out(ff.ok ? `✅ ffmpeg: ${ff.detail}` : '❌ ffmpeg non trovato');
  } catch { out('❌ ffmpeg non eseguibile'); }

  try {
    const w = await run('bash', ['-lc', 'command -v whisper && whisper --version || true']);
    out(/whisper/.test(w.stdout) ? `✅ whisper: trovato` : '❌ whisper non trovato');
  } catch { out('❌ whisper non eseguibile'); }

  try {
    const g = await run('bash', ['-lc', 'command -v gemini']);
    out(g.code === 0 ? '✅ gemini: trovato' : '❌ gemini non trovato. Necessario per la generazione Markdown.');
  } catch { out('❌ gemini non eseguibile'); }

  try {
    const ppub = await zsh('command -v ppubr >/dev/null || command -v PPUBR >/dev/null && echo OK || echo NO');
    out(ppub.stdout.includes('OK') ? `✅ ppubr/PPUBR: disponibile` : '❌ ppubr/PPUBR non trovato');
  } catch { out('❌ ppubr non disponibile'); }

  try {
    const pandoc = await zsh('command -v pandocPDF >/dev/null && echo pandocPDF || command -v pandoc >/dev/null && echo pandoc || echo NO');
    out(/pandoc/i.test(pandoc.stdout) ? `✅ pandoc: ${pandoc.stdout.trim()}` : '⚠️ pandoc non trovato');
  } catch { out('⚠️ pandoc non disponibile'); }

  try {
    const defaultDest = path.join(os.homedir(), 'Recordings');
    const writable = await ensureWritableDirectory(defaultDest);
    out(writable.ok ? `✅ Permessi scrittura OK su ${defaultDest}` : `❌ Permessi scrittura insufficienti su ${defaultDest}`);
  } catch { out('⚠️ Impossibile verificare permessi di scrittura'); }

  const ok = logs.some(l => l.startsWith('✅ ffmpeg')) && logs.some(l => /whisper: trovato/.test(l));
  res.json({ ok, logs });
});

app.post('/api/rec2pdf', uploadMiddleware.fields([{ name: 'audio', maxCount: 1 }, { name: 'pdfLogo', maxCount: 1 }]), async (req, res) => {
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

  try {
    if (!req.files || !req.files.audio) {
      logStageEvent('upload', 'failed', 'Nessun file audio');
      return res.status(400).json({ ok: false, message: 'Nessun file audio', logs, stageEvents });
    }

    const slug = sanitizeSlug(req.body.slug || 'meeting', 'meeting');
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
      const prompts = await readPrompts();
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
    if (workspaceId) {
      const workspaces = await readWorkspaces();
      const foundWorkspace = findWorkspaceById(workspaces, workspaceId);
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
          const next = workspaces.map((ws) => (ws.id === updatedWorkspace.id ? updatedWorkspace : ws));
          await writeWorkspaces(next);
          out(
            `📁 Workspace aggiornato con il progetto ${project?.name || workspaceProjectName || workspaceProjectId}`,
            'upload',
            'info'
          );
        }
      }
    }

    const userId = req.user?.id || 'anonymous';
    const registerTempDir = (dir) => {
      if (dir) tempDirs.add(dir);
      return dir;
    };
    const registerTempFile = (file) => {
      if (file) tempFiles.add(file);
      return file;
    };

    const pipelineDir = registerTempDir(await fsp.mkdtemp(path.join(os.tmpdir(), 'rec2pdf_pipeline_')));

    const audioFile = req.files.audio[0];
    const originalAudioName = audioFile.originalname || 'audio';
    const sanitizedOriginalName = sanitizeStorageFileName(originalAudioName, 'audio');
    const audioTimestamp = Date.now();
    const audioStoragePath = `uploads/${userId}/${audioTimestamp}_${sanitizedOriginalName}`;

    out('🚀 Preparazione upload…', 'upload', 'running');
    const audioBuffer = await fsp.readFile(audioFile.path);
    await uploadFileToBucket(
      SUPABASE_AUDIO_BUCKET,
      audioStoragePath,
      audioBuffer,
      audioFile.mimetype || 'application/octet-stream'
    );
    out(`📦 Upload ricevuto: ${path.basename(originalAudioName)}`, 'upload', 'completed');
    out('☁️ File caricato su Supabase Storage', 'upload', 'info');

    const baseName = workspaceMeta
      ? await buildWorkspaceBaseName(workspaceMeta, pipelineDir, slug)
      : `${yyyymmddHHMMSS(new Date())}_${slug}`;

    const processedBasePath = `processed/${userId}`;
    const wavStoragePath = `${processedBasePath}/${baseName}.wav`;
    const txtStoragePath = `${processedBasePath}/${baseName}.txt`;
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

      if (audioLocalPath === wavLocalPath) {
        const tempWavPath = registerTempFile(path.join(pipelineDir, `${baseName}_temp.wav`));
        const ff = await run('ffmpeg', ['-y', '-i', audioLocalPath, '-ac', '1', '-ar', '16000', tempWavPath]);
        if (ff.code !== 0) {
          out(ff.stderr || 'ffmpeg failed', 'transcode', 'failed');
          throw new Error('Transcodifica fallita');
        }
        await fsp.rename(tempWavPath, wavLocalPath);
      } else {
              if (audioLocalPath === wavLocalPath) {
                const tempWavPath = registerTempFile(path.join(pipelineDir, `${baseName}_temp.wav`));
                const ff = await run('ffmpeg', ['-y', '-i', audioLocalPath, '-ac', '1', '-ar', '16000', tempWavPath]);
                if (ff.code !== 0) {
                  out(ff.stderr || 'ffmpeg failed', 'transcode', 'failed');
                  throw new Error('Transcodifica fallita');
                }
                await fsp.rename(tempWavPath, wavLocalPath);
              } else {
                const ff = await run('ffmpeg', ['-y', '-i', audioLocalPath, '-ac', '1', '-ar', '16000', wavLocalPath]);
                if (ff.code !== 0) {
                  out(ff.stderr || 'ffmpeg failed', 'transcode', 'failed');
                  throw new Error('Transcodifica fallita');
                }
              }      }

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

    out('🎧 Trascrizione con Whisper…', 'transcribe', 'running');
    const wavLocalForTranscribe = registerTempFile(path.join(pipelineDir, `${baseName}.wav`));
    let transcriptLocalPath = '';
    try {
      const wavBuffer = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, wavStoragePath);
      await fsp.writeFile(wavLocalForTranscribe, wavBuffer);
      const whisperOutputDir = pipelineDir;
      const w = await run('bash', [
        '-lc',
        `whisper ${JSON.stringify(wavLocalForTranscribe)} --language it --model small --output_format txt --output_dir ${JSON.stringify(whisperOutputDir)} --verbose False`
      ]);
      if (w.code !== 0) {
        out(w.stderr || w.stdout || 'whisper failed', 'transcribe', 'failed');
        throw new Error('Trascrizione fallita');
      }
      const candidates = (await fsp.readdir(whisperOutputDir)).filter((file) => file.startsWith(baseName) && file.endsWith('.txt'));
      if (!candidates.length) {
        throw new Error('Trascrizione .txt non trovata');
      }
      transcriptLocalPath = registerTempFile(path.join(whisperOutputDir, candidates[0]));
      await uploadFileToBucket(
        SUPABASE_PROCESSED_BUCKET,
        txtStoragePath,
        await fsp.readFile(transcriptLocalPath),
        'text/plain'
      );
      out(`✅ Trascrizione completata: ${path.basename(transcriptLocalPath)}`, 'transcribe', 'completed');
    } finally {
      await safeUnlink(wavLocalForTranscribe);
      await safeUnlink(transcriptLocalPath);
    }

    out('📝 Generazione Markdown…', 'markdown', 'running');
    let txtLocalForMarkdown = '';
    let mdLocalPath = '';
    try {
      const transcriptBuffer = await downloadFileFromBucket(SUPABASE_PROCESSED_BUCKET, txtStoragePath);
      txtLocalForMarkdown = registerTempFile(path.join(pipelineDir, `${baseName}.txt`));
      await fsp.writeFile(txtLocalForMarkdown, transcriptBuffer);
      mdLocalPath = registerTempFile(path.join(pipelineDir, `documento_${baseName}.md`));
      const gm = await generateMarkdown(txtLocalForMarkdown, mdLocalPath, promptRulePayload);
      if (gm.code !== 0) {
        out(gm.stderr || gm.stdout || 'Generazione Markdown fallita', 'markdown', 'failed');
        throw new Error('Generazione Markdown fallita: ' + (gm.stderr || gm.stdout));
      }
      if (!fs.existsSync(mdLocalPath)) {
        throw new Error(`Markdown non trovato: ${mdLocalPath}`);
      }
      await uploadFileToBucket(
        SUPABASE_PROCESSED_BUCKET,
        mdStoragePath,
        await fsp.readFile(mdLocalPath),
        'text/markdown'
      );
      out(`✅ Markdown generato: ${path.basename(mdLocalPath)}`, 'markdown', 'completed');
    } finally {
      await safeUnlink(txtLocalForMarkdown);
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

      const pb = await callPublishScript(mdLocalForPublish, publishEnv);

      if (pb.code !== 0) {
        out(pb.stderr || pb.stdout || 'publish.sh failed', 'publish', 'warning');
        out('Tentativo fallback pandoc…', 'publish', 'info');
      }

      if (!fs.existsSync(pdfLocalPath)) {
        const destDir = path.dirname(mdLocalForPublish);
        const pandoc = await zsh(
          `cd ${JSON.stringify(destDir)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdLocalForPublish)} || pandoc -o ${JSON.stringify(pdfLocalPath)} ${JSON.stringify(mdLocalForPublish)}`,
          publishEnv
        );
        if (pandoc.code !== 0 || !fs.existsSync(pdfLocalPath)) {
          out(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
          throw new Error('Generazione PDF fallita');
        }
        out('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
      }

      await uploadFileToBucket(
        SUPABASE_PROCESSED_BUCKET,
        pdfStoragePath,
        await fsp.readFile(pdfLocalPath),
        'application/pdf'
      );
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
      logs,
      stageEvents,
      workspace: workspaceAssignment,
      prompt: promptAssignment,
      structure,
    });
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    const failureStage = lastStageKey || 'complete';
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
    try { if (req.files && req.files.audio) await safeUnlink(req.files.audio[0].path); } catch { }
    try { if (req.files && req.files.pdfLogo) await safeUnlink(req.files.pdfLogo[0].path); } catch { }
    for (const filePath of tempFiles) {
      await safeUnlink(filePath);
    }
    for (const dirPath of tempDirs) {
      await safeRemoveDir(dirPath);
    }
  }
});

app.post('/api/ppubr', uploadMiddleware.fields([{ name: 'pdfLogo', maxCount: 1 }]), async (req, res) => {
  const logs = [];
  const out = (s) => { logs.push(s); };
  let customLogoPath = null;
  let workDir = '';
  const cleanupFiles = new Set();
  let usedSupabaseFlow = false;

  try {
    const mdPathRaw = String(req.body?.mdPath || '').trim();
    if (!mdPathRaw) {
      return res.status(400).json({ ok: false, message: 'Percorso Markdown mancante', logs });
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

      const mdBuffer = await downloadFileFromBucket(bucket, objectPath);
      await fsp.writeFile(mdLocalPath, mdBuffer);

      const pb = await callPublishScript(mdLocalPath, publishEnv);
      if (pb.code !== 0) {
        out(pb.stderr || pb.stdout || 'publish.sh failed');
        out('Tentativo fallback pandoc…');
      }

      if (!fs.existsSync(pdfLocalPath)) {
        out('publish.sh non ha generato un PDF, fallback su pandoc…');
        const pandoc = await zsh(
          `cd ${JSON.stringify(workDir)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdLocalPath)} || pandoc -o ${JSON.stringify(pdfLocalPath)} ${JSON.stringify(mdLocalPath)}`,
          publishEnv
        );
        if (pandoc.code !== 0 || !fs.existsSync(pdfLocalPath)) {
          out(pandoc.stderr || pandoc.stdout || 'pandoc failed');
          throw new Error('Rigenerazione PDF fallita');
        }
        out('✅ PDF creato tramite fallback pandoc');
      }

      await uploadFileToBucket(
        bucket,
        pdfObjectPath,
        await fsp.readFile(pdfLocalPath),
        'application/pdf'
      );
      out(`☁️ PDF aggiornato su Supabase: ${pdfObjectPath}`);

      const normalizedMdPath = `${bucket}/${objectPath}`;
      const normalizedPdfPath = `${bucket}/${pdfObjectPath}`;
      return res.json({ ok: true, pdfPath: normalizedPdfPath, mdPath: normalizedMdPath, logs });
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

    const pb = await callPublishScript(mdPath, publishEnv);
    if (pb.code !== 0) {
      out(pb.stderr || pb.stdout || 'publish.sh failed');
      out('Tentativo fallback pandoc…');
    }

    const baseName = path.basename(mdPath, path.extname(mdPath));
    const pdfPath = path.join(dest, `${baseName}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      out('publish.sh non ha generato un PDF, fallback su pandoc…');
      const pandoc = await zsh(
        `cd ${JSON.stringify(dest)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdPath)} || pandoc -o ${JSON.stringify(pdfPath)} ${JSON.stringify(mdPath)}`,
        publishEnv
      );
      if (pandoc.code !== 0 || !fs.existsSync(pdfPath)) {
        out(pandoc.stderr || pandoc.stdout || 'pandoc failed');
        throw new Error('Rigenerazione PDF fallita');
      }
    }

    out(`✅ Fatto! PDF creato: ${pdfPath}`);
    return res.json({ ok: true, pdfPath, mdPath, logs });
  } catch (err) {
    out('❌ Errore durante la rigenerazione');
    out(String(err && err.message ? err.message : err));
    return res.status(500).json({ ok: false, message: String(err && err.message ? err.message : err), logs });
  } finally {
    if (customLogoPath) {
      await safeUnlink(customLogoPath);
    }
    if (usedSupabaseFlow) {
      for (const filePath of cleanupFiles) {
        await safeUnlink(filePath);
      }
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
      const prompts = await readPrompts();
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

    let dest = String(req.body?.dest || '').trim();
    if (!dest || /tuo_utente/.test(dest)) { dest = path.join(os.homedir(), 'Recordings'); }
    await ensureDir(dest);
    const destWritable = await ensureWritableDirectory(dest);
    if (!destWritable.ok) {
      const reason = destWritable.error?.message || 'Cartella non scrivibile';
      out(`❌ Cartella non scrivibile: ${reason}`, 'upload', 'failed');
      logStageEvent('upload', 'failed', reason);
      return res.status(400).json({ ok: false, message: `Cartella destinazione non scrivibile: ${reason}`.trim(), logs, stageEvents });
    }

    let workspaceMeta = null;
    let workspaceProject = null;
    if (workspaceId) {
      const workspaces = await readWorkspaces();
      const foundWorkspace = findWorkspaceById(workspaces, workspaceId);
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
          const next = workspaces.map((ws) => (ws.id === updatedWorkspace.id ? updatedWorkspace : ws));
          await writeWorkspaces(next);
          out(
            `📁 Workspace aggiornato con il progetto ${project?.name || workspaceProjectName || workspaceProjectId}`,
            'upload',
            'info'
          );
        }
      }
    }

    const baseName = workspaceMeta
      ? await buildWorkspaceBaseName(workspaceMeta, dest, slug)
      : `${yyyymmddHHMMSS(new Date())}_${slug}`;
    const userId = req.user?.id || 'anonymous';
    const processedBasePath = `processed/${userId}`;
    const mdStoragePath = `${processedBasePath}/${baseName}.md`;
    const pdfStoragePath = `${processedBasePath}/${baseName}.pdf`;

    const mdPath = path.join(dest, `${baseName}.md`);

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
    const pb = await callPublishScript(mdPath, publishEnv);

    if (pb.code !== 0) {
      out(pb.stderr || pb.stdout || 'publish.sh failed', 'publish', 'warning');
      out('Tentativo fallback pandoc…', 'publish', 'info');
    }

    const pdfPath = path.join(dest, `${baseName}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      out('publish.sh non ha generato un PDF, fallback su pandoc…', 'publish', 'info');
      const pandoc = await zsh(
        `cd ${JSON.stringify(dest)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdPath)} || pandoc -o ${JSON.stringify(pdfPath)} ${JSON.stringify(mdPath)}`,
        publishEnv
      );
      if (pandoc.code !== 0 || !fs.existsSync(pdfPath)) {
        out(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
        throw new Error('Generazione PDF fallita');
      }
      out('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
    }

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

    try {
      if (!req.files || !req.files.transcript) {
        logStageEvent('upload', 'failed', 'Nessun file di testo');
        return res.status(400).json({ ok: false, message: 'Nessun file di testo', logs, stageEvents });
      }

      const txtUpload = req.files.transcript[0];
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
        const prompts = await readPrompts();
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
      if (workspaceId) {
        const workspaces = await readWorkspaces();
        const foundWorkspace = findWorkspaceById(workspaces, workspaceId);
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
            const next = workspaces.map((ws) => (ws.id === updatedWorkspace.id ? updatedWorkspace : ws));
            await writeWorkspaces(next);
            out(
              `📁 Workspace aggiornato con il progetto ${project?.name || workspaceProjectName || workspaceProjectId}`,
              'upload',
              'info'
            );
          }
        }
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
        ? await buildWorkspaceBaseName(workspaceMeta, pipelineDir, slug)
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
        const gm = await generateMarkdown(txtLocalPath, mdLocalPath, promptRulePayload);
        if (gm.code !== 0) {
          const reason = gm.stderr || gm.stdout || 'Generazione Markdown fallita';
          out(reason, 'markdown', 'failed');
          throw new Error(`Generazione Markdown fallita: ${reason}`);
        }
        if (!fs.existsSync(mdLocalPath)) {
          throw new Error(`Markdown non trovato: ${mdLocalPath}`);
        }
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

        const pb = await callPublishScript(mdLocalForPublish, publishEnv);

        if (pb.code !== 0) {
          out(pb.stderr || pb.stdout || 'publish.sh failed', 'publish', 'warning');
          out('Tentativo fallback pandoc…', 'publish', 'info');
        }

        if (!fs.existsSync(pdfLocalPath)) {
          const destDir = path.dirname(mdLocalForPublish);
          const pandoc = await zsh(
            `cd ${JSON.stringify(destDir)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdLocalForPublish)} || pandoc -o ${JSON.stringify(pdfLocalPath)} ${JSON.stringify(mdLocalForPublish)}`,
            publishEnv
          );
          if (pandoc.code !== 0 || !fs.existsSync(pdfLocalPath)) {
            out(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
            throw new Error('Generazione PDF fallita');
          }
          out('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
        }

        await uploadFileToBucket(
          SUPABASE_PROCESSED_BUCKET,
          pdfStoragePath,
          await fsp.readFile(pdfLocalPath),
          'application/pdf'
        );
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
    await uploadFileToBucket(bucket, objectPath, nextBuffer, 'text/markdown; charset=utf-8');

    return res.json({ ok: true, path: `${bucket}/${objectPath}`, bytes: nextBuffer.length });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const code = Number(err?.statusCode) || 500;
    return res.status(code).json({ ok: false, message });
  }
});

app.get('/api/file', async (req, res) => {
  try {
    const rawPath = String(req.query?.path || '').trim();
    if (!rawPath) {
      return res.status(400).json({ ok: false, message: 'Param path mancante' });
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

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60);
    if (error || !data?.signedUrl) {
      const message = error?.message || 'Impossibile generare URL firmato';
      return res.status(500).json({ ok: false, message });
    }
    let targetUrl = data.signedUrl;
    if (targetUrl && SUPABASE_URL && !/^https?:\/\//i.test(targetUrl)) {
      try {
        const supabaseOrigin = new URL(SUPABASE_URL);
        const relativePath = targetUrl.startsWith('/') ? targetUrl.slice(1) : targetUrl;
        targetUrl = new URL(relativePath, `${supabaseOrigin.origin}/`).toString();
      } catch (urlError) {
        console.warn('⚠️  Impossibile normalizzare URL firmato Supabase:', urlError?.message || urlError);
      }
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(500).json({ ok: false, message: 'URL firmato Supabase non valido' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, targetUrl);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    return res.status(500).json({ ok: false, message });
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, message: `Endpoint ${req.method} ${req.path} non disponibile sul backend.` });
  }
  return next();
});

app.listen(PORT, () => {
  console.log(`rec2pdf backend in ascolto su http://localhost:${PORT}`);
});
;
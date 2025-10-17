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
const HOST = process.env.HOST || '0.0.0.0';
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
  if (req.path === '/health') {
    return next();
  }
  return authenticateRequest(req, res, next);
});

const DATA_DIR = path.join(os.homedir(), '.rec2pdf');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const PROMPTS_FILE = path.join(DATA_DIR, 'prompts.json');
const PROFILE_LOGO_ROOT = path.join(DATA_DIR, 'logos');
const PROFILE_TEMPLATE_CACHE = path.join(DATA_DIR, 'templates');
const DEFAULT_STATUSES = ['Bozza', 'In lavorazione', 'Da revisionare', 'Completato'];

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) && ms > 0 ? ms : 0));

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

  if (templatePath && templateType === 'html') {
    const templateArg = ` --template ${JSON.stringify(templatePath)}`;
    const cssArg = cssPath ? ` --css ${JSON.stringify(cssPath)}` : '';
    const resourceArg = resourcePath ? ` --resource-path ${JSON.stringify(resourcePath)}` : '';
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
      `pandoc ${mdArg} --from markdown+yaml_metadata_block --to html${templateArg}${cssArg}${resourceArg} --highlight-style=kate --pdf-engine "$html_engine" "\${extra_opts[@]}" -o ${pdfArg};`,
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

const listTemplatesMetadata = async () => {
  try {
    const dirEntries = await fsp.readdir(TEMPLATES_DIR, { withFileTypes: true });
    const templates = [];
    for (const entry of dirEntries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_TEMPLATE_EXTENSIONS.has(ext)) continue;
      try {
        const descriptor = await resolveTemplateDescriptor(entry.name);
        templates.push({
          name: descriptor.name,
          fileName: descriptor.fileName,
          type: descriptor.type,
          hasCss: !!descriptor.cssFileName,
          cssFileName: descriptor.cssFileName,
          description: descriptor.description,
          engine: descriptor.engine,
        });
      } catch (error) {
        if (error instanceof TemplateResolutionError) {
          console.warn(`⚠️  Template ignorato (${entry.name}): ${error.userMessage}`);
        } else {
          console.warn(`⚠️  Template ignorato (${entry.name}):`, error?.message || error);
        }
      }
    }
    templates.sort((a, b) => a.name.localeCompare(b.name));
    return templates;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const buildTemplateEnv = (descriptor) => {
  if (!descriptor || typeof descriptor !== 'object') {
    return null;
  }
  const env = {
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
  return env;
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
  runPandoc = zsh,
}) => {
  if (!mdLocalPath || !pdfLocalPath) {
    throw new Error('Percorsi Markdown o PDF mancanti per la pubblicazione');
  }
  const log = (message, stage = 'publish', status = 'info') => {
    if (typeof logger === 'function') {
      logger(message, stage, status);
    }
  };

  const result = await callPublishFn(mdLocalPath, publishEnv);
  if (result.code !== 0) {
    log(result.stderr || result.stdout || 'publish.sh failed', 'publish', 'warning');
    log('Tentativo fallback pandoc…', 'publish', 'info');
  }

  if (!fs.existsSync(pdfLocalPath)) {
    if (result.code === 0) {
      log('publish.sh non ha generato un PDF, fallback su pandoc…', 'publish', 'info');
    }
    const destDir = path.dirname(mdLocalPath);
    const mdArg = JSON.stringify(mdLocalPath);
    const pdfArg = JSON.stringify(pdfLocalPath);
    const resolvedTemplateInfo = templateInfo || templateInfoFromEnv(publishEnv);
    const fallbackCmdParts = [];
    fallbackCmdParts.push(`cd ${JSON.stringify(destDir)};`);
    fallbackCmdParts.push(
      `command -v pandocPDF >/dev/null && pandocPDF ${mdArg} || ${buildPandocFallback(resolvedTemplateInfo, mdArg, pdfArg)}`
    );
    const pandoc = await runPandoc(fallbackCmdParts.join(' '), publishEnv);
    if (pandoc.code !== 0 || !fs.existsSync(pdfLocalPath)) {
      log(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
      throw new Error('Generazione PDF fallita');
    }
    log('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
  }

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

const sanitizeDestDirInput = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  const raw = value.trim();
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
      return parsed.workspaces.map((workspace) => {
        if (!workspace || typeof workspace !== 'object') {
          return workspace;
        }
        if (Array.isArray(workspace.profiles)) {
          return workspace;
        }
        return { ...workspace, profiles: [] };
      });
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

const resolveDataRelativePath = (candidate, { allowAbsolute = false } = {}) => {
  if (!candidate) return '';
  const raw = String(candidate).trim();
  if (!raw) return '';
  if (path.isAbsolute(raw)) {
    if (!allowAbsolute) {
      return '';
    }
    return raw;
  }
  return raw.replace(/\\+/g, '/');
};

const resolveProfileLogoAbsolutePath = (storedPath) => {
  const rel = resolveDataRelativePath(storedPath, { allowAbsolute: true });
  if (!rel) return '';
  const base = path.isAbsolute(rel) ? rel : path.join(DATA_DIR, rel);
  const normalized = path.normalize(base);
  if (!normalized.startsWith(path.normalize(DATA_DIR + path.sep)) && normalized !== path.normalize(DATA_DIR)) {
    return '';
  }
  return normalized;
};

const storeProfileLogo = async ({ workspaceId, profileId, tmpPath, originalName }) => {
  if (!workspaceId || !profileId || !tmpPath) {
    return null;
  }
  const safeWorkspace = sanitizeSlug(workspaceId, 'workspace');
  const safeProfile = sanitizeSlug(profileId, 'profile');
  const fileLabel = sanitizeStorageFileName(originalName || 'logo.pdf', 'logo.pdf');
  const targetDir = path.join(PROFILE_LOGO_ROOT, safeWorkspace, safeProfile);
  try {
    await fsp.rm(targetDir, { recursive: true, force: true });
  } catch {}
  await fsp.mkdir(targetDir, { recursive: true });
  const destination = path.join(targetDir, fileLabel);
  await fsp.rename(tmpPath, destination);
  const relativePath = path.relative(DATA_DIR, destination).replace(/\\+/g, '/');
  return {
    absolutePath: destination,
    relativePath,
    fileName: fileLabel,
  };
};

const removeStoredProfileLogo = async (storedPath) => {
  const absolutePath = resolveProfileLogoAbsolutePath(storedPath);
  if (!absolutePath) {
    return;
  }
  const targetDir = path.dirname(absolutePath);
  try {
    await fsp.rm(targetDir, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`⚠️  Impossibile rimuovere il logo profilo ${targetDir}: ${error.message || error}`);
    }
  }
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
      const destDirInput = profile.destDir ?? previous.destDir ?? '';
      const destDir = sanitizeDestDirInput(destDirInput) || '';
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
            fileName: sanitizeStorageFileName(profile.pdfLogo.fileName || profile.pdfLogoPath || previous?.pdfLogo?.fileName || 'logo.pdf', 'logo.pdf'),
            originalName: String(profile.pdfLogo.originalName || profile.pdfLogo.fileName || previous?.pdfLogo?.originalName || '').trim(),
            updatedAt: Number.isFinite(profile.pdfLogo.updatedAt)
              ? Number(profile.pdfLogo.updatedAt)
              : Number.isFinite(previous?.pdfLogo?.updatedAt)
                ? Number(previous.pdfLogo.updatedAt)
                : now,
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
        destDir,
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
    if (profile.destDir) {
      try {
        const stats = await fsp.stat(profile.destDir);
        if (!stats.isDirectory()) {
          errors.push(`La cartella di destinazione per il profilo "${label}" non è una directory valida.`);
        } else {
          await fsp.access(profile.destDir, fs.constants.W_OK);
        }
      } catch (error) {
        errors.push(
          `La cartella di destinazione per il profilo "${label}" non è accessibile: ${error?.message || error}`
        );
      }
    }

    if (profile.promptId) {
      const normalizedPromptId = String(profile.promptId).trim();
      if (normalizedPromptId && !promptIds.has(normalizedPromptId)) {
        errors.push(`Il prompt selezionato per il profilo "${label}" non è valido.`);
      }
    }

    if (profile.pdfTemplate) {
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
    destDir:
      typeof body.destDir === 'string'
        ? body.destDir.trim()
        : typeof body.destination === 'string'
          ? body.destination.trim()
          : '',
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
  const logoDownloadPath = profile.pdfLogoPath
    ? `/api/workspaces/${workspaceId}/profiles/${profile.id}/logo`
    : '';
  return {
    ...profile,
    logoDownloadPath,
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
const profileUpload = uploadMiddleware.single('pdfLogo');
const optionalProfileUpload = (req, res, next) => {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    return profileUpload(req, res, next);
  }
  return next();
};

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
      normalized.includes('enotfound')
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
      "Trasforma gli appunti in un documento Markdown professionale. Inserire all'inizio del file un blocco YAML senza righe vuote sopra, evita di inserire all'inizio del file markdownaltri segni,simboli o termini che non siano i 3 trattininella prima riga solo 3 trattini e 3 trattini alla fine del blocco YAML, con i campi nell’ordine seguente: title, author, owner, project_name, project_code, artifact_type, version, identifier, location, summary, usageterms, ssot, status, created, updated, tags, ai.generated, ai.model, ai.prompt_id. Versioni in forma SemVer con underscore (es. v1_0_0). La struttura del documento DEVE includere sezioni con i titoli esatti: 'Executive Summary', 'Punti Chiave', 'Analisi Dettagliata', 'Prossime Azioni'. Inserisci almeno una tabella con un massimo di 4 colonne e una tabella dei 3 principali rischi. NON usare backticks di codice.",
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

const DEFAULT_PROMPTS_BY_ID = new Map(
  DEFAULT_PROMPTS.filter((prompt) => prompt && prompt.id).map((prompt) => [prompt.id, prompt])
);

const DEFAULT_PROMPTS_BY_SLUG = new Map(
  DEFAULT_PROMPTS.filter((prompt) => prompt && prompt.slug).map((prompt) => [prompt.slug, prompt])
);

const bootstrapDefaultPrompts = () => {
  const now = Date.now();
  return DEFAULT_PROMPTS.map((prompt, index) => ({
    ...prompt,
    createdAt: prompt.createdAt || now + index,
    updatedAt: prompt.updatedAt || now + index,
  }));
};

const applyPromptMigrations = (prompts = []) => {
  let changed = false;
  const upgraded = [];
  const existingById = new Map();
  const existingBySlug = new Map();

  for (const prompt of prompts || []) {
    if (!prompt || typeof prompt !== 'object') {
      upgraded.push(prompt);
      continue;
    }

    const defaults = prompt.builtIn
      ? DEFAULT_PROMPTS_BY_ID.get(prompt.id) ||
        (prompt.slug ? DEFAULT_PROMPTS_BY_SLUG.get(prompt.slug) : null)
      : null;

    const next = { ...prompt };

    if (defaults) {
      if (!next.summary && defaults.summary) {
        next.summary = defaults.summary;
        changed = true;
      }

      if (!next.builtIn) {
        next.builtIn = true;
        changed = true;
      }

      if (defaults.pdfRules && typeof defaults.pdfRules === 'object') {
        const currentPdfRules =
          next.pdfRules && typeof next.pdfRules === 'object' ? { ...next.pdfRules } : {};
        let pdfRulesChanged = false;
        for (const [key, value] of Object.entries(defaults.pdfRules)) {
          if (currentPdfRules[key] === undefined) {
            currentPdfRules[key] = value;
            pdfRulesChanged = true;
          }
        }
        if (pdfRulesChanged || (!next.pdfRules && Object.keys(currentPdfRules).length)) {
          next.pdfRules = currentPdfRules;
          changed = true;
        }
      }
    }

    upgraded.push(next);

    if (next && typeof next === 'object') {
      if (next.id) {
        existingById.set(next.id, next);
      }
      if (next.slug) {
        existingBySlug.set(next.slug, next);
      }
    }
  }

  for (const defaults of DEFAULT_PROMPTS) {
    if (!defaults || !defaults.builtIn) {
      continue;
    }
    const alreadyPresent =
      (defaults.id && existingById.get(defaults.id)) ||
      (defaults.slug && existingBySlug.get(defaults.slug));
    if (alreadyPresent) {
      continue;
    }

    const timestamp = Date.now();
    const injected = {
      ...defaults,
      createdAt: defaults.createdAt || timestamp,
      updatedAt: defaults.updatedAt || timestamp,
    };

    upgraded.push(injected);
    if (injected.id) {
      existingById.set(injected.id, injected);
    }
    if (injected.slug) {
      existingBySlug.set(injected.slug, injected);
    }
    changed = true;
  }

  return { prompts: upgraded, changed };
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

  try {
    await fsp.mkdir(PROFILE_LOGO_ROOT, { recursive: true });
  } catch (error) {
    console.warn('Impossibile creare la cartella per i loghi profilo:', error.message || error);
  }

  try {
    await fsp.mkdir(PROFILE_TEMPLATE_CACHE, { recursive: true });
  } catch (error) {
    console.warn('Impossibile creare la cartella template profilo:', error.message || error);
  }
};

const readPrompts = async () => {
  await ensureDataStore();
  try {
    const raw = await fsp.readFile(PROMPTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.prompts)) {
      const { prompts, changed } = applyPromptMigrations(parsed.prompts);
      if (changed) {
        await writePrompts(prompts);
      }
      return prompts;
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
  updated.profiles = Array.isArray(workspace.profiles)
    ? workspace.profiles.map((profile) => ({ ...profile }))
    : [];
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

  if (Array.isArray(patch.profiles)) {
    updated.profiles = normalizeWorkspaceProfiles(patch.profiles, {
      existingProfiles: workspace.profiles || [],
    });
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
    const prompts = await readPrompts();
    const normalizedProfiles = normalizeWorkspaceProfiles(req.body?.profiles);
    const profileErrors = await validateWorkspaceProfiles(normalizedProfiles, { prompts });
    if (profileErrors.length) {
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: profileErrors });
    }
    const workspaceId = generateId('ws');
    const workspace = {
      id: workspaceId,
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
      profiles: normalizedProfiles || [],
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

    const prompts = await readPrompts();
    const merged = mergeWorkspaceUpdate(workspaces[index], req.body || {});
    const profileErrors = await validateWorkspaceProfiles(merged.profiles, { prompts });
    if (profileErrors.length) {
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: profileErrors });
    }
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

const workspaceProfilesRouter = express.Router({ mergeParams: true });

workspaceProfilesRouter.get('/', async (req, res) => {
  try {
    const workspaces = await readWorkspaces();
    const workspace = findWorkspaceById(workspaces, req.params.workspaceId);
    if (!workspace) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
    res.json({ ok: true, profiles: profilesForResponse(workspace.id, workspace.profiles || []) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

workspaceProfilesRouter.post('/', optionalProfileUpload, async (req, res) => {
  let uploadedPath = '';
  try {
    const workspaces = await readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === req.params.workspaceId);
    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }

    const prompts = await readPrompts();
    const workspace = { ...workspaces[index] };
    const payload = extractProfilePayload(req.body);
    const profileId = payload.id || generateId('profile');
    const baseProfiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
    const withoutProfile = baseProfiles.filter((profile) => profile.id !== profileId);

    const candidateProfiles = normalizeWorkspaceProfiles(
      [...withoutProfile, { ...payload, id: profileId }],
      { existingProfiles: baseProfiles }
    );
    const createdIndex = candidateProfiles.findIndex((profile) => profile.id === profileId);
    if (createdIndex === -1) {
      return res.status(400).json({ ok: false, message: 'Impossibile creare il profilo' });
    }
    const createdProfile = { ...candidateProfiles[createdIndex] };

    if (req.file) {
      await ensureTempFileHasExtension(req.file);
      const stored = await storeProfileLogo({
        workspaceId: workspace.id,
        profileId: createdProfile.id,
        tmpPath: req.file.path,
        originalName: req.file.originalname,
      });
      if (stored) {
        uploadedPath = stored.relativePath;
        createdProfile.pdfLogoPath = stored.relativePath;
        createdProfile.pdfLogo = {
          fileName: stored.fileName,
          originalName: req.file.originalname || stored.fileName,
          updatedAt: Date.now(),
        };
      }
    }

    const validationErrors = await validateWorkspaceProfiles([createdProfile], { prompts });
    if (validationErrors.length) {
      if (uploadedPath) {
        await removeStoredProfileLogo(uploadedPath);
      }
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: validationErrors });
    }

    candidateProfiles[createdIndex] = createdProfile;
    const nextWorkspace = {
      ...workspace,
      profiles: candidateProfiles,
      updatedAt: Date.now(),
    };
    workspaces[index] = nextWorkspace;
    await writeWorkspaces(workspaces);

    res.status(201).json({ ok: true, profile: profileForResponse(nextWorkspace.id, createdProfile) });
  } catch (error) {
    if (uploadedPath) {
      await removeStoredProfileLogo(uploadedPath);
    }
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  } finally {
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
  }
});

workspaceProfilesRouter.put('/:profileId', optionalProfileUpload, async (req, res) => {
  let uploadedPath = '';
  try {
    const workspaces = await readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === req.params.workspaceId);
    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }

    const workspace = { ...workspaces[index] };
    const baseProfiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
    const existingIndex = baseProfiles.findIndex((profile) => profile.id === req.params.profileId);
    if (existingIndex === -1) {
      return res.status(404).json({ ok: false, message: 'Profilo non trovato' });
    }

    const prompts = await readPrompts();
    const payload = extractProfilePayload(req.body);
    payload.id = req.params.profileId;

    const withoutProfile = baseProfiles.filter((profile) => profile.id !== req.params.profileId);
    const normalizedProfiles = normalizeWorkspaceProfiles(
      [...withoutProfile, { ...baseProfiles[existingIndex], ...payload }],
      { existingProfiles: baseProfiles }
    );
    const updatedIndex = normalizedProfiles.findIndex((profile) => profile.id === req.params.profileId);
    if (updatedIndex === -1) {
      return res.status(400).json({ ok: false, message: 'Impossibile aggiornare il profilo' });
    }
    const updatedProfile = { ...normalizedProfiles[updatedIndex] };

    if (payload.removePdfLogo && updatedProfile.pdfLogoPath) {
      await removeStoredProfileLogo(updatedProfile.pdfLogoPath);
      updatedProfile.pdfLogoPath = '';
      updatedProfile.pdfLogo = null;
    }

    if (req.file) {
      await ensureTempFileHasExtension(req.file);
      await removeStoredProfileLogo(updatedProfile.pdfLogoPath);
      const stored = await storeProfileLogo({
        workspaceId: workspace.id,
        profileId: updatedProfile.id,
        tmpPath: req.file.path,
        originalName: req.file.originalname,
      });
      if (stored) {
        uploadedPath = stored.relativePath;
        updatedProfile.pdfLogoPath = stored.relativePath;
        updatedProfile.pdfLogo = {
          fileName: stored.fileName,
          originalName: req.file.originalname || stored.fileName,
          updatedAt: Date.now(),
        };
      }
    }

    const validationErrors = await validateWorkspaceProfiles([updatedProfile], { prompts });
    if (validationErrors.length) {
      if (uploadedPath) {
        await removeStoredProfileLogo(uploadedPath);
      }
      return res.status(400).json({ ok: false, message: 'Profilo non valido', details: validationErrors });
    }

    normalizedProfiles[updatedIndex] = updatedProfile;
    const nextWorkspace = {
      ...workspace,
      profiles: normalizedProfiles,
      updatedAt: Date.now(),
    };
    workspaces[index] = nextWorkspace;
    await writeWorkspaces(workspaces);

    res.json({ ok: true, profile: profileForResponse(nextWorkspace.id, updatedProfile) });
  } catch (error) {
    if (uploadedPath) {
      await removeStoredProfileLogo(uploadedPath);
    }
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  } finally {
    if (req.file?.path) {
      await safeUnlink(req.file.path);
    }
  }
});

workspaceProfilesRouter.delete('/:profileId', async (req, res) => {
  try {
    const workspaces = await readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === req.params.workspaceId);
    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
    const workspace = { ...workspaces[index] };
    const baseProfiles = Array.isArray(workspace.profiles) ? workspace.profiles : [];
    const existing = baseProfiles.find((profile) => profile.id === req.params.profileId);
    if (!existing) {
      return res.status(404).json({ ok: false, message: 'Profilo non trovato' });
    }

    if (existing.pdfLogoPath) {
      await removeStoredProfileLogo(existing.pdfLogoPath);
    }

    const nextWorkspace = {
      ...workspace,
      profiles: baseProfiles.filter((profile) => profile.id !== req.params.profileId),
      updatedAt: Date.now(),
    };
    workspaces[index] = nextWorkspace;
    await writeWorkspaces(workspaces);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

workspaceProfilesRouter.get('/:profileId/logo', async (req, res) => {
  try {
    const workspaces = await readWorkspaces();
    const workspace = findWorkspaceById(workspaces, req.params.workspaceId);
    if (!workspace) {
      return res.status(404).json({ ok: false, message: 'Workspace non trovato' });
    }
    const profile = Array.isArray(workspace.profiles)
      ? workspace.profiles.find((item) => item.id === req.params.profileId)
      : null;
    if (!profile || !profile.pdfLogoPath) {
      return res.status(404).json({ ok: false, message: 'Logo non disponibile' });
    }

    const absolutePath = resolveProfileLogoAbsolutePath(profile.pdfLogoPath);
    if (!absolutePath) {
      return res.status(404).json({ ok: false, message: 'Logo non trovato' });
    }
    try {
      await fsp.access(absolutePath, fs.constants.R_OK);
    } catch {
      return res.status(404).json({ ok: false, message: 'Logo non accessibile' });
    }
    res.sendFile(absolutePath);
  } catch (error) {
    res.status(500).json({ ok: false, message: error && error.message ? error.message : String(error) });
  }
});

app.use('/api/workspaces/:workspaceId/profiles', workspaceProfilesRouter);

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
    const defaultDest = DEFAULT_DEST_DIR;
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

  let finalMdPath = '';
  let finalPdfPath = '';

  try {
    if (!req.files || !req.files.audio) {
      logStageEvent('upload', 'failed', 'Nessun file audio');
      return res.status(400).json({ ok: false, message: 'Nessun file audio', logs, stageEvents });
    }

    let slugInput = String(req.body?.slug || '').trim();
    const workspaceId = String(req.body?.workspaceId || '').trim();
    const workspaceProjectId = String(req.body?.workspaceProjectId || '').trim();
    const workspaceProjectName = String(
      req.body?.workspaceProjectName || req.body?.workspaceProject || ''
    ).trim();
    const workspaceStatus = String(req.body?.workspaceStatus || '').trim();
    const workspaceProfileId = String(req.body?.workspaceProfileId || '').trim();
    const workspaceProfileTemplate = String(req.body?.workspaceProfileTemplate || '').trim();
    const workspaceProfileLabel = String(req.body?.workspaceProfileLabel || '').trim();
    const workspaceProfileLogoPath = String(req.body?.workspaceProfileLogoPath || '').trim();
    const workspaceProfileLogoLabel = String(req.body?.workspaceProfileLogoLabel || '').trim();
    const workspaceProfileLogoDownloadUrl = String(
      req.body?.workspaceProfileLogoDownloadUrl || ''
    ).trim();
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

    let promptId = String(req.body?.promptId || '').trim();
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
    let workspaceProfile = null;
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

    if (!workspaceMeta && workspaceProfileId && !workspaceProfile) {
      const workspaces = await readWorkspaces();
      const fallbackWorkspace = workspaces.find((ws) =>
        Array.isArray(ws.profiles) && ws.profiles.some((profile) => profile.id === workspaceProfileId)
      );
      if (fallbackWorkspace) {
        workspaceMeta = fallbackWorkspace;
        workspaceProfile = fallbackWorkspace.profiles.find((profile) => profile.id === workspaceProfileId) || null;
        if (workspaceProfile) {
          out(
            `✨ Profilo applicato da workspace ${fallbackWorkspace.name}: ${workspaceProfile.label || workspaceProfile.id}`,
            'upload',
            'info'
          );
        }
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
          destDir: '',
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

    let destDir = DEFAULT_DEST_DIR;
    let destIsCustom = false;
    try {
      const destSource = req.body?.dest ? req.body.dest : workspaceProfile?.destDir;
      const destConfig = await resolveDestinationDirectory(destSource);
      destDir = destConfig.dir;
      destIsCustom = destConfig.isCustom;
      out(
        destIsCustom
          ? `📁 Cartella destinazione personalizzata: ${destDir}`
          : `📁 Cartella destinazione predefinita: ${destDir}`,
        'upload',
        'info'
      );
    } catch (destError) {
      const reason = destError?.reason || destError?.message || 'Cartella destinazione non scrivibile';
      out(`❌ Cartella destinazione non utilizzabile: ${reason}`, 'upload', 'failed');
      logStageEvent('upload', 'failed', reason);
      return res
        .status(Number(destError?.statusCode) || 400)
        .json({ ok: false, message: `Cartella destinazione non scrivibile: ${reason}`, logs, stageEvents });
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

    const slug = sanitizeSlug(slugInput || 'meeting', 'meeting');

    const baseName = workspaceMeta
      ? await buildWorkspaceBaseName(workspaceMeta, destDir, slug)
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
    let customLogoPath = null;
    if (req.files.pdfLogo) {
      customLogoPath = await ensureTempFileHasExtension(req.files.pdfLogo[0]);
      if (customLogoPath) {
        out(`🎨 Utilizzo logo personalizzato: ${req.files.pdfLogo[0].originalname}`, 'publish', 'info');
      }
    } else if (workspaceProfile?.pdfLogoPath) {
      const profileLogo = resolveProfileLogoAbsolutePath(workspaceProfile.pdfLogoPath);
      if (profileLogo) {
        try {
          await fsp.access(profileLogo, fs.constants.R_OK);
          customLogoPath = profileLogo;
          out(`🎨 Logo da profilo: ${path.basename(profileLogo)}`, 'publish', 'info');
        } catch (logoError) {
          out(`⚠️ Logo profilo non accessibile: ${logoError?.message || logoError}`, 'publish', 'warning');
        }
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

    const profileTemplateCandidate = workspaceProfile?.pdfTemplate || workspaceProfileTemplate || '';
    let profileTemplateDescriptor = null;
    if (profileTemplateCandidate) {
      try {
        profileTemplateDescriptor = await resolveTemplateDescriptor(profileTemplateCandidate);
        out(`📄 Template profilo: ${profileTemplateDescriptor.fileName}`, 'publish', 'info');
        if (profileTemplateDescriptor.cssFileName) {
          out(`🎨 CSS template: ${profileTemplateDescriptor.cssFileName}`, 'publish', 'info');
        }
        if (profileTemplateDescriptor.engine) {
          out(`⚙️ Motore HTML preferito: ${profileTemplateDescriptor.engine}`, 'publish', 'info');
        }
      } catch (templateError) {
        const reason =
          templateError instanceof TemplateResolutionError
            ? templateError.userMessage
            : templateError?.message || templateError;
        out(`⚠️ Template profilo non accessibile: ${reason}`, 'publish', 'warning');
      }
    }

    const publishEnv = buildEnvOptions(
      promptEnv,
      customLogoPath ? { CUSTOM_PDF_LOGO: customLogoPath } : null,
      profileTemplateDescriptor ? buildTemplateEnv(profileTemplateDescriptor) : null
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
        templateInfo: profileTemplateDescriptor,
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
    if (workspaceAssignment && workspaceProfile) {
      workspaceAssignment.profileId = workspaceProfile.id;
      workspaceAssignment.profileLabel = workspaceProfile.label || workspaceProfile.id;
    }
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
  const localPdfPathRaw = typeof req.body?.localPdfPath === 'string' ? req.body.localPdfPath.trim() : '';
  const localMdPathRaw = typeof req.body?.localMdPath === 'string' ? req.body.localMdPath.trim() : '';

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

      await publishWithTemplateFallback({
        mdLocalPath,
        pdfLocalPath,
        publishEnv,
        logger: out,
      });

      await uploadFileToBucket(bucket, pdfObjectPath, await fsp.readFile(pdfLocalPath), 'application/pdf');
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

    await publishWithTemplateFallback({
      mdLocalPath: mdPath,
      pdfLocalPath: pdfPath,
      publishEnv,
      logger: out,
    });

    out(`✅ Fatto! PDF creato: ${pdfPath}`);
    return res.json({ ok: true, pdfPath, mdPath, localPdfPath: pdfPath, localMdPath: mdPath, logs });
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

    let destDir = DEFAULT_DEST_DIR;
    try {
      const destConfig = await resolveDestinationDirectory(req.body?.dest);
      destDir = destConfig.dir;
      out(
        destConfig.isCustom
          ? `📁 Cartella destinazione personalizzata: ${destDir}`
          : `📁 Cartella destinazione predefinita: ${destDir}`,
        'upload',
        'info'
      );
    } catch (destError) {
      const reason = destError?.reason || destError?.message || 'Cartella non scrivibile';
      out(`❌ Cartella non scrivibile: ${reason}`, 'upload', 'failed');
      logStageEvent('upload', 'failed', reason);
      return res
        .status(Number(destError?.statusCode) || 400)
        .json({ ok: false, message: `Cartella destinazione non scrivibile: ${reason}`, logs, stageEvents });
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

      let destDir = DEFAULT_DEST_DIR;
      try {
        const destConfig = await resolveDestinationDirectory(req.body?.dest);
        destDir = destConfig.dir;
        out(
          destConfig.isCustom
            ? `📁 Cartella destinazione personalizzata: ${destDir}`
            : `📁 Cartella destinazione predefinita: ${destDir}`,
          'upload',
          'info'
        );
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
    return res.json({ ok: true, url: targetUrl });
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

const startServer = () => {
  const server = app.listen(PORT, HOST, () => {
    const hostLabel = HOST === '0.0.0.0' ? '0.0.0.0' : HOST;
    console.log(`rec2pdf backend in ascolto su http://${hostLabel}:${PORT}`);
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
};
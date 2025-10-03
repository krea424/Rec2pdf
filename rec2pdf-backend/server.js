const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile, exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 7788;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_DIR = path.join(os.homedir(), '.rec2pdf');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');
const PROMPTS_FILE = path.join(DATA_DIR, 'prompts.json');
const DEFAULT_STATUSES = ['Bozza', 'In lavorazione', 'Da revisionare', 'Completato'];









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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
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
    const hasCallouts = /:::(success|info|warning|note)/i.test(content);

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
      const regex = new RegExp(`^${joined}_v(\\d+)$`);
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
      { key: 'hook', title: 'Hook narrativo', hint: 'Qual è l\'idea centrale che vuoi esplorare?' },
      { key: 'audience', title: 'Audience', hint: 'Descrivi il target ideale e il loro bisogno principale.' },
      { key: 'promise', title: 'Promessa', hint: 'Che trasformazione o beneficio vuoi comunicare?' },
      { key: 'proof', title: 'Proof point', hint: 'Cita esempi, dati o insight a supporto.' },
    ],
    markdownRules: {
      tone: 'Ispirazionale ma concreto, con verbi d\'azione e payoff sintetici.',
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
      'Guida il ragionamento verso un business case strutturato: contesto, opportunità, analisi economica e piano d\'azione.',
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
    const g = await run('bash', ['-lc', 'command -v gemini || true']);
    out(/gemini/.test(g.stdout) ? `✅ gemini: trovato` : '⚠️ gemini non trovato');
  } catch { out('⚠️ gemini non eseguibile'); }

  try {
    const gm = await zsh('typeset -f genMD >/dev/null && echo OK || echo NO');
    out(gm.stdout.includes('OK') ? '✅ genMD: disponibile' : '❌ genMD non definito in ~/.zshrc');
  } catch { out('❌ genMD non disponibile'); }

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

  const ok = logs.some(l=>l.startsWith('✅ ffmpeg')) && logs.some(l=>/whisper: trovato/.test(l));
  res.json({ ok, logs });
});

app.post('/api/rec2pdf', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'pdfLogo', maxCount: 1 }]), async (req, res) =>
{
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

    const userHome = os.homedir();

    let dest = (req.body.dest || '').trim();
    if (!dest || /tuo_utente/.test(dest)) { dest = path.join(userHome, 'Recordings'); }
    await ensureDir(dest);
    const destWritable = await ensureWritableDirectory(dest);
    if (!destWritable.ok) {
      const reason = destWritable.error?.message || 'Permessi insufficienti';
      out(`❌ Cartella non scrivibile: ${reason}`, 'upload', 'failed');
      logStageEvent('upload', 'failed', `Cartella non scrivibile: ${reason}`);
      return res.status(400).json({ ok: false, message: `Cartella destinazione non scrivibile: ${reason}`, logs, stageEvents });
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
    const inPath = req.files.audio[0].path;
    const wavPath = path.join(dest, `${baseName}.wav`);
    out('🚀 Preparazione upload…', 'upload', 'running');
    out(`📦 Upload ricevuto: ${path.basename(req.files.audio[0].originalname || 'audio')}`, 'upload', 'completed');

    out('🎛️ Transcodifica in WAV…', 'transcode', 'running');
    const ff = await run('ffmpeg', ['-y', '-i', inPath, '-ac', '1', '-ar', '16000', wavPath]);
    if (ff.code !== 0) {
      out(ff.stderr || 'ffmpeg failed', 'transcode', 'failed');
      throw new Error('Transcodifica fallita');
    }
    out('✅ Transcodifica completata', 'transcode', 'completed');

    out(`🧩 Esecuzione pipeline: m4a2pdf "${wavPath}" "${dest}"`);

    let txtPath = '';
    out('🎧 Trascrizione con Whisper…', 'transcribe', 'running');
    const w = await run('bash', ['-lc', `whisper ${JSON.stringify(wavPath)} --language it --model medium --output_format txt --output_dir ${JSON.stringify(dest)} --verbose False`]);
    if (w.code !== 0) {
      out(w.stderr || w.stdout || 'whisper failed', 'transcribe', 'failed');
      throw new Error('Trascrizione fallita');
    }

    const prefix = path.join(dest, `${baseName}`);
    const candidates = (await fsp.readdir(dest)).filter(f => f.startsWith(baseName) && f.endsWith('.txt'));
    if (!candidates.length) { throw new Error('Trascrizione .txt non trovata'); }
    txtPath = path.join(dest, candidates[0]);
    out(`✅ Trascrizione completata: ${path.basename(txtPath)}`, 'transcribe', 'completed');

    out('📝 Generazione Markdown con genMD…', 'markdown', 'running');
    const gm = await zsh(
      `cd ${JSON.stringify(dest)}; genMD ${JSON.stringify(txtPath)}`,
      buildEnvOptions(promptEnv)
    );
    if (gm.code !== 0) {
      out(gm.stderr || gm.stdout || 'genMD failed', 'markdown', 'failed');
      throw new Error('genMD fallito');
    }

    const mdFile = path.join(dest, `documento_${baseName}.md`);
    if (!fs.existsSync(mdFile)) { throw new Error(`Markdown non trovato: ${mdFile}`); }
    out(`✅ Markdown generato: ${path.basename(mdFile)}`, 'markdown', 'completed');

    out('📄 Pubblicazione PDF con PPUBR…', 'publish', 'running');
    const customLogoPath = req.files.pdfLogo ? req.files.pdfLogo[0].path : null;
    if (customLogoPath) {
      out(`🎨 Utilizzo logo personalizzato: ${req.files.pdfLogo[0].originalname}`, 'publish', 'info');
    }
    const publishEnv = buildEnvOptions(
      promptEnv,
      customLogoPath ? { CUSTOM_PDF_LOGO: customLogoPath } : null
    );
    const pb = await zsh(
      `cd ${JSON.stringify(dest)}; (command -v PPUBR && PPUBR ${JSON.stringify(mdFile)}) || (command -v ppubr && ppubr ${JSON.stringify(mdFile)})`,
      publishEnv
    );
    if (pb.code !== 0) {
      out(pb.stderr || pb.stdout || 'PPUBR failed', 'publish', 'warning');
      out('Tentativo fallback pandoc…', 'publish', 'info');
    }

    const pdfPath = path.join(dest, `documento_${baseName}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      const pandoc = await zsh(
        `cd ${JSON.stringify(dest)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdFile)} || pandoc -o ${JSON.stringify(pdfPath)} ${JSON.stringify(mdFile)}`,
        publishEnv
      );
      if (pandoc.code !== 0 || !fs.existsSync(pdfPath)) {
        out(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
        throw new Error('Generazione PDF fallita');
      }
      out('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
    }

    out(`✅ Fatto! PDF creato: ${pdfPath}`, 'publish', 'completed');
    out('🎉 Pipeline completata', 'complete', 'completed');
    const structure = await analyzeMarkdownStructure(mdFile, { prompt: selectedPrompt });
    const workspaceAssignment = workspaceAssignmentForResponse(workspaceMeta, workspaceProject, workspaceStatus);
    const promptAssignment = promptAssignmentForResponse(selectedPrompt, {
      focus: promptFocus,
      notes: promptNotes,
      completedCues: promptCuesCompleted,
    });
    return res.json({
      ok: true,
      pdfPath,
      mdPath: mdFile,
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
    try { if (req.files && req.files.audio) await fsp.unlink(req.files.audio[0].path); } catch {}
    try { if (req.files && req.files.pdfLogo) await fsp.unlink(req.files.pdfLogo[0].path); } catch {}
  }
});

app.post('/api/ppubr', async (req, res) => {
  const logs = [];
  const out = (s) => { logs.push(s); };

  try {
    const mdPathRaw = String(req.body?.mdPath || '').trim();
    if (!mdPathRaw) {
      return res.status(400).json({ ok: false, message: 'Percorso Markdown mancante', logs });
    }

    const mdPath = path.resolve(mdPathRaw);
    if (!fs.existsSync(mdPath)) {
      throw new Error(`Markdown non trovato: ${mdPath}`);
    }

    if (!mdPath.toLowerCase().endsWith('.md')) {
      throw new Error('Il file deve essere un Markdown (.md)');
    }

    const dest = path.dirname(mdPath);
    out(`♻️ Rigenerazione PDF con PPUBR da ${mdPath}`);

    const pb = await zsh(
      `cd ${JSON.stringify(dest)}; (command -v PPUBR && PPUBR ${JSON.stringify(mdPath)}) || (command -v ppubr && ppubr ${JSON.stringify(mdPath)})`
    );
    if (pb.code !== 0) {
      out(pb.stderr || pb.stdout || 'PPUBR failed');
    }

    const baseName = path.basename(mdPath, path.extname(mdPath));
    const pdfPath = path.join(dest, `${baseName}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      out('PPUBR non ha generato un PDF, fallback su pandoc…');
      const pandoc = await zsh(
        `cd ${JSON.stringify(dest)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdPath)} || pandoc -o ${JSON.stringify(pdfPath)} ${JSON.stringify(mdPath)}`
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
  }
});

app.post('/api/ppubr-upload', upload.fields([{ name: 'markdown', maxCount: 1 }, { name: 'pdfLogo', maxCount: 1 }]), async (req, res) => {
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
    const mdPath = path.join(dest, `${baseName}.md`);

    await fsp.copyFile(mdUpload.path, mdPath);
    out(`📄 Markdown ricevuto: ${originalName}`, 'upload', 'completed');

    logStageEvent('transcode', 'completed', 'Step transcode non necessario per Markdown.');
    logStageEvent('transcribe', 'completed', 'Trascrizione non necessaria: Markdown fornito.');
    logStageEvent('markdown', 'completed', 'Markdown fornito manualmente.');

    out('📄 Pubblicazione PDF con PPUBR…', 'publish', 'running');

    const customLogoPath = req.files.pdfLogo ? req.files.pdfLogo[0].path : null;
    if (customLogoPath) {
      out(`🎨 Utilizzo logo personalizzato: ${req.files.pdfLogo[0].originalname}`, 'publish', 'info');
    }
    const publishEnv = buildEnvOptions(
      promptEnv,
      customLogoPath ? { CUSTOM_PDF_LOGO: customLogoPath } : null
    );
    const pb = await zsh(
      `cd ${JSON.stringify(dest)}; (command -v PPUBR && PPUBR ${JSON.stringify(mdPath)}) || (command -v ppubr && ppubr ${JSON.stringify(mdPath)})`,
      publishEnv
    );
    if (pb.code !== 0) {
      out(pb.stderr || pb.stdout || 'PPUBR failed', 'publish', 'warning');
      out('Tentativo fallback pandoc…', 'publish', 'info');
    }

    const pdfPath = path.join(dest, `${baseName}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      out('PPUBR non ha generato un PDF, fallback su pandoc…', 'publish', 'info');
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
      pdfPath,
      mdPath,
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
    try { if (req.files && req.files.markdown) await fsp.unlink(req.files.markdown[0].path); } catch {}
    try { if (req.files && req.files.pdfLogo) await fsp.unlink(req.files.pdfLogo[0].path); } catch {}
  }
});

app.get('/api/markdown', async (req, res) => {
  try {
    const rawPath = String(req.query?.path || '').trim();
    if (!rawPath) {
      return res.status(400).json({ ok: false, message: 'Percorso Markdown mancante' });
    }

    const absPath = path.resolve(rawPath);
    if (!absPath.toLowerCase().endsWith('.md')) {
      return res.status(400).json({ ok: false, message: 'Il file deve avere estensione .md' });
    }

    await fsp.access(absPath, fs.constants.R_OK);
    const content = await fsp.readFile(absPath, 'utf8');
    return res.json({ ok: true, path: absPath, content });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const code = err && err.code === 'ENOENT' ? 404 : 500;
    return res.status(code).json({ ok: false, message });
  }
});

app.put('/api/markdown', async (req, res) => {
  try {
    const rawPath = String(req.body?.path || '').trim();
    if (!rawPath) {
      return res.status(400).json({ ok: false, message: 'Percorso Markdown mancante' });
    }

    const content = req.body?.content;
    if (typeof content !== 'string') {
      return res.status(400).json({ ok: false, message: 'Contenuto Markdown non valido' });
    }

    const absPath = path.resolve(rawPath);
    if (!absPath.toLowerCase().endsWith('.md')) {
      return res.status(400).json({ ok: false, message: 'Il file deve avere estensione .md' });
    }

    await fsp.access(absPath, fs.constants.W_OK);

    try {
      const backupName = `${path.basename(absPath)}.${yyyymmddHHMMSS()}.bak`;
      const backupPath = path.join(path.dirname(absPath), backupName);
      await fsp.copyFile(absPath, backupPath);
    } catch (backupError) {
      // Ignore backup errors (e.g. permissions); continue with save.
    }

    await fsp.writeFile(absPath, content, 'utf8');
    const stats = await fsp.stat(absPath);
    return res.json({ ok: true, path: absPath, bytes: stats.size, mtime: stats.mtimeMs });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const code = err && err.code === 'ENOENT' ? 404 : 500;
    return res.status(code).json({ ok: false, message });
  }
});

app.get('/api/file', async (req, res) => {
  const p = req.query.path;
  if (!p) return res.status(400).json({ ok: false, message: 'Param path mancante' });
  const abs = path.resolve(String(p));
  if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, message: 'File non trovato' });
  res.setHeader('Content-Disposition', 'inline');
  return res.sendFile(abs);
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
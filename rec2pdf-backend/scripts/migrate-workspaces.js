#!/usr/bin/env node

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATUS_LIST = ['Bozza', 'In lavorazione', 'Da revisionare', 'Completato'];

loadEnv();

const args = process.argv.slice(2);
const options = parseCliArgs(args);

const DEFAULT_WORKSPACES_PATH = path.join(os.homedir(), '.rec2pdf', 'workspaces.json');
const workspacesPath = options.file ? path.resolve(options.file) : DEFAULT_WORKSPACES_PATH;

(async () => {
  try {
    const payload = await readWorkspacesFile(workspacesPath);
    const datasetUpdated = parseTimestampIso(payload.updatedAt || payload.updated_at);
    const rawWorkspaces = extractWorkspaceArray(payload);

    if (!rawWorkspaces.length) {
      throw new Error('Nessun workspace trovato nel file specificato.');
    }

    const baseDir = path.dirname(workspacesPath);
    const normalized = rawWorkspaces.map((workspace, index) =>
      normalizeWorkspace(workspace, {
        index,
        datasetUpdated,
        baseDir,
      })
    );

    const workspaceRecords = normalized.map((entry) => entry.record);
    const duplicateIssues = detectWorkspaceDuplicates(workspaceRecords);
    if (duplicateIssues.length > 0) {
      duplicateIssues.forEach((issue) => console.error(`❌ ${issue}`));
      throw new Error('Risolvi i duplicati prima di procedere con la migrazione.');
    }

    const profileDuplicateIssues = detectProfileDuplicates(normalized);
    if (profileDuplicateIssues.length > 0) {
      profileDuplicateIssues.forEach((issue) => console.error(`❌ ${issue}`));
      throw new Error('Risolvi i duplicati tra i profili prima di procedere con la migrazione.');
    }

    const attachmentManifest = buildAttachmentManifest(normalized);

    console.log(`Trovati ${normalized.length} workspace in ${workspacesPath}`);

    if (options.dryRun) {
      console.log('Esecuzione in modalità dry-run: nessun dato verrà inviato a Supabase.');
      previewWorkspaces(normalized);
      if (attachmentManifest.length) {
        console.log('\nLoghi da caricare manualmente:');
        attachmentManifest.forEach((item) => {
          console.log(
            `• [${item.type}] ${item.workspaceSlug}${item.profileSlug ? `/${item.profileSlug}` : ''} -> ${item.localPath}`
          );
        });
      }
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

    const migrated = await migrateToSupabase(supabase, normalized);

    console.log(`\nMigrazione completata. Workspace creati/aggiornati: ${migrated.workspaces}`);
    console.log(`Profili creati/aggiornati: ${migrated.profiles}`);

    if (attachmentManifest.length) {
      const manifestPath = path.resolve(process.cwd(), `workspace-logo-manifest-${Date.now()}.json`);
      await fsp.writeFile(manifestPath, JSON.stringify(attachmentManifest, null, 2), 'utf8');
      console.log('\n⚠️  Alcuni workspace o profili utilizzano loghi locali.');
      console.log(`   Percorsi salvati in: ${manifestPath}`);
      console.log('   Carica i file nel bucket Supabase (es. logos/) e aggiorna logo_path/pdf_logo_url di conseguenza.');
    }
  } catch (error) {
    console.error(error?.message || error);
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

async function readWorkspacesFile(filePath) {
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

function extractWorkspaceArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.workspaces)) return payload.workspaces;
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.workspaces && typeof payload.workspaces === 'object') {
    return Object.values(payload.workspaces);
  }
  if (payload.items && typeof payload.items === 'object') {
    return Object.values(payload.items);
  }
  return [];
}

function normalizeWorkspace(workspace, { index, datasetUpdated, baseDir }) {
  const source = workspace && typeof workspace === 'object' ? { ...workspace } : {};
  const metadata = source.metadata && typeof source.metadata === 'object' ? { ...source.metadata } : {};

  const uuid = pickUuid([
    source.supabaseId,
    source.supabase_id,
    source.id,
    metadata.supabaseId,
    metadata.supabase_id,
  ]);
  const legacyId = parseString(source.id || metadata.legacyId || metadata.legacy_id || '');

  const name =
    parseString(source.name) ||
    parseString(metadata.name) ||
    parseString(metadata.client) ||
    parseString(source.client) ||
    `Workspace ${index + 1}`;
  const slug = sanitizeSlug(
    source.slug || metadata.slug || name || legacyId || `workspace_${index + 1}`,
    `workspace_${index + 1}`
  );
  const client =
    parseString(source.client) ||
    parseString(metadata.client) ||
    name;
  const color = normalizeColor(source.color || metadata.color);

  const defaultStatuses = normalizeStatusList(
    source.defaultStatuses || source.default_statuses || metadata.defaultStatuses
  );

  const versioningPolicy = normalizeVersioningPolicy(
    source.versioningPolicy || metadata.versioningPolicy
  );

  const projects = normalizeProjects(source.projects || metadata.projects, {
    fallbackColor: color,
    fallbackStatuses: defaultStatuses,
  });

  const { iso: createdAtIso } = parseTimestampDetailed(source.createdAt || source.created_at);
  const { iso: updatedAtIso } = parseTimestampDetailed(
    source.updatedAt || source.updated_at || datasetUpdated
  );

  const logoCandidate =
    parseString(source.logoPath) ||
    parseString(source.logo_path) ||
    parseString(metadata.logoPath) ||
    '';
  const logoInfo = classifyAssetPath(logoCandidate, { baseDir });

  const metadataPayload = {
    client,
    color,
    versioningPolicy: versioningPolicy || undefined,
  };

  if (legacyId && (!uuid || legacyId !== uuid)) {
    metadataPayload.legacyId = legacyId;
  }
  if (logoInfo.localPath) {
    metadataPayload.logoLocalPath = logoInfo.localPath;
  }

  const record = {
    slug,
    name,
    description: client,
    logo_path: logoInfo.remotePath,
    metadata: cleanMetadata(metadataPayload),
    projects,
    default_statuses: defaultStatuses,
    created_at: createdAtIso || datasetUpdated || new Date().toISOString(),
    updated_at: updatedAtIso || createdAtIso || datasetUpdated || new Date().toISOString(),
  };

  if (uuid) {
    record.id = uuid;
  }

  const profiles = normalizeProfiles(source.profiles, {
    baseDir,
    datasetUpdated: updatedAtIso || createdAtIso || datasetUpdated,
    workspaceSlug: slug,
  });

  return {
    record,
    profiles,
    workspaceSlug: slug,
    workspaceLogo: logoInfo.localPath
      ? { type: 'workspace', localPath: logoInfo.localPath, workspaceSlug: slug }
      : null,
  };
}

function normalizeProfiles(profiles, { baseDir, datasetUpdated, workspaceSlug }) {
  if (!Array.isArray(profiles)) {
    return [];
  }

  return profiles
    .map((profile, index) => {
      if (!profile || typeof profile !== 'object') {
        return null;
      }

      const uuid = pickUuid([profile.supabaseId, profile.supabase_id, profile.id]);
      const label =
        parseString(profile.label) ||
        parseString(profile.name) ||
        parseString(profile.title) ||
        `Profilo ${index + 1}`;
      const slug = sanitizeSlug(
        profile.slug || profile.key || `${workspaceSlug}_profile_${index + 1}`,
        `${workspaceSlug}_profile_${index + 1}`
      );

      const destDirInfo = normalizePath(profile.destDir || profile.dest_dir || profile.destination, {
        baseDir,
      });
      const promptId = parseString(profile.promptId || profile.prompt_id || profile.prompt || '');
      const rawTemplate = parseString(profile.pdfTemplate || profile.template || '');
      const pdfTemplate = rawTemplate ? sanitizeStorageFileName(rawTemplate, 'template.tex') : '';

      const pdfLogoCandidate =
        parseString(profile.pdfLogoPath || profile.pdf_logo_url || (profile.pdfLogo && profile.pdfLogo.path)) || '';
      const logoInfo = classifyAssetPath(pdfLogoCandidate, { baseDir });

      const pdfLogoMetadata = normalizePdfLogo(profile.pdfLogo, { fallbackFileName: `${slug}.png` });
      if (logoInfo.remotePath) {
        pdfLogoMetadata.pdfLogoPath = logoInfo.remotePath;
      }
      if (logoInfo.localPath) {
        pdfLogoMetadata.pdfLogoLocalPath = logoInfo.localPath;
      }

      const { iso: createdAtIso } = parseTimestampDetailed(profile.createdAt || profile.created_at);
      const { iso: updatedAtIso } = parseTimestampDetailed(
        profile.updatedAt || profile.updated_at || datasetUpdated
      );

      const metadataPayload = cleanMetadata({
        pdfLogo: pdfLogoMetadata.pdfLogo || undefined,
        pdfLogoPath: pdfLogoMetadata.pdfLogoPath || undefined,
        pdfLogoLocalPath: pdfLogoMetadata.pdfLogoLocalPath || undefined,
      });

      const record = {
        slug,
        label,
        dest_dir: destDirInfo.path || null,
        prompt_id: promptId || null,
        pdf_template: pdfTemplate || null,
        pdf_logo_url: logoInfo.remotePath || null,
        metadata: metadataPayload,
        created_at: createdAtIso || datasetUpdated || new Date().toISOString(),
        updated_at: updatedAtIso || createdAtIso || datasetUpdated || new Date().toISOString(),
      };

      if (uuid) {
        record.id = uuid;
      }

      return {
        record,
        profileSlug: slug,
        workspaceSlug,
        profileLogo: logoInfo.localPath
          ? { type: 'profile', localPath: logoInfo.localPath, workspaceSlug, profileSlug: slug }
          : null,
      };
    })
    .filter(Boolean);
}

function normalizeProjects(projects, { fallbackColor, fallbackStatuses }) {
  const list = Array.isArray(projects)
    ? projects
    : projects && typeof projects === 'object'
      ? Array.isArray(projects.projects)
        ? projects.projects
        : Object.values(projects)
      : [];

  return list
    .map((project, index) => {
      if (!project || typeof project !== 'object') {
        return null;
      }
      const { iso: createdAtIso } = parseTimestampDetailed(project.createdAt || project.created_at);
      const { iso: updatedAtIso } = parseTimestampDetailed(project.updatedAt || project.updated_at);
      const name =
        parseString(project.name) ||
        parseString(project.label) ||
        parseString(project.title) ||
        `Progetto ${index + 1}`;
      const color = normalizeColor(project.color || fallbackColor);
      const statuses = normalizeStatusList(project.statuses, fallbackStatuses);
      const id =
        parseString(project.id) ||
        parseString(project.slug) ||
        parseString(project.key) ||
        `proj_${index + 1}`;

      const createdAt = createdAtIso ? Date.parse(createdAtIso) : Date.now();
      const updatedAt = updatedAtIso ? Date.parse(updatedAtIso) : createdAt;

      return cleanMetadata({
        id,
        name,
        color,
        statuses,
        createdAt,
        updatedAt,
      });
    })
    .filter(Boolean);
}

function normalizeVersioningPolicy(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const retentionRaw = value.retentionLimit ?? value.retention_limit;
  const freezeRaw = value.freezeOnPublish ?? value.freeze_on_publish;
  const namingRaw = value.namingConvention ?? value.naming_convention;

  const retentionLimit = Number.isFinite(Number(retentionRaw)) && Number(retentionRaw) > 0
    ? Math.round(Number(retentionRaw))
    : null;
  const freezeOnPublish = parseBooleanLike(freezeRaw);
  const namingConvention = parseString(namingRaw);

  if (retentionLimit === null && freezeOnPublish === null && !namingConvention) {
    return null;
  }

  return {
    retentionLimit: retentionLimit ?? 10,
    freezeOnPublish: freezeOnPublish ?? false,
    namingConvention: namingConvention || 'timestamped',
  };
}

function normalizePdfLogo(pdfLogo, { fallbackFileName }) {
  if (!pdfLogo || typeof pdfLogo !== 'object') {
    return { pdfLogo: null };
  }
  const fileName = sanitizeStorageFileName(pdfLogo.fileName || pdfLogo.filename || fallbackFileName, 'logo.pdf');
  const originalName = parseString(pdfLogo.originalName || pdfLogo.name || '') || undefined;
  const updatedAt = Number.isFinite(pdfLogo.updatedAt)
    ? Number(pdfLogo.updatedAt)
    : Number.isFinite(pdfLogo.updated_at)
      ? Number(pdfLogo.updated_at)
      : undefined;

  return {
    pdfLogo: cleanMetadata({ fileName, originalName, updatedAt }),
  };
}

function detectWorkspaceDuplicates(records = []) {
  const issues = [];
  const idMap = new Map();
  const slugMap = new Map();

  records.forEach((record, index) => {
    if (record.id) {
      if (idMap.has(record.id)) {
        issues.push(`Duplicato id tra workspace #${idMap.get(record.id) + 1} e #${index + 1} (${record.id})`);
      } else {
        idMap.set(record.id, index);
      }
    }
    if (record.slug) {
      if (slugMap.has(record.slug)) {
        issues.push(`Duplicato slug tra workspace #${slugMap.get(record.slug) + 1} e #${index + 1} (${record.slug})`);
      } else {
        slugMap.set(record.slug, index);
      }
    }
  });

  return issues;
}

function detectProfileDuplicates(workspaces = []) {
  const issues = [];
  workspaces.forEach((workspace, workspaceIndex) => {
    const slug = workspace.workspaceSlug;
    const idMap = new Map();
    const slugMap = new Map();

    workspace.profiles.forEach((profile, index) => {
      const record = profile.record;
      if (record.id) {
        if (idMap.has(record.id)) {
          issues.push(
            `Duplicato id profilo nel workspace ${slug}: profilo #${idMap.get(record.id) + 1} e #${index + 1} (${record.id})`
          );
        } else {
          idMap.set(record.id, index);
        }
      }
      if (record.slug) {
        if (slugMap.has(record.slug)) {
          issues.push(
            `Duplicato slug profilo nel workspace ${slug}: profilo #${slugMap.get(record.slug) + 1} e #${index + 1} (${record.slug})`
          );
        } else {
          slugMap.set(record.slug, index);
        }
      }
    });
  });
  return issues;
}

function buildAttachmentManifest(workspaces = []) {
  const manifest = [];
  workspaces.forEach((workspace) => {
    if (workspace.workspaceLogo) {
      manifest.push(workspace.workspaceLogo);
    }
    workspace.profiles.forEach((profile) => {
      if (profile.profileLogo) {
        manifest.push(profile.profileLogo);
      }
    });
  });
  return manifest;
}

function previewWorkspaces(entries = []) {
  entries.forEach((entry, index) => {
    const record = entry.record;
    console.log(`\n#${index + 1} Workspace: ${record.name} (${record.slug})`);
    console.log(`   • Color: ${record.metadata?.color || 'n/d'}`);
    console.log(`   • Client: ${record.metadata?.client || record.description}`);
    console.log(`   • Default statuses: ${record.default_statuses.join(', ')}`);
    const projectCount = Array.isArray(record.projects) ? record.projects.length : 0;
    console.log(`   • Projects: ${projectCount}`);
    console.log(`   • Profiles: ${entry.profiles.length}`);
    if (entry.workspaceLogo) {
      console.log(`   • Logo locale: ${entry.workspaceLogo.localPath}`);
    } else if (record.logo_path) {
      console.log(`   • Logo remoto: ${record.logo_path}`);
    }
    entry.profiles.forEach((profile, profileIndex) => {
      const profileRecord = profile.record;
      console.log(`      - Profilo ${profileIndex + 1}: ${profileRecord.metadata?.label || profileRecord.slug}`);
      if (profile.profileLogo) {
        console.log(`        • Logo locale: ${profile.profileLogo.localPath}`);
      } else if (profileRecord.pdf_logo_url) {
        console.log(`        • Logo remoto: ${profileRecord.pdf_logo_url}`);
      }
    });
  });
}

async function migrateToSupabase(supabase, workspaces = []) {
  let workspaceCount = 0;
  let profileCount = 0;

  for (const entry of workspaces) {
    const conflictTarget = entry.record.id ? 'id' : 'slug';
    const payload = { ...entry.record };
    if (!payload.id) {
      delete payload.id;
    }

    const { data: workspaceRow, error: workspaceError } = await supabase
      .from('workspaces')
      .upsert(payload, { onConflict: conflictTarget })
      .select('*')
      .single();
    if (workspaceError) {
      throw new Error(`Errore upsert workspace ${entry.workspaceSlug}: ${workspaceError.message || workspaceError}`);
    }
    workspaceCount += 1;

    const workspaceId = workspaceRow.id;

    for (const profile of entry.profiles) {
      const profilePayload = { ...profile.record, workspace_id: workspaceId };
      const profileConflict = profilePayload.id ? 'id' : 'slug';
      if (!profilePayload.id) {
        delete profilePayload.id;
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: profileConflict })
        .select('*')
        .single();
      if (profileError) {
        throw new Error(
          `Errore upsert profilo ${profile.profileSlug} per workspace ${entry.workspaceSlug}: ${profileError.message || profileError}`
        );
      }
      profileCount += 1;
    }
  }

  return { workspaces: workspaceCount, profiles: profileCount };
}

function pickUuid(values = []) {
  for (const value of values) {
    const uuid = parseUuid(value);
    if (uuid) {
      return uuid;
    }
  }
  return null;
}

function parseString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function normalizeColor(value) {
  if (!value) return '#6366f1';
  const hex = String(value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  return '#6366f1';
}

function normalizeStatusList(value, fallback = DEFAULT_STATUS_LIST) {
  const list = [];
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|,/)
      : [];

  source.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) {
        list.push(trimmed);
      }
      return;
    }
    if (item && typeof item === 'object' && typeof item.label === 'string') {
      const trimmed = item.label.trim();
      if (trimmed) {
        list.push(trimmed);
      }
    }
  });

  if (list.length) {
    return list;
  }
  return Array.isArray(fallback) && fallback.length ? [...fallback] : [...DEFAULT_STATUS_LIST];
}

function parseTimestampIso(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function parseTimestampDetailed(value) {
  const iso = parseTimestampIso(value);
  if (!iso) {
    return { iso: null, ms: null };
  }
  return { iso, ms: Date.parse(iso) };
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
  const base = raw || fallback || 'workspace';
  return base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function sanitizeStorageFileName(value, fallback = 'file') {
  if (!value) {
    return fallback;
  }
  const base = path.basename(String(value));
  const ext = path.extname(base);
  const namePart = base.slice(0, base.length - ext.length);
  const safeName = sanitizeSlug(namePart || fallback, fallback);
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
  return `${safeName}${safeExt}`;
}

function parseBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return null;
}

function normalizePath(value, { baseDir } = {}) {
  const raw = parseString(value);
  if (!raw) {
    return { input: '', path: '' };
  }
  let candidate = raw;
  if (candidate.startsWith('~')) {
    candidate = path.join(os.homedir(), candidate.slice(1));
  }
  if (baseDir && !path.isAbsolute(candidate)) {
    candidate = path.join(baseDir, candidate);
  }
  return { input: raw, path: path.normalize(candidate) };
}

function classifyAssetPath(rawValue, { baseDir } = {}) {
  const value = parseString(rawValue);
  if (!value) {
    return { remotePath: null, localPath: null };
  }
  if (/^https?:\/\//i.test(value)) {
    return { remotePath: value, localPath: null };
  }
  if (value.startsWith('logos/')) {
    return { remotePath: value, localPath: null };
  }
  const resolved = normalizePath(value, { baseDir }).path;
  if (fs.existsSync(resolved)) {
    return { remotePath: null, localPath: resolved };
  }
  return { remotePath: value, localPath: null };
}

function cleanMetadata(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const output = {};
  Object.entries(value).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') {
      return;
    }
    output[key] = val;
  });
  return output;
}


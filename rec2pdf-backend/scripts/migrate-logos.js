#!/usr/bin/env node

const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const os = require('os');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const LOGO_BUCKET = 'logos';
const VALID_LOGO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.pdf']);
const LOGO_CONTENT_TYPE_MAP = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'],
]);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOME_LOGO_DIR = path.join(os.homedir(), '.rec2pdf', 'logos');

loadEnv();

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Errore: variabili mancanti (${missingEnv.join(', ')}).`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  if (!existsSync(HOME_LOGO_DIR)) {
    console.log(`Nessun logo locale trovato in ${HOME_LOGO_DIR}.`);
    return;
  }

  const entries = await collectLogoFiles(HOME_LOGO_DIR);
  if (!entries.length) {
    console.log('Nessun file logo trovato da migrare.');
    return;
  }

  console.log(`Trovati ${entries.length} file logo da migrare.`);
  let migrated = 0;
  for (const entry of entries) {
    try {
      const { workspaceId, profileId, fileName, absolutePath } = entry;
      const profile = await fetchProfile(profileId, workspaceId);
      if (!profile) {
        console.warn(`⚠️  Profilo ${profileId} (workspace ${workspaceId}) non trovato. File ignorato.`);
        continue;
      }

      const uploadResult = await uploadLogo(workspaceId, profileId, fileName, absolutePath);
      await updateProfileRecord(profile, uploadResult);
      migrated += 1;
      console.log(`✅ Profilo ${profileId} aggiornato → ${uploadResult.publicUrl}`);
    } catch (error) {
      const reason = error?.message || String(error);
      console.error(`❌ Impossibile migrare ${entry?.absolutePath || 'file sconosciuto'}: ${reason}`);
    }
  }

  console.log(`Migrazione completata: ${migrated}/${entries.length} loghi aggiornati.`);
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

async function collectLogoFiles(baseDir) {
  const results = [];
  async function walk(currentDir) {
    const dirents = await fs.readdir(currentDir, { withFileTypes: true });
    for (const dirent of dirents) {
      const absolutePath = path.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!dirent.isFile()) {
        continue;
      }
      const relativePath = path.relative(baseDir, absolutePath);
      const segments = relativePath.split(path.sep).filter(Boolean);
      if (segments.length < 3) {
        console.warn(`⚠️  Struttura non riconosciuta per ${relativePath}, atteso logos/<workspaceId>/<profileId>/file`);
        continue;
      }
      const [workspaceId, profileId, ...rest] = segments;
      const fileName = rest.join('/');
      const ext = path.extname(fileName).toLowerCase();
      if (!VALID_LOGO_EXTENSIONS.has(ext)) {
        console.warn(`⚠️  Estensione non supportata per ${relativePath}, file ignorato.`);
        continue;
      }
      results.push({ workspaceId, profileId, fileName, absolutePath });
    }
  }
  await walk(baseDir);
  return results;
}

async function fetchProfile(profileId, workspaceId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, workspace_id, metadata, pdf_logo_url')
    .eq('id', profileId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  return data || null;
}

async function uploadLogo(workspaceId, profileId, fileName, absolutePath) {
  const buffer = await fs.readFile(absolutePath);
  const sanitizedWorkspace = sanitizeSlug(workspaceId || 'workspace', 'workspace');
  const sanitizedProfile = sanitizeSlug(profileId || 'profile', 'profile');
  const sanitizedFileName = sanitizeStorageFileName(fileName || 'logo.pdf', 'logo.pdf');
  const stamp = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const objectPath = `${sanitizedWorkspace}/${sanitizedProfile}/${stamp}_${sanitizedFileName}`;
  const contentType = guessContentType(fileName);

  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(objectPath, buffer, {
    cacheControl: '86400',
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload fallito: ${error.message}`);
  }

  return {
    storagePath: objectPath,
    publicUrl: buildPublicUrl(objectPath),
    fileName: sanitizedFileName,
    originalName: path.basename(fileName || sanitizedFileName),
  };
}

async function updateProfileRecord(profile, uploadResult) {
  const metadata = profile.metadata && typeof profile.metadata === 'object' ? { ...profile.metadata } : {};
  const previousPdfLogo = metadata.pdfLogo && typeof metadata.pdfLogo === 'object' ? { ...metadata.pdfLogo } : {};
  const originalName = previousPdfLogo.originalName || uploadResult.originalName || uploadResult.fileName;

  metadata.pdfLogo = {
    ...previousPdfLogo,
    fileName: uploadResult.fileName,
    originalName,
    storagePath: uploadResult.storagePath,
    updatedAt: Date.now(),
  };
  metadata.pdfLogoPath = uploadResult.publicUrl;

  const { error } = await supabase
    .from('profiles')
    .update({ pdf_logo_url: uploadResult.publicUrl, metadata })
    .eq('id', profile.id)
    .eq('workspace_id', profile.workspace_id);
  if (error) {
    throw new Error(`Aggiornamento profilo fallito: ${error.message}`);
  }
}

function sanitizeSlug(value, fallback = 'value') {
  const raw = String(value || '').trim();
  const safe = raw || fallback;
  return safe
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function sanitizeStorageFileName(value, fallback = 'file') {
  const base = path.basename(String(value || fallback));
  const ext = path.extname(base);
  const namePart = base.slice(0, base.length - ext.length);
  const safeName = sanitizeSlug(namePart || fallback, fallback);
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
  return `${safeName}${safeExt}`;
}

function guessContentType(fileName) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  return LOGO_CONTENT_TYPE_MAP.get(ext) || 'application/octet-stream';
}

function buildPublicUrl(objectPath) {
  const origin = new URL(process.env.SUPABASE_URL);
  return new URL(`/storage/v1/object/public/${LOGO_BUCKET}/${objectPath}`, origin).toString();
}

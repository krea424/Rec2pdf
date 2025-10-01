const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile, exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 7788;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const UP_BASE = path.join(os.tmpdir(), 'rec2pdf_uploads');
if (!fs.existsSync(UP_BASE)) fs.mkdirSync(UP_BASE, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UP_BASE),
  filename: (req, file, cb) => cb(null, `upload_${Date.now()}_${(file.originalname||'file').replace(/[^a-zA-Z0-9._-]/g,'_')}`)
});
const upload = multer({ storage, limits: { fileSize: 1024*1024*1024 } });

const run = (cmd, args = [], opts = {}) => new Promise((resolve) => {
  execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024, ...opts }, (error, stdout, stderr) => {
    resolve({
      code: error ? (error.code ?? 1) : 0,
      stdout: stdout?.toString?.() || '',
      stderr: stderr?.toString?.() || '',
      error,
    });
  });
});

const zsh = (snippet, opts = {}) => new Promise((resolve) => {
  const shellCmd = `source ~/.zshrc 2>/dev/null; ${snippet}`;
  exec(`/bin/zsh -lc ${JSON.stringify(shellCmd)}`, { maxBuffer: 20*1024*1024, ...opts }, (error, stdout, stderr) => {
    resolve({ code: error ? (error.code ?? 1) : 0, stdout: stdout?.toString?.() || '', stderr: stderr?.toString?.() || '' });
  });
});

const yyyymmddHHMMSS = (d = new Date()) => {
  const p = (n) => String(n).padStart(2,'0');
  return d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
};

const ensureDir = async (dir) => { await fsp.mkdir(dir, { recursive: true }); return dir; };

const ensureWritableDirectory = async (dir) => {
  try {
    await ensureDir(dir);
    const probeName = `.rec2pdf_write_probe_${process.pid}_${Date.now()}`;
    const probePath = path.join(dir, probeName);
    await fsp.writeFile(probePath, 'ok');
    await fsp.unlink(probePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
};

const commandVersion = async (cmd) => {
  const check = await run(cmd, ['--version']);
  if (check.code === 0) {
    const firstLine = check.stdout.split('\n')[0] || cmd;
    return { ok: true, detail: firstLine };
  }
  return { ok: false, detail: check.stderr || check.stdout || '' };
};

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
    out(ppub.stdout.includes('OK') ? '✅ ppubr/PPUBR: disponibile' : '❌ ppubr/PPUBR non trovato');
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

    const slug = (req.body.slug || 'meeting').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = yyyymmddHHMMSS(new Date());
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

    const inPath = req.files.audio[0].path;
    const baseName = `${ts}_${slug}`;
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
    const w = await run('bash', ['-lc', `whisper ${JSON.stringify(wavPath)} --language it --model small --output_format txt --output_dir ${JSON.stringify(dest)} --verbose False`]);
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
    const gm = await zsh(`cd ${JSON.stringify(dest)}; genMD ${JSON.stringify(txtPath)}`);
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
    const zshOpts = customLogoPath ? { env: { ...process.env, CUSTOM_PDF_LOGO: customLogoPath } } : {};
    const pb = await zsh(`cd ${JSON.stringify(dest)}; (command -v PPUBR && PPUBR ${JSON.stringify(mdFile)}) || (command -v ppubr && ppubr ${JSON.stringify(mdFile)})`, zshOpts);
    if (pb.code !== 0) {
      out(pb.stderr || pb.stdout || 'PPUBR failed', 'publish', 'warning');
      out('Tentativo fallback pandoc…', 'publish', 'info');
    }

    const pdfPath = path.join(dest, `documento_${baseName}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      const pandoc = await zsh(`cd ${JSON.stringify(dest)}; command -v pandocPDF >/dev/null && pandocPDF ${JSON.stringify(mdFile)} || pandoc -o ${JSON.stringify(pdfPath)} ${JSON.stringify(mdFile)}`);
      if (pandoc.code !== 0 || !fs.existsSync(pdfPath)) {
        out(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
        throw new Error('Generazione PDF fallita');
      }
      out('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
    }

    out(`✅ Fatto! PDF creato: ${pdfPath}`, 'publish', 'completed');
    out('🎉 Pipeline completata', 'complete', 'completed');
    return res.json({ ok: true, pdfPath, mdPath: mdFile, logs, stageEvents });
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
    const slug = (slugRaw || path.basename(originalName, path.extname(originalName)) || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = yyyymmddHHMMSS(new Date());

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

    const baseName = `${ts}_${slug}`;
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
    const zshOpts = customLogoPath ? { env: { ...process.env, CUSTOM_PDF_LOGO: customLogoPath } } : {};
    const pb = await zsh(
      `cd ${JSON.stringify(dest)}; (command -v PPUBR && PPUBR ${JSON.stringify(mdPath)}) || (command -v ppubr && ppubr ${JSON.stringify(mdPath)})`,
      zshOpts
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
        zshOpts
      );
      if (pandoc.code !== 0 || !fs.existsSync(pdfPath)) {
        out(pandoc.stderr || pandoc.stdout || 'pandoc failed', 'publish', 'failed');
        throw new Error('Generazione PDF fallita');
      }
      out('✅ PDF creato tramite fallback pandoc', 'publish', 'done');
    }

    out(`✅ Fatto! PDF creato: ${pdfPath}`, 'publish', 'completed');
    out('🎉 Pipeline completata', 'complete', 'completed');

    return res.json({ ok: true, pdfPath, mdPath, logs, stageEvents });
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

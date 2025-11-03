const fsp = require('fs/promises');
const path = require('path');
const supertest = require('supertest');
const tmp = require('tmp');

tmp.setGracefulCleanup();

describe('GET /api/templates', () => {
  let tempDir;
  let app;
  let request;

  beforeAll(async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    tempDir = tmpDir;
    process.env.TEMPLATES_DIR = tmpDir.name;
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    process.env.PORT = '0';
    jest.resetModules();

    const htmlPath = path.join(tmpDir.name, 'verbale_meeting.html');
    const cssPath = path.join(tmpDir.name, 'verbale_meeting.css');
    const jsonPath = path.join(tmpDir.name, 'verbale_meeting.json');
    const defaultTexPath = path.join(tmpDir.name, 'default.tex');
    const coverPath = path.join(tmpDir.name, 'cover.tex');
    const headerPath = path.join(tmpDir.name, 'header_footer.tex');

    await fsp.writeFile(htmlPath, '<!--Template riunione--><html><body></body></html>');
    await fsp.writeFile(cssPath, 'body { font-family: sans-serif; }');
    await fsp.writeFile(
      jsonPath,
      JSON.stringify({ name: 'Verbale Meeting', description: 'Descrizione da JSON', engine: 'weasyprint' })
    );
    await fsp.writeFile(defaultTexPath, '% Default corporate\n\\documentclass{article}');
    await fsp.writeFile(coverPath, '% Cover accessoria');
    await fsp.writeFile(headerPath, '% Header accessorio');

    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterAll(async () => {
    if (tempDir) {
      try {
        tempDir.removeCallback();
      } catch (error) {
        // ignore cleanup errors
      }
    }
    delete process.env.TEMPLATES_DIR;
  });

  it('returns template metadata with css and descriptions', async () => {
    const res = await request.get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.templates)).toBe(true);
    const templates = res.body.templates;
    const fallbackTemplate = templates.find((tpl) => tpl.fileName === 'pandoc_fallback');
    const defaultTemplate = templates.find((tpl) => tpl.fileName === 'default.tex');
    const htmlTemplate = templates.find((tpl) => tpl.fileName === 'verbale_meeting.html');

    expect(defaultTemplate).toBeDefined();
    expect(defaultTemplate).toMatchObject({
      name: '1_Default.tex',
      type: 'tex',
      hasCss: false,
    });

    expect(fallbackTemplate).toEqual({
      name: '2_semplice',
      fileName: 'pandoc_fallback',
      type: 'pandoc',
      hasCss: false,
      cssFileName: '',
      description: 'Impaginazione base generata con il template predefinito di Pandoc.',
      engine: '',
    });

    expect(htmlTemplate).toBeDefined();
    expect(htmlTemplate).toMatchObject({
      name: '3_verbale_meeting',
      type: 'html',
      hasCss: true,
      cssFileName: 'verbale_meeting.css',
      description: 'Descrizione da JSON',
      engine: 'weasyprint',
    });
    expect(templates.some((tpl) => tpl.fileName === 'cover.tex')).toBe(false);
    expect(templates.some((tpl) => tpl.fileName === 'header_footer.tex')).toBe(false);
  });
});

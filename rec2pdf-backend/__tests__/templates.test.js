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

    const htmlPath = path.join(tmpDir.name, 'verbale.html');
    const cssPath = path.join(tmpDir.name, 'verbale.css');
    const jsonPath = path.join(tmpDir.name, 'verbale.json');
    const texPath = path.join(tmpDir.name, 'meeting.tex');

    await fsp.writeFile(htmlPath, '<!--Template riunione--><html><body></body></html>');
    await fsp.writeFile(cssPath, 'body { font-family: sans-serif; }');
    await fsp.writeFile(
      jsonPath,
      JSON.stringify({ name: 'Verbale Meeting', description: 'Descrizione da JSON', engine: 'weasyprint' })
    );
    await fsp.writeFile(texPath, '% Verbale in LaTeX\n\\documentclass{article}');

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
    const htmlTemplate = templates.find((tpl) => tpl.fileName === 'verbale.html');
    const texTemplate = templates.find((tpl) => tpl.fileName === 'meeting.tex');

    expect(htmlTemplate).toBeDefined();
    expect(htmlTemplate).toMatchObject({
      name: 'Verbale Meeting',
      type: 'html',
      hasCss: true,
      cssFileName: 'verbale.css',
      description: 'Descrizione da JSON',
      engine: 'weasyprint',
    });

    expect(texTemplate).toBeDefined();
    expect(texTemplate.type).toBe('tex');
    expect(texTemplate.description).toBe('Verbale in LaTeX');
  });
});

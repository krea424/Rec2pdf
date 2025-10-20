const fs = require('fs');
const os = require('os');
const path = require('path');
const supertest = require('supertest');
const tmp = require('tmp');

tmp.setGracefulCleanup();

describe('GET /api/prompts meeting prompt', () => {
  let tempHome;
  let originalHome;
  let app;
  let request;
  let homedirSpy;

  beforeAll(async () => {
    tempHome = tmp.dirSync({ unsafeCleanup: true });
    originalHome = process.env.HOME;
    process.env.HOME = tempHome.name;
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');
    jest.resetModules();
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(tempHome.name);

    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterAll(() => {
    if (typeof originalHome === 'string') {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    delete process.env.TEMPLATES_DIR;
    if (homedirSpy) {
      homedirSpy.mockRestore();
      homedirSpy = null;
    }
    if (tempHome) {
      try {
        tempHome.removeCallback();
      } catch {
        // ignore cleanup
      }
    }
  });

  it('includes prompt_meeting_minutes with template metadata', async () => {
    const res = await request.get('/api/prompts');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.prompts)).toBe(true);
    const prompt = res.body.prompts.find((item) => item.id === 'prompt_meeting_minutes');
    expect(prompt).toBeDefined();
    expect(prompt.slug).toBe('verbale_meeting');
    expect(prompt.builtIn).toBe(true);
    expect(prompt.pdfRules).toMatchObject({ layout: 'verbale_meeting' });
    expect(prompt.pdfRules.template).toMatch(/verbale_meeting\.html$/);
    expect(prompt.description).toEqual(expect.stringContaining('action_items'));
    expect(prompt.description).toEqual(expect.stringContaining('key_points'));
    expect(prompt.description).toEqual(expect.stringContaining('transcript'));
  });

  it('backfills missing built-in prompts into prompts.json', async () => {
    const dataDir = path.join(tempHome.name, '.rec2pdf');
    const promptsFile = path.join(dataDir, 'prompts.json');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      promptsFile,
      JSON.stringify(
        {
          prompts: [
            {
              id: 'prompt_brief_creativo',
              slug: 'brief_creativo',
              title: 'Brief creativo',
              builtIn: true,
            },
          ],
          updatedAt: Date.now(),
        },
        null,
        2,
      ),
      'utf8',
    );

    const res = await request.get('/api/prompts');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const ids = res.body.prompts.map((item) => item.id);
    expect(ids).toContain('prompt_meeting_minutes');

    const persisted = JSON.parse(fs.readFileSync(promptsFile, 'utf8'));
    expect(Array.isArray(persisted.prompts)).toBe(true);
    expect(persisted.prompts.some((item) => item.id === 'prompt_meeting_minutes')).toBe(true);
  });
});

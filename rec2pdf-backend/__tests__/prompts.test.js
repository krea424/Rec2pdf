const path = require('path');
const supertest = require('supertest');
const tmp = require('tmp');

tmp.setGracefulCleanup();

describe('GET /api/prompts meeting prompt', () => {
  let tempHome;
  let originalHome;
  let app;
  let request;

  beforeAll(async () => {
    tempHome = tmp.dirSync({ unsafeCleanup: true });
    originalHome = process.env.HOME;
    process.env.HOME = tempHome.name;
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');
    jest.resetModules();

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
});

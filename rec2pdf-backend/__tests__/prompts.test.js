const path = require('path');
const supertest = require('supertest');

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

let createClient;

describe('GET /api/prompts without Supabase', () => {
  let app;
  let request;

  beforeAll(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');
    jest.resetModules();
    ({ createClient } = require('@supabase/supabase-js'));
    createClient.mockReset();

    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterAll(() => {
    delete process.env.PORT;
    delete process.env.TEMPLATES_DIR;
  });

  it('returns built-in prompt metadata when Supabase is not configured', async () => {
    const res = await request.get('/api/prompts');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.prompts)).toBe(true);
    const prompt = res.body.prompts.find((item) => item.id === 'prompt_meeting_minutes');
    expect(prompt).toBeDefined();
    expect(prompt.slug).toBe('verbale_meeting');
    expect(prompt.builtIn).toBe(true);
    expect(prompt.pdfRules).toMatchObject({ layout: 'verbale_meeting' });
    expect(prompt.focusPrompts).toBeUndefined();
  });
});

describe('GET /api/prompts with Supabase data', () => {
  let app;
  let request;
  let mockOrder;
  let mockSelect;
  let mockFrom;
  let mockAuth;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    process.env.PORT = '0';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');

    const supabaseRow = {
      id: 'f4975f42-6d47-4a9c-a4f1-a1d6b6bf5b1d',
      legacy_id: 'prompt_custom',
      workspace_id: null,
      slug: 'custom_prompt',
      title: 'Custom Prompt',
      summary: 'Synthetic summary',
      description: 'Detailed description for custom prompt',
      persona: 'Consultant',
      color: '#123456',
      tags: ['alpha', 'beta'],
      cue_cards: [
        { key: 'one', title: 'First cue', hint: 'Hint one' },
        { key: 'two', title: 'Second cue', hint: 'Hint two' },
      ],
      markdown_rules: { tone: 'Conversational' },
      pdf_rules: { layout: 'custom', includeCover: false },
      checklist: { sections: ['A', 'B'], focusPrompts: ['Follow-up topic'] },
      built_in: false,
      created_at: '2024-07-28T12:00:00.000Z',
      updated_at: '2024-07-28T12:00:00.000Z',
    };

    const queryResult = Promise.resolve({ data: [supabaseRow], error: null });
    mockOrder = jest.fn(() => queryResult);
    mockSelect = jest.fn(() => ({ order: mockOrder }));
    mockFrom = jest.fn(() => ({ select: mockSelect }));
    mockAuth = {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-123' } }, error: null })),
    };

    jest.resetModules();
    ({ createClient } = require('@supabase/supabase-js'));
    createClient.mockReset();
    createClient.mockReturnValue({ from: mockFrom, auth: mockAuth });

    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterAll(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.PORT;
    delete process.env.TEMPLATES_DIR;
    createClient.mockReset();
  });

  it('maps Supabase rows to camelCase prompt objects', async () => {
    const res = await request.get('/api/prompts').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.prompts)).toBe(true);
    expect(createClient).toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalled();
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true, nullsLast: true });
    expect(mockAuth.getUser).toHaveBeenCalledWith('test-token');

    const [prompt] = res.body.prompts;
    expect(prompt).toMatchObject({
      id: 'prompt_custom',
      legacyId: 'prompt_custom',
      supabaseId: 'f4975f42-6d47-4a9c-a4f1-a1d6b6bf5b1d',
      slug: 'custom_prompt',
      title: 'Custom Prompt',
      builtIn: false,
      tags: ['alpha', 'beta'],
      focusPrompts: ['Follow-up topic'],
    });
    expect(prompt.checklist).toEqual({ sections: ['A', 'B'], focusPrompts: ['Follow-up topic'] });
    expect(prompt.cueCards).toHaveLength(2);
    expect(prompt.markdownRules).toEqual({ tone: 'Conversational' });
    expect(prompt.pdfRules).toEqual({ layout: 'custom', includeCover: false });
  });
});

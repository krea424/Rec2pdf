const path = require('path');

describe('resolvePromptTemplateDescriptor', () => {
  let serverModule;

  beforeAll(() => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');
    jest.resetModules();
    serverModule = require('../server');
  });

  afterAll(() => {
    delete process.env.TEMPLATES_DIR;
  });

  it('resolves explicit template defined in prompt pdfRules', async () => {
    const logs = [];
    const descriptor = await serverModule.resolvePromptTemplateDescriptor(
      { pdfRules: { template: 'verbale_meeting.html' } },
      { logger: (message) => logs.push(message) }
    );

    expect(descriptor).toBeTruthy();
    expect(descriptor.fileName).toBe('verbale_meeting.html');
    expect(logs.some((msg) => String(msg).includes('Template prompt'))).toBe(true);
  });

  it('falls back to layout mapping when template is omitted', async () => {
    const descriptor = await serverModule.resolvePromptTemplateDescriptor(
      { pdfRules: { layout: 'verbale_meeting' } },
      {}
    );

    expect(descriptor).toBeTruthy();
    expect(descriptor.fileName).toBe('verbale_meeting.html');
  });

  it('returns null and logs a warning when the template is not accessible', async () => {
    const logs = [];
    const descriptor = await serverModule.resolvePromptTemplateDescriptor(
      { pdfRules: { template: 'missing_template.html' } },
      { logger: (message) => logs.push(message) }
    );

    expect(descriptor).toBeNull();
    expect(logs.some((msg) => String(msg).includes('Template prompt non accessibile'))).toBe(true);
  });
});

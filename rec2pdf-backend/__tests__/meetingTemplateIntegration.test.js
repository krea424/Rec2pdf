const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const tmp = require('tmp');

tmp.setGracefulCleanup();

describe('publishWithTemplateFallback with meeting template', () => {
  let tempDir;
  let serverModule;

  beforeAll(async () => {
    tempDir = tmp.dirSync({ unsafeCleanup: true });
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    process.env.TEMPLATES_DIR = path.join(__dirname, '..', '..', 'Templates');
    jest.resetModules();
    serverModule = require('../server');
  });

  afterAll(() => {
    if (tempDir) {
      try {
        tempDir.removeCallback();
      } catch {
        // ignore
      }
    }
    delete process.env.TEMPLATES_DIR;
  });

  it('propagates WORKSPACE_PROFILE_TEMPLATE variables and falls back to pandoc', async () => {
    const { resolveTemplateDescriptor, buildTemplateEnv, buildEnvOptions, publishWithTemplateFallback } = serverModule;
    const descriptor = await resolveTemplateDescriptor('verbale_meeting.html');
    const mdLocalPath = path.join(tempDir.name, 'meeting.md');
    const pdfLocalPath = path.join(tempDir.name, 'meeting.pdf');

    const mdContent = `---\ntitle: Verbale Test\npdfRules:\n  layout: verbale_meeting\naction_items: []\nkey_points: []\ntranscript: []\n---\n\n## Riepilogo esecutivo\nContenuto.\n`;
    await fsp.writeFile(mdLocalPath, mdContent, 'utf8');

    const publishEnv = buildEnvOptions(buildTemplateEnv(descriptor));
    const logs = [];

    const callPublishFn = jest.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'script missing' });
    const runPandoc = jest.fn().mockImplementation(async (command, envOptions) => {
      const env = envOptions && envOptions.env ? envOptions.env : envOptions;
      expect(env.WORKSPACE_PROFILE_TEMPLATE).toBe(descriptor.path);
      expect(env.WORKSPACE_PROFILE_TEMPLATE_TYPE).toBe('html');
      expect(env.WORKSPACE_PROFILE_TEMPLATE_CSS).toBe(descriptor.cssPath);
      expect(command).toContain('verbale_meeting.html');
      expect(command).toContain('verbale_meeting.css');
      await fsp.writeFile(pdfLocalPath, '%PDF-1.4');
      return { code: 0, stdout: '', stderr: '' };
    });

    await publishWithTemplateFallback({
      mdLocalPath,
      pdfLocalPath,
      publishEnv,
      templateInfo: descriptor,
      logger: (message) => logs.push(message),
      callPublishFn,
      runPandoc,
    });

    expect(callPublishFn).toHaveBeenCalledTimes(1);
    expect(runPandoc).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(pdfLocalPath)).toBe(true);
    expect(logs.some((msg) => String(msg).includes('Tentativo fallback pandoc'))).toBe(true);
    expect(logs.some((msg) => String(msg).includes('✅ PDF creato tramite fallback pandoc'))).toBe(true);
  });
});

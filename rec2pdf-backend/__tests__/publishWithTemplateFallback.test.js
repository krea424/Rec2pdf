const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const tmp = require('tmp');

tmp.setGracefulCleanup();

describe('publishWithTemplateFallback', () => {
  let tempDir;
  let serverModule;

  beforeAll(async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    tempDir = tmpDir;
    process.env.TEMPLATES_DIR = tmpDir.name;
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    jest.resetModules();

    const templateHtml = path.join(tmpDir.name, 'report.html');
    const templateCss = path.join(tmpDir.name, 'report.css');
    await fsp.writeFile(templateHtml, '<!--Report template--><html><body>{{content}}</body></html>');
    await fsp.writeFile(templateCss, 'body { color: #333; }');

    serverModule = require('../server');
  });

  afterAll(() => {
    if (tempDir) {
      try {
        tempDir.removeCallback();
      } catch {
        // ignore cleanup errors
      }
    }
    delete process.env.TEMPLATES_DIR;
  });

  it('invokes pandoc fallback with css and logs messages', async () => {
    const { publishWithTemplateFallback, buildEnvOptions, buildTemplateEnv, resolveTemplateDescriptor } = serverModule;
    const mdFile = path.join(tempDir.name, 'input.md');
    const pdfFile = path.join(tempDir.name, 'output.pdf');
    await fsp.writeFile(mdFile, '# Titolo');

    const descriptor = await resolveTemplateDescriptor('report.html');
    const publishEnv = buildEnvOptions(buildTemplateEnv(descriptor));
    const logs = [];

    const callPublishFn = jest.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'errore' });
    const runPandoc = jest.fn().mockImplementation(async () => {
      await fsp.writeFile(pdfFile, '%PDF-1.4');
      return { code: 0, stdout: '', stderr: '' };
    });

    await publishWithTemplateFallback({
      mdLocalPath: mdFile,
      pdfLocalPath: pdfFile,
      publishEnv,
      templateInfo: descriptor,
      logger: (message) => logs.push(message),
      callPublishFn,
      runPandoc,
    });

    expect(callPublishFn).toHaveBeenCalledWith(mdFile, publishEnv);
    expect(runPandoc).toHaveBeenCalledTimes(1);
    expect(runPandoc.mock.calls[0][0]).toContain('--css');
    expect(runPandoc.mock.calls[0][0]).toContain('pandoc');
    const envOptions = runPandoc.mock.calls[0][1];
    const envVars = envOptions && typeof envOptions === 'object' && envOptions.env ? envOptions.env : envOptions;
    expect(envVars.WORKSPACE_PROFILE_TEMPLATE_CSS).toBe(descriptor.cssPath);
    expect(envVars.WORKSPACE_PROFILE_TEMPLATE_TYPE).toBe('html');
    expect(logs.some((msg) => msg.includes('Tentativo fallback pandoc'))).toBe(true);
    expect(logs.some((msg) => msg.includes('✅ PDF creato tramite fallback pandoc'))).toBe(true);
    const pdfExists = fs.existsSync(pdfFile);
    expect(pdfExists).toBe(true);
  });
});

const fsp = require('fs/promises');
const path = require('path');
const tmp = require('tmp');

const mockExecFile = jest.fn();

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execFile: (...args) => mockExecFile(...args),
  };
});

tmp.setGracefulCleanup();

describe('generateMarkdown prompt composition', () => {
  let tempDir;
  let originalEnv;
  let generateMarkdown;

  beforeAll(() => {
    tempDir = tmp.dirSync({ unsafeCleanup: true });
    originalEnv = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
      PORT: process.env.PORT,
    };
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    process.env.PORT = '0';
    jest.resetModules();
    ({ generateMarkdown } = require('../server'));
  });

  afterAll(() => {
    if (typeof originalEnv.SUPABASE_URL === 'string') {
      process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
    } else {
      delete process.env.SUPABASE_URL;
    }
    if (typeof originalEnv.SUPABASE_SERVICE_KEY === 'string') {
      process.env.SUPABASE_SERVICE_KEY = originalEnv.SUPABASE_SERVICE_KEY;
    } else {
      delete process.env.SUPABASE_SERVICE_KEY;
    }
    if (typeof originalEnv.PORT === 'string') {
      process.env.PORT = originalEnv.PORT;
    } else {
      delete process.env.PORT;
    }
    if (tempDir) {
      try {
        tempDir.removeCallback();
      } catch {
        // ignore cleanup errors
      }
    }
  });

  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('includes knowledge base context before transcript', async () => {
    const transcriptPath = path.join(tempDir.name, 'input.txt');
    const mdPath = path.join(tempDir.name, 'output.md');
    await fsp.writeFile(transcriptPath, 'Trascrizione di test.', 'utf8');
    const knowledgeContext = 'Dato rilevante 1.\nDato rilevante 2.';
    let capturedPrompt = '';

    mockExecFile.mockImplementation((cmd, args, opts, callback) => {
      const cb = typeof callback === 'function' ? callback : opts;
      if (cmd === 'gemini') {
        capturedPrompt = args[0];
        setImmediate(() => cb(null, '## Output finale', ''));
      } else {
        setImmediate(() => cb(null, '', ''));
      }
      return { on: () => {} };
    });

    const result = await generateMarkdown(transcriptPath, mdPath, null, knowledgeContext);
    expect(result.code).toBe(0);
    const written = await fsp.readFile(mdPath, 'utf8');
    expect(written).toBe('## Output finale');
    expect(capturedPrompt).toContain('INFORMAZIONI AGGIUNTIVE DALLA KNOWLEDGE BASE');
    expect(capturedPrompt).toContain(knowledgeContext);
    const knowledgeIndex = capturedPrompt.indexOf('INFORMAZIONI AGGIUNTIVE DALLA KNOWLEDGE BASE');
    const transcriptIndex = capturedPrompt.indexOf('Ecco la trascrizione da elaborare:');
    expect(knowledgeIndex).toBeGreaterThan(-1);
    expect(transcriptIndex).toBeGreaterThan(-1);
    expect(knowledgeIndex).toBeLessThan(transcriptIndex);
    expect(capturedPrompt).toContain('Trascrizione di test.');
  });

  it('omits knowledge base block when context is empty', async () => {
    const transcriptPath = path.join(tempDir.name, 'empty-context.txt');
    const mdPath = path.join(tempDir.name, 'empty-context.md');
    await fsp.writeFile(transcriptPath, 'Solo trascrizione.', 'utf8');
    let capturedPrompt = '';

    mockExecFile.mockImplementation((cmd, args, opts, callback) => {
      const cb = typeof callback === 'function' ? callback : opts;
      if (cmd === 'gemini') {
        capturedPrompt = args[0];
        setImmediate(() => cb(null, '## Output senza contesto', ''));
      } else {
        setImmediate(() => cb(null, '', ''));
      }
      return { on: () => {} };
    });

    const result = await generateMarkdown(transcriptPath, mdPath, null, '   ');
    expect(result.code).toBe(0);
    expect(capturedPrompt).not.toContain('INFORMAZIONI AGGIUNTIVE DALLA KNOWLEDGE BASE');
    expect(capturedPrompt).toContain('Solo trascrizione.');
  });
});

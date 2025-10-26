const fsp = require('fs/promises');
const path = require('path');
const tmp = require('tmp');

const mockGenerateContent = jest.fn();
const mockGenerateEmbedding = jest.fn();
const mockGetAIService = jest.fn(() => ({
  generateContent: mockGenerateContent,
  generateEmbedding: mockGenerateEmbedding,
}));
const mockResolveAiProvider = jest.fn(() => ({ id: 'gemini', apiKey: 'test-key', model: 'gemini-2.5-flash' }));

jest.mock('../services/aiService', () => ({
  getAIService: (...args) => mockGetAIService(...args),
}));

jest.mock('../services/aiProviders', () => ({
  resolveProvider: (...args) => mockResolveAiProvider(...args),
  sanitizeProviderInput: (value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''),
  listProviders: jest.fn(() => []),
  getDefaultProviderMap: jest.fn(() => ({ text: 'gemini', embedding: 'openai' })),
}));

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
    mockGetAIService.mockReset();
    mockGenerateContent.mockReset();
    mockResolveAiProvider.mockReset();
    mockResolveAiProvider.mockImplementation(() => ({ id: 'gemini', apiKey: 'test-key', model: 'gemini-2.5-flash' }));
  });

  it('includes knowledge base context before transcript', async () => {
    const transcriptPath = path.join(tempDir.name, 'input.txt');
    await fsp.writeFile(transcriptPath, 'Trascrizione di test.', 'utf8');
    const knowledgeContext = 'Dato rilevante 1.\nDato rilevante 2.';
    let capturedPrompt = '';

    mockGetAIService.mockImplementation(() => ({
      generateContent: (prompt) => {
        capturedPrompt = prompt;
        return '## Output finale';
      },
      generateEmbedding: mockGenerateEmbedding,
    }));

    const result = await generateMarkdown(transcriptPath, null, knowledgeContext);
    expect(result).toMatchObject({ content: '## Output finale', modelName: 'gemini-2.5-flash' });
    expect(capturedPrompt).toContain('CONTESTO AGGIUNTIVO DALLA KNOWLEDGE BASE');
    expect(capturedPrompt).toContain(knowledgeContext);
    const knowledgeIndex = capturedPrompt.indexOf('CONTESTO AGGIUNTIVO DALLA KNOWLEDGE BASE');
    const transcriptIndex = capturedPrompt.indexOf('TRASCRIZIONE DA ELABORARE:');
    expect(knowledgeIndex).toBeGreaterThan(-1);
    expect(transcriptIndex).toBeGreaterThan(-1);
    expect(knowledgeIndex).toBeLessThan(transcriptIndex);
    expect(capturedPrompt).toContain('Trascrizione di test.');
  });

  it('omits knowledge base block when context is empty', async () => {
    const transcriptPath = path.join(tempDir.name, 'empty-context.txt');
    await fsp.writeFile(transcriptPath, 'Solo trascrizione.', 'utf8');
    let capturedPrompt = '';

    mockGetAIService.mockImplementation(() => ({
      generateContent: (prompt) => {
        capturedPrompt = prompt;
        return '## Output senza contesto';
      },
      generateEmbedding: mockGenerateEmbedding,
    }));

    const result = await generateMarkdown(transcriptPath, null, '   ');
    expect(result).toMatchObject({ content: '## Output senza contesto' });
    expect(capturedPrompt).not.toContain('INFORMAZIONI AGGIUNTIVE DALLA KNOWLEDGE BASE');
    expect(capturedPrompt).toContain('Solo trascrizione.');
  });

  it('forwards the text provider override to the resolver', async () => {
    const transcriptPath = path.join(tempDir.name, 'override.txt');
    await fsp.writeFile(transcriptPath, 'Override provider test.', 'utf8');

    mockGetAIService.mockImplementation(() => ({
      generateContent: () => '## Output',
      generateEmbedding: mockGenerateEmbedding,
    }));

    mockResolveAiProvider.mockImplementation((type, override) => {
      if (type === 'text' && override === 'openai') {
        return { id: 'openai', apiKey: 'test-openai', model: 'gpt-4o' };
      }
      return { id: 'gemini', apiKey: 'test-key', model: 'gemini-2.5-flash' };
    });

    const result = await generateMarkdown(transcriptPath, null, '', { textProvider: 'openai' });
    expect(result).toMatchObject({ content: '## Output', modelName: 'gpt-4o' });
    expect(mockResolveAiProvider).toHaveBeenCalledWith('text', 'openai');
  });

  it('aggiorna il campo ai.model nel front matter con il modello attivo', async () => {
    const transcriptPath = path.join(tempDir.name, 'frontmatter.txt');
    await fsp.writeFile(transcriptPath, 'Contenuto trascritto.', 'utf8');

    mockResolveAiProvider.mockImplementation(() => ({
      id: 'gemini-pro',
      apiKey: 'test-key',
      model: 'gemini-2.5-pro',
    }));

    mockGetAIService.mockImplementation(() => ({
      generateContent: () =>
        ['---', 'title: Documento di test', 'ai.model: "gpt-4"', 'ai.prompt_id: prompt123', '---', '', '## Corpo'].join('\n'),
      generateEmbedding: mockGenerateEmbedding,
    }));

    const result = await generateMarkdown(transcriptPath, null, '');
    expect(result.content).toContain('ai.model: "gemini-2.5-pro"');
    expect(result.content).toContain('ai.prompt_id: prompt123');
  });

  it('imposta ai.model su gemini-2.5-flash per il provider gemini predefinito', async () => {
    const transcriptPath = path.join(tempDir.name, 'frontmatter-default.txt');
    await fsp.writeFile(transcriptPath, 'Contenuto trascritto.', 'utf8');

    mockResolveAiProvider.mockImplementation(() => ({
      id: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
    }));

    mockGetAIService.mockImplementation(() => ({
      generateContent: () => ['---', 'title: Documento di test', '---', '', '## Corpo'].join('\n'),
      generateEmbedding: mockGenerateEmbedding,
    }));

    const result = await generateMarkdown(transcriptPath, null, '');
    expect(result.content).toContain('ai.model: "gemini-2.5-flash"');
  });
});

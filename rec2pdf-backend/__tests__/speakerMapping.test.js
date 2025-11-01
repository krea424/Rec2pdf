const yaml = require('js-yaml');

describe('applySpeakerMapToContent', () => {
  let serverModule;

  beforeAll(() => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_KEY = '';
    process.env.TEMPLATES_DIR = '';
    jest.resetModules();
    serverModule = require('../server');
  });

  afterAll(() => {
    delete process.env.TEMPLATES_DIR;
  });

  it('aggiorna il front matter YAML e il corpo senza corrompere il layout', () => {
    const { applySpeakerMapToContent } = serverModule;
    const markdown = [
      '---',
      'pdfRules:',
      '  layout: verbale_meeting',
      'transcript:',
      '  - speaker: Speaker 1',
      '    raw_label: SPEAKER_00',
      '    paragraphs:',
      '      - "Benvenuti alla riunione"',
      'metadata:',
      '  transcript:',
      '    - speaker: Speaker 1',
      '      raw_label: SPEAKER_00',
      '      paragraphs:',
      '        - "Benvenuti alla riunione"',
      '---',
      '',
      'Speaker 1: Benvenuti alla riunione',
    ].join('\n');

    const mapped = applySpeakerMapToContent(markdown, { SPEAKER_00: 'Mario Rossi' });

    const frontMatterMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(mapped);
    expect(frontMatterMatch).not.toBeNull();
    const frontMatter = yaml.load(frontMatterMatch[1]);
    expect(frontMatter.transcript[0].speaker).toBe('Mario Rossi');
    expect(frontMatter.metadata.transcript[0].speaker).toBe('Mario Rossi');

    const body = mapped.slice(frontMatterMatch[0].length);
    expect(body).toContain('**Mario Rossi**: Benvenuti alla riunione');
    expect(body).not.toContain('Speaker 1:');
  });
});

const supertest = require('supertest');

const mockGenerateContent = jest.fn();
const mockGetAIService = jest.fn(() => ({
  modelName: 'gemini-2.5-flash',
  generateContent: mockGenerateContent,
}));

jest.mock('../services/aiService', () => ({
  getAIService: (...args) => mockGetAIService(...args),
}));

describe('POST /api/pre-analyze', () => {
  let app;
  let request;
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.PORT = '0';
    process.env.GOOGLE_API_KEY = 'test-key';
    jest.resetModules();
    ({ app } = require('../server'));
    request = supertest(app);
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  beforeEach(() => {
    mockGetAIService.mockClear();
    mockGenerateContent.mockReset();
  });

  it('richiede trascrizione e cueCards validi', async () => {
    const res = await request.post('/api/pre-analyze').send({ cueCards: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, message: 'Campo "transcription" obbligatorio.' });
  });

  it('normalizza le risposte suggerite restituite dal provider AI', async () => {
    mockGenerateContent.mockResolvedValue(
      '\n```json\n{"suggestedAnswers":[" Intro sintetica ",{ "title":"Azioni", "answer":" Pianifica follow-up " }]}\n```\n'
    );

    const payload = {
      transcription: ' Trascrizione della riunione ',
      cueCards: [
        { key: 'intro', title: 'Introduzione', hint: 'Riassumi il kickoff' },
        { key: 'actions', title: 'Azioni chiave' },
      ],
    };

    const res = await request.post('/api/pre-analyze').send(payload);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.suggestedAnswers).toEqual([
      { key: 'intro', title: 'Introduzione', answer: 'Intro sintetica' },
      { key: 'actions', title: 'Azioni chiave', answer: 'Pianifica follow-up' },
    ]);
    expect(mockGetAIService).toHaveBeenCalledWith('gemini', 'test-key', 'gemini-2.5-flash');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});

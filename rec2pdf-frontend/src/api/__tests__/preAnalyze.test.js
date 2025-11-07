import { describe, expect, it, vi } from 'vitest';
import { buildPreAnalyzeRequest, parsePreAnalyzeData, postPreAnalyze } from '../preAnalyze.js';

describe('preAnalyze API helpers', () => {
  it('buildPreAnalyzeRequest normalizes entry payload', () => {
    const entry = {
      mdPath: ' /tmp/session.md ',
      pdfPath: '  ',
      localMdPath: '/tmp/local.md',
      localPdfPath: '',
      title: ' Kickoff session ',
      slug: ' kickoff-session ',
      workspaceId: 'ws-1',
      workspace: {
        id: ' ws-1 ',
        name: ' Workspace ',
        client: ' ACME ',
        status: ' Bozza ',
        projectId: ' proj-42 ',
        projectName: ' Progetto X ',
      },
      prompt: {
        id: 'prompt-1',
        title: ' Meeting recap ',
        persona: ' PM ',
        focus: ' Action items ',
        tags: [' summary ', ''],
      },
      tags: [' recap ', 'voice'],
      timestamp: '2024-07-01T10:00:00Z',
      durationSeconds: 123.4,
      completenessScore: 82.7,
      stageEvents: [{}, {}, {}],
      structure: {
        missingSections: ['  next steps  '],
      },
    };

    const payload = buildPreAnalyzeRequest(entry);

    expect(payload).toMatchObject({
      mdPath: '/tmp/session.md',
      localMdPath: '/tmp/local.md',
      title: 'Kickoff session',
      slug: 'kickoff-session',
      workspaceId: 'ws-1',
      projectId: 'proj-42',
      tags: ['recap', 'voice'],
      timestamp: '2024-07-01T10:00:00Z',
    });

    expect(payload.metadata).toMatchObject({
      workspace: {
        id: 'ws-1',
        name: 'Workspace',
        client: 'ACME',
        status: 'Bozza',
        projectId: 'proj-42',
        projectName: 'Progetto X',
      },
      prompt: {
        id: 'prompt-1',
        title: 'Meeting recap',
        persona: 'PM',
        focus: 'Action items',
        tags: ['summary'],
      },
      durationSeconds: 123.4,
      completenessScore: 82.7,
      stageEvents: 3,
      missingSections: ['next steps'],
    });
  });

  it('parsePreAnalyzeData extracts normalized insights', () => {
    const payload = {
      summary: '  Sintesi riunione ',
      highlights: [
        ' Primo highlight ',
        { id: 'risk-1', title: 'Rischi', detail: 'Budget non confermato', score: 0.42 },
      ],
      sections: [
        {
          id: 'sec-1',
          title: 'Decisioni',
          text: 'Il team approva la roadmap',
          highlights: [{ title: 'Azione', detail: 'Preparare kickoff operativo' }],
        },
      ],
      tokens: '1024',
      metadata: { workspaceId: 'ws-1' },
    };

    const result = parsePreAnalyzeData(payload);

    expect(result.summary).toBe('Sintesi riunione');
    expect(result.tokens).toBe(1024);
    expect(result.metadata).toEqual({ workspaceId: 'ws-1' });
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights[0]).toMatchObject({ detail: 'Primo highlight' });
    expect(result.highlights[1]).toMatchObject({ id: 'risk-1', title: 'Rischi', detail: 'Budget non confermato', score: 0.42 });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({ id: 'sec-1', title: 'Decisioni', text: 'Il team approva la roadmap' });
    expect(result.sections[0].highlights[0]).toMatchObject({ title: 'Azione', detail: 'Preparare kickoff operativo' });
  });

  it('parsePreAnalyzeData gracefully handles invalid payloads', () => {
    const result = parsePreAnalyzeData(null);
    expect(result).toMatchObject({ summary: '', highlights: [], sections: [], tokens: null });
  });

  describe('postPreAnalyze', () => {
    it('invoca il fetcher con il payload serializzato e normalizza la risposta', async () => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          message: 'Suggerimenti pronti',
          summary: '  Sintesi ',
          highlights: [' Primo punto '],
          sections: [{ title: 'Decisioni', text: ' Approva budget ' }],
          tokens: 512,
        },
      });

      const result = await postPreAnalyze({
        backendUrl: 'https://backend.local',
        fetcher,
        payload: { workspaceId: 'ws-1', transcription: 'Test' },
      });

      expect(fetcher).toHaveBeenCalledWith('https://backend.local/api/pre-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'ws-1', transcription: 'Test' }),
      });
      expect(result.ok).toBe(true);
      expect(result.data.summary).toBe('Sintesi');
      expect(result.data.highlights[0]).toMatchObject({ detail: 'Primo punto' });
      expect(result.data.sections[0]).toMatchObject({ title: 'Decisioni', text: 'Approva budget' });
      expect(result.message).toBe('Suggerimenti pronti');
    });

    it('propaga stato e messaggi quando il backend fallisce', async () => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        data: { message: 'Servizio non disponibile' },
      });

      const result = await postPreAnalyze({
        backendUrl: 'http://localhost:7788',
        fetcher,
        payload: { transcription: 'Test', cueCards: [] },
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(503);
      expect(result.message).toBe('Servizio non disponibile');
    });

    it('riporta errori di rete senza marcare il risultato come skipped', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Network down'));

      const result = await postPreAnalyze({
        backendUrl: 'http://localhost:7788',
        fetcher,
        payload: { transcription: 'Test', cueCards: [] },
      });

      expect(result.ok).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.message).toBe('Network down');
    });
  });
});

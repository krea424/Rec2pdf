import { describe, expect, it } from 'vitest';
import { buildPreAnalyzeRequest, parsePreAnalyzeData } from '../preAnalyze.js';

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
});

import { describe, expect, it } from 'vitest';
import { normalizePromptEntry } from '../../src/App.jsx';

describe('prompt_meeting_minutes mapping', () => {
  it('preserves meeting layout metadata and sections', () => {
    const prompt = {
      id: 'prompt_meeting_minutes',
      slug: 'verbale_meeting',
      title: 'Verbale riunione executive',
      description: 'Include action_items, key_points e transcript nel front matter.',
      cueCards: [
        { key: 'context', title: 'Contesto', hint: 'Scenario della riunione' },
        { key: 'decisions', title: 'Decisioni', hint: 'Decisioni prese' },
      ],
      checklist: {
        sections: [
          'Riepilogo esecutivo',
          'Decisioni e approvazioni',
          'Azioni assegnate',
          'Punti chiave',
          'Trascrizione integrale',
        ],
      },
      pdfRules: {
        layout: 'verbale_meeting',
        template: 'verbale_meeting.html',
        includeCover: false,
      },
      tags: ['meeting'],
      builtIn: true,
    };

    const normalized = normalizePromptEntry(prompt);
    expect(normalized.id).toBe('prompt_meeting_minutes');
    expect(normalized.slug).toBe('verbale_meeting');
    expect(normalized.description).toContain('action_items');
    expect(normalized.pdfRules).toMatchObject({ layout: 'verbale_meeting', template: 'verbale_meeting.html' });
    expect(normalized.checklist.sections).toContain('Trascrizione integrale');
    expect(normalized.builtIn).toBe(true);
  });
});

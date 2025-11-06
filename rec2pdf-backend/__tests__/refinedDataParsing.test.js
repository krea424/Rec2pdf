const {
  extractRefinedDataFromBody,
  sanitizeRefinedDataInput,
} = require('../server');

describe('refined data parsing helpers', () => {
  it('parses refinedData JSON string when present', () => {
    const extraction = extractRefinedDataFromBody({
      refinedData: '{"summary":" Sintesi "}',
    });

    expect(extraction).toMatchObject({ found: true });
    const sanitized = sanitizeRefinedDataInput(extraction.value);

    expect(sanitized.ok).toBe(true);
    expect(sanitized.value).toEqual({ summary: 'Sintesi' });
  });

  it('reconstructs nested form-data payload (payload B)', () => {
    const extraction = extractRefinedDataFromBody({
      'refinedData[summary]': 'Sintesi payload B',
      'refinedData[sections][intro][title]': 'Introduzione',
      'refinedData[sections][intro][text]': 'Dettaglio introduttivo',
      'refinedData[highlights][key][title]': 'Punto chiave',
      'refinedData[highlights][key][detail]': 'Informazione cruciale',
      'refinedData[cueCards][first][title]': 'Checklist',
    });

    expect(extraction).toMatchObject({ found: true });
    const sanitized = sanitizeRefinedDataInput(extraction.value);

    expect(sanitized.ok).toBe(true);
    expect(sanitized.value).toMatchObject({
      summary: 'Sintesi payload B',
      sections: [
        expect.objectContaining({ title: 'Introduzione', text: 'Dettaglio introduttivo' }),
      ],
      highlights: [
        expect.objectContaining({ title: 'Punto chiave', detail: 'Informazione cruciale' }),
      ],
      cueCards: [
        expect.objectContaining({ title: 'Checklist' }),
      ],
    });
  });

  it('exposes JSON parse errors as warnings and falls back to summary text', () => {
    const extraction = extractRefinedDataFromBody({ refinedData: '{invalid-json}' });

    expect(extraction).toMatchObject({ found: true });
    expect(extraction.error).toMatch(/JSON non valido/);

    const sanitized = sanitizeRefinedDataInput(extraction.value);
    expect(sanitized.ok).toBe(true);
    expect(sanitized.value).toEqual({ summary: '{invalid-json}' });
  });

  it('returns found=false when no refined data is present', () => {
    const extraction = extractRefinedDataFromBody({ foo: 'bar' });

    expect(extraction).toEqual({ found: false });
  });

  it('sanitizza highlights e metadata annidati quando presenti', () => {
    const sanitized = sanitizeRefinedDataInput({
      summary: '  Visione futura ',
      highlights: [
        { title: '  Rischi ', detail: '  Fornitore in ritardo ' },
        '  ',
      ],
      metadata: {
        owner: '  PM  ',
        empty: '   ',
        nested: { field: ' valore ' },
      },
    });

    expect(sanitized.ok).toBe(true);
    expect(sanitized.value.summary).toBe('Visione futura');
    expect(sanitized.value.highlights).toEqual([
      expect.objectContaining({ title: 'Rischi', detail: 'Fornitore in ritardo' }),
    ]);
    expect(sanitized.value.metadata).toEqual({ owner: 'PM', nested: { field: 'valore' } });
  });
});

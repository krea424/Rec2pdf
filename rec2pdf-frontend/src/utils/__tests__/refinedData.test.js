import { describe, expect, it } from "vitest";
import { normalizeRefinedDataForUpload } from "../refinedData.js";

describe("normalizeRefinedDataForUpload", () => {
  it("returns null payload when input is missing", () => {
    const result = normalizeRefinedDataForUpload(null);

    expect(result).toEqual({ ok: true, value: null });
  });

  it("rejects non object inputs", () => {
    const result = normalizeRefinedDataForUpload("not-an-object");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/oggetto/i);
  });

  it("normalizes summary, sections, highlights and metadata", () => {
    const result = normalizeRefinedDataForUpload({
      summary: "  Sintesi  ",
      highlights: [
        { title: "   Risultato ", detail: "   Dettaglio  ", score: "0.8" },
        null,
      ],
      sections: [
        {
          id: "  s1  ",
          title: "  Titolo  ",
          text: "  Contenuto  ",
          highlights: [" Punto "],
        },
      ],
      metadata: {
        foo: "  bar  ",
        nested: { value: "  10  " },
        empty: "   ",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      summary: "Sintesi",
      highlights: [
        { id: "highlight_0", title: "Risultato", detail: "Dettaglio", score: 0.8 },
      ],
      sections: [
        {
          id: "s1",
          title: "Titolo",
          text: "Contenuto",
          highlights: [{ id: "highlight_0", title: "", detail: "Punto" }],
        },
      ],
      metadata: {
        foo: "bar",
        nested: { value: 10 },
      },
    });
  });

  it("captures segments and cue cards when valid", () => {
    const result = normalizeRefinedDataForUpload({
      segments: [
        { id: "seg", text: " Testo ", start: "1.5", end: 3 },
        " Riga libera ",
      ],
      cueCards: [
        { key: "agenda", title: "  Agenda ", hint: " Spiega ", value: " Voce " },
        " Checklist ",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.value.segments).toEqual([
      { id: "seg", text: "Testo", start: 1.5, end: 3 },
      { id: "segment_1", text: "Riga libera" },
    ]);
    expect(result.value.cueCards).toEqual([
      { key: "agenda", title: "Agenda", hint: "Spiega", value: "Voce" },
      { key: "cue_1", title: "Checklist" },
    ]);
  });

  it("fails when declared segments are empty", () => {
    const result = normalizeRefinedDataForUpload({ segments: [null] });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/segmenti/i);
  });
});

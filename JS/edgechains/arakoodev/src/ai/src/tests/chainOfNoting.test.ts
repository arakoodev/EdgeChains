import { describe, expect, it } from "bun:test";
import {
  ChainOfNoting,
  DocumentChunk,
  DocumentNote,
} from "../lib/chainOfNoting/index.js";

describe("ChainOfNoting", () => {
  it("should initialize with default options", () => {
    const con = new ChainOfNoting();
    expect(con).toBeInstanceOf(ChainOfNoting);
  });

  it("should build structured default prompt containing query and document", () => {
    const prompt = ChainOfNoting.createDefaultPrompt(
      "What is the capital of France?",
      { content: "Paris is the capital of France." },
      0,
    );
    expect(prompt).toContain("What is the capital of France?");
    expect(prompt).toContain("Paris is the capital of France.");
    expect(prompt).toContain("DIRECTLY_RELEVANT");
    expect(prompt).toContain("Document [0]");
  });

  it("should parse JSON formatted note correctly", () => {
    const rawJson = JSON.stringify({
      relevance: "DIRECTLY_RELEVANT",
      keyPoints: ["Paris is the capital city", "Populated by 2M residents"],
      critique: "Direct and factual answer.",
    });

    const note = ChainOfNoting.parseNote(rawJson, 1, "doc-1");
    expect(note.documentIndex).toBe(1);
    expect(note.documentId).toBe("doc-1");
    expect(note.relevance).toBe("DIRECTLY_RELEVANT");
    expect(note.keyPoints.length).toBe(2);
    expect(note.keyPoints[0]).toBe("Paris is the capital city");
    expect(note.critique).toBe("Direct and factual answer.");
  });

  it("should parse labeled markdown note format correctly", () => {
    const rawText = `
RELEVANCE: PARTIALLY_RELEVANT
KEY POINTS:
- Provides historical background on the region
- Mentions geographical coordinates
CRITIQUE: Lacks recent demographic data
`;
    const note = ChainOfNoting.parseNote(rawText, 2);
    expect(note.documentIndex).toBe(2);
    expect(note.relevance).toBe("PARTIALLY_RELEVANT");
    expect(note.keyPoints.length).toBeGreaterThan(0);
    expect(note.keyPoints[0]).toContain("Provides historical background");
    expect(note.critique).toContain("Lacks recent demographic data");
  });

  it("should recognize CONTRADICTORY and IRRELEVANT classifications", () => {
    const contradictoryText =
      "RELEVANCE: CONTRADICTORY\nCritique: Denies historical records";
    const noteContra = ChainOfNoting.parseNote(contradictoryText, 0);
    expect(noteContra.relevance).toBe("CONTRADICTORY");

    const irrelevantText =
      "RELEVANCE: IRRELEVANT\nCritique: Unrelated topic entirely";
    const noteIrrel = ChainOfNoting.parseNote(irrelevantText, 0);
    expect(noteIrrel.relevance).toBe("IRRELEVANT");
  });

  it("should execute heuristic analysis and synthesize answer for relevant passages", async () => {
    const con = new ChainOfNoting();
    const docs = [
      "Photosynthesis is a biological process used by plants to convert light energy into chemical energy.",
      "Quantum computers leverage qubits to perform parallel computations.",
    ];

    const result = await con.run(
      "How do plants use photosynthesis to convert light energy?",
      docs,
    );

    expect(result.query).toBe(
      "How do plants use photosynthesis to convert light energy?",
    );
    expect(result.notes.length).toBe(2);
    expect(result.notes[0].relevance).toBe("DIRECTLY_RELEVANT");
    expect(result.notes[1].relevance).toBe("IRRELEVANT");
    expect(result.hasRelevantNotes).toBe(true);
    expect(result.relevantDocumentIndices).toContain(0);
    expect(result.usedFallback).toBe(false);
    expect(result.answer).toContain("Photosynthesis");
  });

  it("should safely flag fallback when all retrieved documents are irrelevant", async () => {
    const con = new ChainOfNoting({ allowFallbackToParametricKnowledge: true });
    const docs = [
      "The recipe for chocolate chip cookies requires flour, butter, sugar, and chocolate chips.",
      "Basketball rules require five players per team on the court.",
    ];

    const result = await con.run(
      "What is the speed of sound in dry air at 20 degrees Celsius?",
      docs,
    );

    expect(result.hasRelevantNotes).toBe(false);
    expect(result.relevantDocumentIndices.length).toBe(0);
    expect(result.usedFallback).toBe(true);
    expect(result.answer).toContain("do not provide relevant information");
  });

  it("should integrate custom generateNoteFn and synthesizeFn callbacks", async () => {
    const customGenerator = async (
      query: string,
      doc: DocumentChunk,
      idx: number,
    ): Promise<DocumentNote> => ({
      documentIndex: idx,
      documentId: doc.id,
      relevance: "DIRECTLY_RELEVANT",
      keyPoints: [`Custom fact extracted from doc ${idx}`],
      critique: "Validated by custom test evaluator",
      rawNote: "custom",
    });

    const customSynthesizer = async (query: string, notes: DocumentNote[]) => {
      return `Synthesized [${notes.length}] notes for query "${query}"`;
    };

    const con = new ChainOfNoting({
      generateNoteFn: customGenerator,
      synthesizeFn: customSynthesizer,
    });

    const result = await con.run("Test query", ["Doc Alpha", "Doc Beta"]);

    expect(result.notes.length).toBe(2);
    expect(result.notes[0].critique).toBe("Validated by custom test evaluator");
    expect(result.answer).toBe('Synthesized [2] notes for query "Test query"');
    expect(result.usedFallback).toBe(false);
  });
});

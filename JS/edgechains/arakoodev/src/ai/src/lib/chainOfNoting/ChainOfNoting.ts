import {
  ChainOfNotingOptions,
  ChainOfNotingResult,
  DocumentChunk,
  DocumentNote,
  RelevanceCategory,
} from "./types.js";

/**
 * Implementation of Chain of Noting (CoN) for retrieval-augmented generation.
 * Generates sequential reading notes for retrieved documents to evaluate relevance,
 * extract factual anchors, and synthesize robust answers while mitigating hallucinations.
 */
export class ChainOfNoting {
  private options: ChainOfNotingOptions;

  constructor(options: ChainOfNotingOptions = {}) {
    this.options = {
      allowFallbackToParametricKnowledge: true,
      temperature: 0.1,
      ...options,
    };
  }

  /**
   * Formats a prompt instructing an LLM to generate a Chain-of-Noting reading note.
   */
  public static createDefaultPrompt(
    query: string,
    doc: DocumentChunk,
    docIndex: number,
  ): string {
    return `You are a critical reader performing Chain-of-Noting evaluation on retrieved context.
Task: Analyze Document [${docIndex}] with respect to the user query.

User Query: "${query}"

Document [${docIndex}] Content:
"""
${doc.content}
"""

Instructions:
1. Relevance Assessment: Determine if this document is DIRECTLY_RELEVANT, PARTIALLY_RELEVANT, IRRELEVANT, or CONTRADICTORY.
2. Key Points: Extract factual statements directly answering or clarifying parts of the query.
3. Critique: Point out any ambiguities, missing context, or factual conflict with known ground truth.

Respond in JSON format:
{
  "relevance": "DIRECTLY_RELEVANT" | "PARTIALLY_RELEVANT" | "IRRELEVANT" | "CONTRADICTORY",
  "keyPoints": ["point 1", "point 2"],
  "critique": "analysis of accuracy or gaps"
}`;
  }

  /**
   * Parses a raw model response into a typed DocumentNote.
   */
  public static parseNote(
    raw: string,
    docIndex: number,
    docId?: string,
  ): DocumentNote {
    const trimmed = raw.trim();

    // 1. Attempt JSON parsing
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const relevance = ChainOfNoting.normalizeRelevance(parsed.relevance);
        const keyPoints = Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints
              .map((p: unknown) => String(p).trim())
              .filter(Boolean)
          : [];
        const critique =
          typeof parsed.critique === "string" ? parsed.critique.trim() : "";

        return {
          documentIndex: docIndex,
          documentId: docId,
          relevance,
          keyPoints,
          critique,
          rawNote: trimmed,
        };
      } catch {
        // Fall through to text-based extraction if JSON parse fails
      }
    }

    // 2. Structured text / labeled sections extraction
    let relevance: RelevanceCategory = "IRRELEVANT";
    const upper = trimmed.toUpperCase();
    if (
      upper.includes("DIRECTLY_RELEVANT") ||
      upper.includes("DIRECTLY RELEVANT")
    ) {
      relevance = "DIRECTLY_RELEVANT";
    } else if (
      upper.includes("CONTRADICTORY") ||
      upper.includes("CONTRADICTION")
    ) {
      relevance = "CONTRADICTORY";
    } else if (
      upper.includes("PARTIALLY_RELEVANT") ||
      upper.includes("PARTIALLY RELEVANT")
    ) {
      relevance = "PARTIALLY_RELEVANT";
    } else if (upper.includes("IRRELEVANT") || upper.includes("NOT RELEVANT")) {
      relevance = "IRRELEVANT";
    }

    const lines = trimmed.split("\n");
    const keyPoints: string[] = [];
    let inKeyPoints = false;
    let critique = "";

    for (const line of lines) {
      const l = line.trim();
      if (/^(?:key\s*points?|facts?|takeaways?):/i.test(l)) {
        inKeyPoints = true;
        const rest = l.replace(/^(?:key\s*points?|facts?|takeaways?):\s*/i, "");
        if (rest) keyPoints.push(rest);
        continue;
      }
      if (/^(?:critique|analysis|limitations?|notes?):/i.test(l)) {
        inKeyPoints = false;
        critique = l.replace(
          /^(?:critique|analysis|limitations?|notes?):\s*/i,
          "",
        );
        continue;
      }

      if (inKeyPoints) {
        const bullet = l.replace(/^[-*•\d.]+\s*/, "").trim();
        if (bullet) keyPoints.push(bullet);
      } else if (critique && l) {
        critique += " " + l;
      }
    }

    return {
      documentIndex: docIndex,
      documentId: docId,
      relevance,
      keyPoints: keyPoints.length > 0 ? keyPoints : [trimmed],
      critique: critique.trim(),
      rawNote: trimmed,
    };
  }

  private static normalizeRelevance(val: unknown): RelevanceCategory {
    if (typeof val !== "string") return "IRRELEVANT";
    const v = val.trim().toUpperCase();
    if (v === "DIRECTLY_RELEVANT" || v === "DIRECTLY RELEVANT")
      return "DIRECTLY_RELEVANT";
    if (v === "PARTIALLY_RELEVANT" || v === "PARTIALLY RELEVANT")
      return "PARTIALLY_RELEVANT";
    if (v === "CONTRADICTORY") return "CONTRADICTORY";
    return "IRRELEVANT";
  }

  /**
   * Normalizes input list of documents to uniform DocumentChunk objects.
   */
  public normalizeDocuments(
    documents: (string | DocumentChunk)[],
  ): DocumentChunk[] {
    return documents.map((doc, idx) => {
      if (typeof doc === "string") {
        return {
          index: idx,
          id: `doc-${idx}`,
          content: doc,
        };
      }
      return {
        ...doc,
        index: doc.index ?? idx,
        id: doc.id ?? `doc-${idx}`,
      };
    });
  }

  /**
   * Generates sequential reading notes for each retrieved document chunk.
   */
  public async generateNotes(
    query: string,
    documents: (string | DocumentChunk)[],
  ): Promise<DocumentNote[]> {
    const normalized = this.normalizeDocuments(documents);
    const notes: DocumentNote[] = [];

    for (let i = 0; i < normalized.length; i++) {
      const doc = normalized[i];
      if (this.options.generateNoteFn) {
        const res = await this.options.generateNoteFn(query, doc, i);
        if (typeof res === "string") {
          notes.push(ChainOfNoting.parseNote(res, i, doc.id));
        } else {
          notes.push({
            ...res,
            documentIndex: res.documentIndex ?? i,
            documentId: res.documentId ?? doc.id,
          });
        }
      } else {
        // Rule-based heuristic default when no external model function is supplied
        notes.push(this.heuristicNote(query, doc, i));
      }
    }

    return notes;
  }

  /**
   * Fallback heuristic note generator analyzing term overlap and query intent.
   */
  private heuristicNote(
    query: string,
    doc: DocumentChunk,
    docIndex: number,
  ): DocumentNote {
    const queryTerms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const contentLower = doc.content.toLowerCase();
    const matched = queryTerms.filter((term) => contentLower.includes(term));
    const ratio =
      queryTerms.length > 0 ? matched.length / queryTerms.length : 0;

    let relevance: RelevanceCategory = "IRRELEVANT";
    if (ratio >= 0.6) {
      relevance = "DIRECTLY_RELEVANT";
    } else if (ratio >= 0.25) {
      relevance = "PARTIALLY_RELEVANT";
    }

    const sentences = doc.content
      .split(/(?<=[.?!])\s+/)
      .filter((s) => queryTerms.some((t) => s.toLowerCase().includes(t)));

    return {
      documentIndex: docIndex,
      documentId: doc.id,
      relevance,
      keyPoints:
        sentences.length > 0
          ? sentences.slice(0, 3)
          : [doc.content.slice(0, 150)],
      critique:
        relevance === "IRRELEVANT"
          ? "Passage does not contain direct answers to the query terms."
          : `Passage contains ${matched.length}/${queryTerms.length} query anchor terms.`,
      rawNote: `Heuristic note: relevance=${relevance}, matches=${matched.join(", ")}`,
    };
  }

  /**
   * Synthesizes the final answer using the generated reading notes.
   */
  public async synthesizeAnswer(
    query: string,
    notes: DocumentNote[],
    documents: DocumentChunk[],
  ): Promise<{ answer: string; usedFallback: boolean }> {
    if (this.options.synthesizeFn) {
      const answer = await this.options.synthesizeFn(query, notes, documents);
      return { answer, usedFallback: false };
    }

    const relevantNotes = notes.filter(
      (n) =>
        n.relevance === "DIRECTLY_RELEVANT" ||
        n.relevance === "PARTIALLY_RELEVANT",
    );

    if (relevantNotes.length === 0) {
      if (this.options.allowFallbackToParametricKnowledge) {
        return {
          answer: `The retrieved documents do not provide relevant information to answer: "${query}". (Falling back to ungrounded or unknown status).`,
          usedFallback: true,
        };
      }
      return {
        answer: `Insufficient relevant context retrieved to answer the query safely without hallucination.`,
        usedFallback: false,
      };
    }

    const points = relevantNotes.flatMap((n) =>
      n.keyPoints.map((p) => `[Doc ${n.documentIndex}] ${p}`),
    );

    return {
      answer: `Based on reading notes from retrieved context:\n${points.join("\n")}`,
      usedFallback: false,
    };
  }

  /**
   * Executes the end-to-end Chain of Noting pipeline.
   */
  public async run(
    query: string,
    documents: (string | DocumentChunk)[],
  ): Promise<ChainOfNotingResult> {
    const normalized = this.normalizeDocuments(documents);
    const notes = await this.generateNotes(query, normalized);

    const relevantIndices = notes
      .filter(
        (n) =>
          n.relevance === "DIRECTLY_RELEVANT" ||
          n.relevance === "PARTIALLY_RELEVANT",
      )
      .map((n) => n.documentIndex);

    const { answer, usedFallback } = await this.synthesizeAnswer(
      query,
      notes,
      normalized,
    );

    return {
      query,
      notes,
      hasRelevantNotes: relevantIndices.length > 0,
      relevantDocumentIndices: relevantIndices,
      answer,
      usedFallback,
    };
  }
}

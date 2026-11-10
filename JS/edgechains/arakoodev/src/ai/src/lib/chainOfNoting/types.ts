/**
 * Types and interfaces for Chain of Noting (CoN)
 * Based on "Chain-of-Noting: Enhancing Robustness in Retrieval-Augmented Language Models" (arXiv:2311.10369)
 */

export type RelevanceCategory =
  "DIRECTLY_RELEVANT" | "PARTIALLY_RELEVANT" | "IRRELEVANT" | "CONTRADICTORY";

export interface DocumentChunk {
  id?: string;
  index?: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentNote {
  documentIndex: number;
  documentId?: string;
  relevance: RelevanceCategory;
  keyPoints: string[];
  critique: string;
  rawNote: string;
}

export interface ChainOfNotingOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  allowFallbackToParametricKnowledge?: boolean;
  generateNoteFn?: (
    query: string,
    doc: DocumentChunk,
    docIndex: number,
  ) => Promise<DocumentNote | string>;
  synthesizeFn?: (
    query: string,
    notes: DocumentNote[],
    originalDocs: DocumentChunk[],
  ) => Promise<string>;
}

export interface ChainOfNotingResult {
  query: string;
  notes: DocumentNote[];
  hasRelevantNotes: boolean;
  relevantDocumentIndices: number[];
  answer: string;
  usedFallback: boolean;
}

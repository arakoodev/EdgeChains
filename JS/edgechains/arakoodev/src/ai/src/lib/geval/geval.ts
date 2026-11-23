import axios from "axios";
import { ChatModel, role } from "../../types/index";

/**
 * GevalEvaluator
 *
 * Implements the G-Eval (https://arxiv.org/abs/2303.16634,
 * https://github.com/nlpyang/geval) "LLM-as-a-judge" approach for measuring
 * the effectiveness of a generated response against a rubric.
 *
 * The evaluator builds a chain-of-thought style evaluation prompt, sends it to
 * an OpenAI-compatible chat model, and parses the numeric score (1-5) together
 * with the reasoning the judge produced.
 *
 * The four default aspects mirror the G-Eval paper:
 *   - coherence
 *   - consistency
 *   - fluency
 *   - relevance
 */

const openAI_url = "https://api.openai.com/v1/chat/completions";

/** The rubric aspects supported out of the box by G-Eval. */
export type GevalAspect = "coherence" | "consistency" | "fluency" | "relevance";

/** Human readable descriptions of each default aspect. */
export const GEVAL_ASPECT_DEFINITIONS: Record<GevalAspect, string> = {
    coherence:
        "the collective quality of all sentences. We align this dimension with the DUC " +
        "quality question of how well the response is structured and organized.",
    consistency:
        "the factual alignment of the response against the given source information. " +
        "A factually consistent response contains only statements that are entailed by the source.",
    fluency:
        "the quality of the response in terms of grammar, spelling, punctuation, word " +
        "choice and sentence structure. A fluent response is free of errors.",
    relevance:
        "the selection of important content from the source. We align this dimension with " +
        "the DUC quality question of how well the response captures the key information.",
};

export interface GevalEvaluatorOptions {
    apiKey?: string;
    orgId?: string;
    model?: ChatModel;
    /** Judge model temperature. G-Eval uses a low temperature for reproducibility. */
    temperature?: number;
    /** Maximum tokens for the judge completion. */
    max_tokens?: number;
}

export interface GevalScoreInput {
    /** The user prompt / question that produced the response. */
    prompt: string;
    /** The model-generated response being evaluated. */
    response: string;
    /** Optional source/context the response should be grounded in. */
    context?: string;
    /** Which aspect to score. Defaults to "coherence". */
    aspect?: GevalAspect;
    /** Optional custom aspect definition (overrides the built-in one). */
    customAspectDefinition?: string;
}

export interface GevalScoreResult {
    aspect: GevalAspect;
    /** Numeric score on the 1-5 G-Eval scale. */
    score: number;
    /** The judge's chain-of-thought reasoning. */
    reasoning: string;
    /** The raw text returned by the judge model. */
    raw: string;
}

interface messageOption {
    role: role;
    content: string;
}

/**
 * Build the G-Eval evaluation prompt for a given aspect.
 *
 * This follows the "Formulate Evaluation Steps" + "Generate with CoT" recipe
 * from the G-Eval paper: the judge is asked to first write down evaluation
 * steps, then produce a score and a justification.
 */
export function buildGevalPrompt(input: GevalScoreInput): string {
    const aspect = input.aspect || "coherence";
    const definition = input.customAspectDefinition || GEVAL_ASPECT_DEFINITIONS[aspect];

    const contextBlock = input.context
        ? `Source Information:\n${input.context}\n\n`
        : "";

    return [
        "You are an impartial judge evaluating the quality of an AI-generated response.",
        "",
        "Evaluation Aspect:",
        `${aspect}: ${definition}`,
        "",
        "Evaluation Steps:",
        `1. Read the user prompt, the source information (if any) and the response carefully.`,
        `2. Compare the response against the "${aspect}" criteria described above.`,
        `3. Write a short justification explaining how well the response satisfies the "${aspect}" criteria.`,
        `4. Assign a score from 1 to 5, where 1 = very poor and 5 = excellent.`,
        "",
        "Respond STRICTLY in the following format:",
        "Justification: <one or two sentences>",
        "Score: <integer between 1 and 5>",
        "",
        contextBlock + "User Prompt:",
        input.prompt,
        "",
        "Response to evaluate:",
        input.response,
        "",
        "Now produce the Justification and Score.",
    ].join("\n");
}

/**
 * Parse the judge output into a structured result.
 *
 * Accepts both the canonical "Justification: ... Score: N" format and a few
 * common variations (e.g. "Score: 4/5", markdown bold, leading/trailing text).
 */
export function parseGevalResponse(
    raw: string,
    aspect: GevalAspect = "coherence"
): GevalScoreResult {
    const text = (raw || "").trim();

    // Extract the score: look for "Score" followed by a number 1-5.
    const scoreMatch =
        text.match(/score\s*[:=]?\s*\**\s*([1-5])(?:\s*\/\s*5)?/i) ||
        text.match(/\b([1-5])\s*\/\s*5\b/) ||
        text.match(/^\s*\**\s*([1-5])\s*\**\s*$/m);

    let score: number;
    if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
    } else {
        // Fallback: last standalone 1-5 digit in the text.
        const fallback = text.match(/\b([1-5])\b/g);
        score = fallback ? parseInt(fallback[fallback.length - 1], 10) : 0;
    }

    // Extract the justification/reasoning.
    let reasoning = "";
    const justMatch = text.match(/justification\s*[:=]?\s*([\s\S]*?)(?:\n\s*score|\n\s*$|$)/i);
    if (justMatch) {
        reasoning = justMatch[1].trim();
    } else {
        // Otherwise use everything before the score line.
        reasoning = text
            .replace(/score\s*[:=]?\s*\**\s*[1-5](?:\s*\/\s*5)?/i, "")
            .replace(/justification\s*[:=]?/i, "")
            .trim();
    }

    return { aspect, score, reasoning, raw: text };
}

export class GevalEvaluator {
    apiKey: string;
    orgId: string;
    model: ChatModel;
    temperature: number;
    max_tokens: number;

    constructor(options: GevalEvaluatorOptions = {}) {
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
        this.orgId = options.orgId || process.env.OPENAI_ORG_ID || "";
        this.model = options.model || "gpt-3.5-turbo";
        this.temperature = options.temperature ?? 0;
        this.max_tokens = options.max_tokens || 512;
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid OpenAI API key. " +
                    "You can add it in .env file as OPENAI_API_KEY"
            );
        }
    }

    /**
     * Score a single response on a single aspect.
     */
    async evaluate(input: GevalScoreInput): Promise<GevalScoreResult> {
        const prompt = buildGevalPrompt(input);
        const messages: messageOption[] = [{ role: "user", content: prompt }];

        const response = await axios
            .post(
                openAI_url,
                {
                    model: this.model,
                    messages,
                    max_tokens: this.max_tokens,
                    temperature: this.temperature,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                        "OpenAI-Organization": this.orgId,
                    },
                }
            )
            .then((res) => res.data.choices)
            .catch((error) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error.request);
                } else {
                    console.log("Error creating request:", error.message);
                }
                throw error;
            });

        const content: string = response?.[0]?.message?.content ?? "";
        return parseGevalResponse(content, input.aspect || "coherence");
    }

    /**
     * Score a response across multiple aspects and return the average.
     * This mirrors G-Eval's practice of aggregating over the rubric.
     */
    async evaluateAll(
        input: Omit<GevalScoreInput, "aspect">,
        aspects: GevalAspect[] = ["coherence", "consistency", "fluency", "relevance"]
    ): Promise<{ results: GevalScoreResult[]; average: number }> {
        const results: GevalScoreResult[] = [];
        for (const aspect of aspects) {
            const result = await this.evaluate({ ...input, aspect });
            results.push(result);
        }
        const scored = results.filter((r) => r.score > 0);
        const average = scored.length
            ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length
            : 0;
        return { results, average };
    }
}
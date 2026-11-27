import { OpenAI } from "../openai/openai.js";
import { ChatModel, role } from "../../types/index.js";

/**
 * ErrorCorrectionChain
 *
 * Implements the error-correction loop described in
 * "LLMs Cannot Find Reasoning Errors, But Can Correct Them"
 * (https://arxiv.org/abs/2311.08516).
 *
 * The paper's key finding is that, although large language models are poor at
 * *locating* the exact step where a reasoning chain goes wrong, they are
 * remarkably good at *correcting* an answer once they are asked to critique and
 * revise it. This chain turns that insight into a reusable building block:
 *
 *   1. GENERATE  – produce an initial answer to a problem (or accept a
 *                  candidate answer supplied by the caller).
 *   2. VERIFY    – ask the model to critique its own answer, list any mistakes
 *                  and rate how confident it is that the answer is correct.
 *   3. CORRECT   – feed the critique back into the model to produce a revised,
 *                  corrected answer.
 *
 * The verify/correct cycle repeats until the model reports that the answer is
 * correct, until `maxIterations` is reached, or until two consecutive
 * iterations stop changing the answer (a fixed point).
 *
 * The class mirrors the provider pattern used by `OpenAI` so it can be dropped
 * into the existing EdgeChains provider ecosystem.
 */

export interface ErrorCorrectionOptions {
    /** Optional pre-built OpenAI client. If omitted one is created from `apiKey`. */
    openaiClient?: OpenAI;
    /** OpenAI API key (falls back to the OPENAI_API_KEY env var). */
    apiKey?: string;
    /** OpenAI org id (falls back to the OPENAI_ORG_ID env var). */
    orgId?: string;
    /** Model used for every step of the loop. */
    model?: ChatModel;
    /** Maximum number of verify→correct iterations. Defaults to 3. */
    maxIterations?: number;
    /** Sampling temperature for the generate/correct steps. Defaults to 0.2. */
    temperature?: number;
    /** Max tokens per completion. Defaults to 1024. */
    maxTokens?: number;
}

export interface ErrorCorrectionRequest {
    /** The problem / question to be solved. */
    problem: string;
    /**
     * Optional candidate answer. When omitted the chain generates the first
     * answer itself (the GENERATE step).
     */
    candidateAnswer?: string;
    /** Optional extra context or rubric injected into every prompt. */
    context?: string;
    /** Override the configured maxIterations for this run. */
    maxIterations?: number;
}

export interface VerificationResult {
    /** The critique produced by the model. */
    critique: string;
    /** Whether the model believes the answer is correct. */
    isCorrect: boolean;
    /** Raw confidence / correctness verdict text returned by the model. */
    verdict: string;
}

export interface CorrectionIteration {
    /** 1-based iteration index. */
    iteration: number;
    /** The answer that was critiqued during this iteration. */
    answerBefore: string;
    /** The critique produced by the verify step. */
    critique: string;
    /** Whether the verify step judged the answer correct. */
    isCorrect: boolean;
    /** The answer after the correct step (=== answerBefore when isCorrect). */
    answerAfter: string;
}

export interface ErrorCorrectionResult {
    /** The final (corrected) answer. */
    answer: string;
    /** The initial answer before any correction. */
    initialAnswer: string;
    /** Whether the loop terminated because the answer was judged correct. */
    isCorrect: boolean;
    /** Number of verify→correct iterations that were executed. */
    iterations: number;
    /** Per-iteration trace for inspection / debugging. */
    history: CorrectionIteration[];
}

const VERDICT_CORRECT = "CORRECT";
const VERDICT_INCORRECT = "INCORRECT";

export class ErrorCorrectionChain {
    private openai: OpenAI;
    private model: ChatModel;
    private maxIterations: number;
    private temperature: number;
    private maxTokens: number;

    constructor(options: ErrorCorrectionOptions = {}) {
        this.openai =
            options.openaiClient ||
            new OpenAI({ apiKey: options.apiKey, orgId: options.orgId });
        this.model = options.model || "gpt-3.5-turbo";
        this.maxIterations = options.maxIterations ?? 3;
        this.temperature = options.temperature ?? 0.2;
        this.maxTokens = options.maxTokens ?? 1024;
    }

    /**
     * Run the full generate → verify → correct loop.
     */
    async run(request: ErrorCorrectionRequest): Promise<ErrorCorrectionResult> {
        if (!request.problem || !request.problem.trim()) {
            throw new Error("ErrorCorrectionChain.run: `problem` must be a non-empty string.");
        }

        const maxIterations = request.maxIterations ?? this.maxIterations;

        // 1. GENERATE (or accept the supplied candidate answer).
        let answer =
            request.candidateAnswer && request.candidateAnswer.trim()
                ? request.candidateAnswer.trim()
                : await this.generate(request.problem, request.context);

        const initialAnswer = answer;
        const history: CorrectionIteration[] = [];
        let isCorrect = false;

        // 2 & 3. VERIFY → CORRECT loop.
        for (let i = 1; i <= maxIterations; i++) {
            const answerBefore = answer;
            const verification = await this.verify(request.problem, answer, request.context);

            if (verification.isCorrect) {
                history.push({
                    iteration: i,
                    answerBefore,
                    critique: verification.critique,
                    isCorrect: true,
                    answerAfter: answerBefore,
                });
                isCorrect = true;
                break;
            }

            const corrected = await this.correct(
                request.problem,
                answerBefore,
                verification.critique,
                request.context
            );

            history.push({
                iteration: i,
                answerBefore,
                critique: verification.critique,
                isCorrect: false,
                answerAfter: corrected,
            });

            answer = corrected;

            // Fixed point: the correction did not change the answer. Further
            // iterations are unlikely to help, so stop early.
            if (answer.trim() === answerBefore.trim()) {
                break;
            }
        }

        return {
            answer,
            initialAnswer,
            isCorrect,
            iterations: history.length,
            history,
        };
    }

    /**
     * Produce a corrected answer given the problem, the previous answer and the
     * grader critique. When called with a single {@link ErrorCorrectionRequest}
     * it runs the full loop and resolves to the final answer string.
     */
    async correct(request: ErrorCorrectionRequest): Promise<string>;
    async correct(
        problem: string,
        answer: string,
        critique: string,
        context?: string
    ): Promise<string>;
    async correct(
        arg1: ErrorCorrectionRequest | string,
        arg2?: string,
        arg3?: string,
        arg4?: string
    ): Promise<string> {
        // Overload: correct(request) -> delegates to run() and returns .answer
        if (typeof arg1 === "object") {
            const result = await this.run(arg1);
            return result.answer;
        }

        // Internal: correct(problem, answer, critique, context)
        const problem = arg1 as string;
        const answer = arg2 as string;
        const critique = arg3 as string;
        const context = arg4 as string | undefined;

        const prompt = this.buildCorrectionPrompt(problem, answer, critique, context);
        const response = await this.openai.chat({
            model: this.model,
            role: "user",
            prompt,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
        });
        return response.content.trim();
    }

    /**
     * Ask the model to critique an answer and decide whether it is correct.
     */
    async verifyAnswer(
        problem: string,
        answer: string,
        context?: string
    ): Promise<VerificationResult> {
        return this.verify(problem, answer, context);
    }

    private async verify(
        problem: string,
        answer: string,
        context?: string
    ): Promise<VerificationResult> {
        const prompt = this.buildVerificationPrompt(problem, answer, context);
        const response = await this.openai.chat({
            model: this.model,
            role: "user",
            prompt,
            temperature: 0,
            max_tokens: this.maxTokens,
        });
        return this.parseVerification(response.content);
    }

    private async generate(problem: string, context?: string): Promise<string> {
        const contextBlock = context ? `\n\nAdditional context:\n${context}` : "";
        const prompt = `Solve the following problem. Think step by step and state your final answer clearly.${contextBlock}\n\nProblem:\n${problem}\n\nAnswer:`;
        const response = await this.openai.chat({
            model: this.model,
            role: "user",
            prompt,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
        });
        return response.content.trim();
    }

    private buildVerificationPrompt(
        problem: string,
        answer: string,
        context?: string
    ): string {
        const contextBlock = context ? `\n\nAdditional context:\n${context}` : "";
        return [
            "You are a meticulous grader. You are given a problem and a candidate answer.",
            "Carefully check the candidate answer for any reasoning or factual mistakes.",
            "You do NOT need to pinpoint the exact faulty step — just judge whether the",
            "final answer is correct and, if it is wrong, briefly describe what is wrong",
            "so that it can be fixed.",
            contextBlock,
            "",
            "Problem:",
            problem,
            "",
            "Candidate answer:",
            answer,
            "",
            "Respond in EXACTLY this format:",
            "VERDICT: <CORRECT or INCORRECT>",
            "CRITIQUE: <a short explanation of any mistakes, or why it is correct>",
        ].join("\n");
    }

    private buildCorrectionPrompt(
        problem: string,
        answer: string,
        critique: string,
        context?: string
    ): string {
        const contextBlock = context ? `\n\nAdditional context:\n${context}` : "";
        return [
            "You previously answered the following problem, but your answer may contain",
            "mistakes. A grader reviewed your answer and produced the critique below.",
            "Use the critique to produce a corrected, complete answer. If the critique",
            "indicates the answer was already correct, simply restate the correct answer.",
            contextBlock,
            "",
            "Problem:",
            problem,
            "",
            "Your previous answer:",
            answer,
            "",
            "Grader critique:",
            critique,
            "",
            "Corrected answer:",
        ].join("\n");
    }

    /**
     * Parse the model's verification response into a structured result.
     * The parser is tolerant: it looks for the VERDICT/CRITIQUE markers but
     * degrades gracefully if the model does not follow the format exactly.
     */
    private parseVerification(raw: string): VerificationResult {
        const text = (raw || "").trim();
        const upper = text.toUpperCase();

        let verdict = "";
        const verdictMatch = text.match(/VERDICT\s*:\s*([A-Za-z]+)/i);
        if (verdictMatch) {
            verdict = verdictMatch[1].toUpperCase();
        }

        let critique = "";
        const critiqueMatch = text.match(/CRITIQUE\s*:\s*([\s\S]+)/i);
        if (critiqueMatch) {
            critique = critiqueMatch[1].trim();
        }

        // Determine correctness. Prefer an explicit VERDICT line, then fall back
        // to scanning for the keywords.
        let isCorrect: boolean;
        if (verdict === VERDICT_CORRECT) {
            isCorrect = true;
        } else if (verdict === VERDICT_INCORRECT) {
            isCorrect = false;
        } else if (/\bINCORRECT\b|\bWRONG\b|\bMISTAKE/.test(upper)) {
            isCorrect = false;
        } else if (/\bCORRECT\b/.test(upper)) {
            isCorrect = true;
        } else {
            // Ambiguous response: treat as not-yet-correct so the loop tries to
            // improve the answer rather than stopping prematurely.
            isCorrect = false;
        }

        if (!critique) {
            critique = text;
        }

        return { critique, isCorrect, verdict: verdict || (isCorrect ? VERDICT_CORRECT : VERDICT_INCORRECT) };
    }
}
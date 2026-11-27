import { ChatModel, role } from "../../types/index.js";

/**
 * Tree of Thoughts (ToT) reasoning chain.
 *
 * Implements the Tree of Thoughts framework described in
 * "Tree of Thoughts: Deliberate Problem Solving with Large Language Models"
 * (https://arxiv.org/pdf/2305.10601.pdf).
 *
 * Instead of decoding a single chain of reasoning left-to-right (Chain of
 * Thought), ToT explores a *tree* of partial solutions ("thoughts"). At every
 * step the model proposes several candidate thoughts, each candidate is scored
 * by an evaluation step, the most promising states are expanded (breadth-first
 * search) and unpromising branches are pruned / backtracked away from. The
 * search returns the best complete path found.
 *
 * The class is provider-agnostic: it only depends on a small `LLMClient`
 * interface (a single `chat(prompt) -> string` method). A ready-to-use
 * `OpenAILLMClient` adapter is provided that mirrors the existing
 * `OpenAI` provider in `lib/openai/openai.ts`, but any object satisfying the
 * interface (Gemini, Llama, a test double, ...) can be plugged in.
 */

/** Minimal interface the ToT engine needs from an LLM provider. */
export interface LLMClient {
    chat(prompt: string): Promise<string>;
}

/** Options accepted by the {@link OpenAILLMClient} adapter. */
export interface OpenAILLMClientOptions {
    apiKey?: string;
    orgId?: string;
    model?: ChatModel;
    role?: role;
    max_tokens?: number;
    temperature?: number;
}

/**
 * Adapter that turns the existing OpenAI chat endpoint into an {@link LLMClient}.
 * Mirrors the request shape used in `lib/openai/openai.ts`.
 */
export class OpenAILLMClient implements LLMClient {
    apiKey: string;
    orgId: string;
    model: ChatModel;
    role: role;
    max_tokens: number;
    temperature: number;

    constructor(options: OpenAILLMClientOptions = {}) {
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
        this.orgId = options.orgId || process.env.OPENAI_ORG_ID || "";
        this.model = options.model || "gpt-4o";
        this.role = options.role || "user";
        this.max_tokens = options.max_tokens || 1024;
        this.temperature = options.temperature ?? 0.7;
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid OpenAI API key. You can add it in .env file as OPENAI_API_KEY"
            );
        }
    }

    async chat(prompt: string): Promise<string> {
        const axios = (await import("axios")).default;
        const response = await axios
            .post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: this.model,
                    messages: [{ role: this.role, content: prompt }],
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
            .then((r: any) => r.data.choices)
            .catch((error: any) => {
                if (error.response) {
                    console.log("Server responded with status code:", error.response.status);
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
                return [];
            });
        return response?.[0]?.message?.content ?? "";
    }
}

/** A single node in the search tree. */
export interface ThoughtNode {
    /** Human-readable content of the thought / partial solution. */
    content: string;
    /** Which search step (depth) produced this node. Root is depth 0. */
    depth: number;
    /** Parent node content, or null for the root. */
    parent: string | null;
    /** Evaluation score in [0, 1]. Root is scored 1. */
    score: number;
    /** Full path of contents from root to this node. */
    path: string[];
}

/** Options for {@link TreeOfThoughtsChain}. */
export interface TreeOfThoughtsOptions {
    /** The problem / question to solve. */
    problem: string;
    /** An LLM client used for proposing and evaluating thoughts. */
    llm: LLMClient;
    /** Maximum number of thoughts to generate per state at each step. */
    k?: number;
    /** Maximum number of states kept for expansion each step (BFS beam width). */
    breadth?: number;
    /** Maximum search depth (number of thought steps). */
    maxDepth?: number;
    /** Optional custom proposal function; overrides the default prompt-based one. */
    proposeThoughts?: (problem: string, path: string[], k: number) => Promise<string[]>;
    /** Optional custom evaluation function returning a score in [0, 1]. */
    evaluateThought?: (problem: string, thought: string) => Promise<number>;
    /** Optional logging hook for observability. */
    onStep?: (info: { depth: number; states: ThoughtNode[] }) => void;
}

/** Result returned by {@link TreeOfThoughtsChain.run}. */
export interface TreeOfThoughtsResult {
    /** The best complete thought path found (root -> leaf). */
    bestPath: string[];
    /** The final answer (content of the best leaf). */
    answer: string;
    /** Score of the best path. */
    score: number;
    /** All explored states, grouped by depth. */
    explored: ThoughtNode[][];
}

const DEFAULT_K = 3;
const DEFAULT_BREADTH = 3;
const DEFAULT_MAX_DEPTH = 3;

/**
 * Breadth-first Tree-of-Thoughts reasoning chain.
 *
 * @example
 * ```ts
 * const tot = new TreeOfThoughtsChain({
 *     problem: "What is 17 * 24? Think step by step.",
 *     llm: new OpenAILLMClient({ apiKey: process.env.OPENAI_API_KEY }),
 *     k: 3,
 *     breadth: 2,
 *     maxDepth: 3,
 * });
 * const result = await tot.run();
 * console.log(result.answer);
 * ```
 */
export class TreeOfThoughtsChain {
    private readonly problem: string;
    private readonly llm: LLMClient;
    private readonly k: number;
    private readonly breadth: number;
    private readonly maxDepth: number;
    private readonly proposeThoughts?: (
        problem: string,
        path: string[],
        k: number
    ) => Promise<string[]>;
    private readonly evaluateThought?: (problem: string, thought: string) => Promise<number>;
    private readonly onStep?: (info: { depth: number; states: ThoughtNode[] }) => void;

    constructor(options: TreeOfThoughtsOptions) {
        if (!options.problem) throw new Error("TreeOfThoughtsChain requires a `problem`.");
        if (!options.llm) throw new Error("TreeOfThoughtsChain requires an `llm` client.");
        this.problem = options.problem;
        this.llm = options.llm;
        this.k = options.k && options.k > 0 ? options.k : DEFAULT_K;
        this.breadth = options.breadth && options.breadth > 0 ? options.breadth : DEFAULT_BREADTH;
        this.maxDepth =
            options.maxDepth && options.maxDepth > 0 ? options.maxDepth : DEFAULT_MAX_DEPTH;
        this.proposeThoughts = options.proposeThoughts;
        this.evaluateThought = options.evaluateThought;
        this.onStep = options.onStep;
    }

    /**
     * Generate `k` candidate next thoughts given the current partial path.
     * Uses a custom proposer if provided, otherwise prompts the LLM and parses
     * a numbered list.
     */
    private async generateThoughts(path: string[]): Promise<string[]> {
        if (this.proposeThoughts) {
            return (await this.proposeThoughts(this.problem, path, this.k)).slice(0, this.k);
        }
        const history =
            path.length > 0
                ? `Previous thoughts so far:\n${path
                      .map((p, i) => `${i + 1}. ${p}`)
                      .join("\n")}\n\n`
                : "";
        const prompt = `You are a careful reasoner solving a problem one step at a time.
Problem: ${this.problem}

${history}Propose exactly ${this.k} distinct, concrete next steps (thoughts) that
move toward a correct solution. Consider different approaches where useful.
Respond with a numbered list, one thought per line, in the form:
1. <first thought>
2. <second thought>
...`;

        const raw = await this.llm.chat(prompt);
        return this.parseThoughts(raw, this.k);
    }

    /**
     * Parse a numbered list of thoughts out of a raw LLM response. Falls back to
     * treating non-empty lines as thoughts if no numbering is present.
     */
    private parseThoughts(raw: string, k: number): string[] {
        if (!raw) return [];
        const lines = raw
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        const numbered: string[] = [];
        for (const line of lines) {
            const match = line.match(/^\s*\d+[\.\)\-:]\s+(.*)$/);
            if (match) numbered.push(match[1].trim());
        }
        const thoughts = numbered.length > 0 ? numbered : lines;
        return thoughts.filter((t) => t.length > 0).slice(0, k);
    }

    /**
     * Score a single thought in [0, 1]. Uses a custom evaluator if provided,
     * otherwise asks the LLM to rate the thought and parses a numeric score.
     */
    private async scoreThought(thought: string): Promise<number> {
        if (this.evaluateThought) {
            return this.clamp01(await this.evaluateThought(this.problem, thought));
        }
        const prompt = `You are evaluating a candidate reasoning step toward solving a problem.
Problem: ${this.problem}

Candidate thought / partial solution:
${thought}

Rate how promising this thought is for reaching a correct solution.
Respond with ONLY a single number between 0 and 1 (e.g. 0.85).`;

        const raw = await this.llm.chat(prompt);
        const match = raw.match(/[01](?:\.\d+)?|\.\d+/);
        const value = match ? parseFloat(match[0]) : NaN;
        return Number.isFinite(value) ? this.clamp01(value) : 0;
    }

    private clamp01(n: number): number {
        if (Number.isNaN(n)) return 0;
        return Math.max(0, Math.min(1, n));
    }

    /**
     * Run the breadth-first Tree-of-Thoughts search and return the best path.
     */
    async run(): Promise<TreeOfThoughtsResult> {
        const root: ThoughtNode = {
            content: this.problem,
            depth: 0,
            parent: null,
            score: 1,
            path: [this.problem],
        };

        let frontier: ThoughtNode[] = [root];
        const explored: ThoughtNode[][] = [[root]];
        // Track the best *generated* thought (never the root, which is just the
        // problem statement and is not itself an answer).
        let best: ThoughtNode | null = null;

        for (let depth = 1; depth <= this.maxDepth; depth++) {
            const nextFrontier: ThoughtNode[] = [];

            for (const state of frontier) {
                const thoughts = await this.generateThoughts(state.path);
                for (const thought of thoughts) {
                    const score = await this.scoreThought(thought);
                    const node: ThoughtNode = {
                        content: thought,
                        depth,
                        parent: state.content,
                        score,
                        path: [...state.path, thought],
                    };
                    nextFrontier.push(node);
                    if (best === null || this.isBetter(node, best)) best = node;
                }
            }

            if (nextFrontier.length === 0) break;

            // Breadth-first: keep the top `breadth` states by score for expansion.
            nextFrontier.sort((a, b) => b.score - a.score);
            frontier = nextFrontier.slice(0, this.breadth);
            explored.push(frontier);

            if (this.onStep) this.onStep({ depth, states: frontier });
        }

        // If no thoughts were ever generated, fall back to the root (problem).
        const result = best ?? root;
        return {
            bestPath: result.path,
            answer: result.content,
            score: result.score,
            explored,
        };
    }

    /** Higher score wins; ties broken by deeper (more complete) paths. */
    private isBetter(candidate: ThoughtNode, current: ThoughtNode): boolean {
        if (candidate.score > current.score) return true;
        if (candidate.score === current.score && candidate.depth > current.depth) return true;
        return false;
    }
}

export default TreeOfThoughtsChain;
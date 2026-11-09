export interface ChainOfDensityStep {
    step: number;
    missing_entities: string[];
    denser_summary: string;
}

export interface ChainOfDensityResult {
    route: "chain_of_density";
    steps: ChainOfDensityStep[];
    finalSummary: string;
    allEntities: string[];
}

export interface DirectRouteResult {
    route: "direct_chat";
    response: string;
}

export type PromptRouteOutput = ChainOfDensityResult | DirectRouteResult;

export interface LLMChatEndpoint {
    chat: (options: {
        prompt: string;
        [key: string]: any;
    }) => Promise<{ content: string } | string>;
}

export interface ChainOfDensityOptions {
    steps?: number;
    maxWords?: number;
    promptTemplate?: string;
}

const DEFAULT_COD_PROMPT_TEMPLATE = `Article:
{article}

You will generate increasingly concise, entity-dense summaries of the above article.
Repeat the following 2 steps {steps} times.
Step 1. Identify 1-3 informative entities (";" delimited) from the article which are missing from the previously generated summary.
Step 2. Write a new, denser summary of identical length (~{maxWords} words) which covers every entity and detail from the previous summary plus the missing entities.

Respond strictly with a JSON array of objects with keys "missing_entities" (array of strings) and "denser_summary" (string).`;

const SUMMARIZE_INTENT_PATTERNS: RegExp[] = [
    /\bsummari[sz](?:e|ing|ation)\b/i,
    /\btl;?dr\b/i,
    /\bchain\s+of\s+density\b/i,
    /\bgive\s+me\s+a\s+(?:brief\s+|dense\s+|concise\s+)?summary\b/i,
    /\bcondense\s+(?:this|that|the)\s+(?:document|article|text|passage)\b/i,
];

/**
 * Detects whether a user query is requesting document/article summarization.
 */
export function isSummarizationQuery(query: string): boolean {
    if (!query) return false;
    return SUMMARIZE_INTENT_PATTERNS.some((pattern) => pattern.test(query));
}

export class ChainOfDensitySummarizer {
    private endpoint: LLMChatEndpoint;
    private steps: number;
    private maxWords: number;
    private promptTemplate: string;

    constructor(endpoint: LLMChatEndpoint, options: ChainOfDensityOptions = {}) {
        this.endpoint = endpoint;
        this.steps = options.steps ?? 5;
        this.maxWords = options.maxWords ?? 80;
        this.promptTemplate = options.promptTemplate || DEFAULT_COD_PROMPT_TEMPLATE;
    }

    public buildPrompt(article: string): string {
        return this.promptTemplate
            .replace(/\{article\}/g, article)
            .replace(/\{steps\}/g, String(this.steps))
            .replace(/\{maxWords\}/g, String(this.maxWords));
    }

    public async summarize(article: string): Promise<ChainOfDensityResult> {
        const prompt = this.buildPrompt(article);
        const rawRes = await this.endpoint.chat({ prompt });
        const rawText = typeof rawRes === "string" ? rawRes : rawRes?.content || "";

        const cleaned = rawText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

        let parsedSteps: Array<{
            missing_entities?: string[] | string;
            denser_summary?: string;
            Missing_Entities?: string;
            Denser_Summary?: string;
        }> = [];

        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                parsedSteps = parsed;
            }
        } catch {
            // Fallback when endpoint returns plain text summary
            parsedSteps = [
                {
                    missing_entities: [],
                    denser_summary: rawText.trim(),
                },
            ];
        }

        const normalizedSteps: ChainOfDensityStep[] = parsedSteps.map((item, idx) => {
            const rawEntities = item.missing_entities ?? item.Missing_Entities ?? [];
            const entities = Array.isArray(rawEntities)
                ? rawEntities.map((e) => String(e).trim()).filter(Boolean)
                : String(rawEntities)
                      .split(/[;,]/)
                      .map((e) => e.trim())
                      .filter(Boolean);
            const summary = String(item.denser_summary ?? item.Denser_Summary ?? "").trim();
            return {
                step: idx + 1,
                missing_entities: entities,
                denser_summary: summary,
            };
        });

        const allEntities: string[] = [];
        for (const s of normalizedSteps) {
            for (const ent of s.missing_entities) {
                if (!allEntities.includes(ent)) {
                    allEntities.push(ent);
                }
            }
        }

        const finalSummary =
            normalizedSteps.length > 0
                ? normalizedSteps[normalizedSteps.length - 1].denser_summary
                : "";

        return {
            route: "chain_of_density",
            steps: normalizedSteps,
            finalSummary,
            allEntities,
        };
    }
}

export class ChainOfDensityPromptRouter {
    private endpoint: LLMChatEndpoint;
    private summarizer: ChainOfDensitySummarizer;

    constructor(endpoint: LLMChatEndpoint, options: ChainOfDensityOptions = {}) {
        this.endpoint = endpoint;
        this.summarizer = new ChainOfDensitySummarizer(endpoint, options);
    }

    /**
     * Classifies the incoming query and either redirects to the Chain-of-Density
     * summarization pipeline or forwards to standard chat completion.
     */
    public async route({
        query,
        document,
    }: {
        query: string;
        document?: string;
    }): Promise<PromptRouteOutput> {
        if (isSummarizationQuery(query)) {
            const sourceText = document || query;
            return await this.summarizer.summarize(sourceText);
        }

        const prompt = document ? `${query}\n\nContext:\n${document}` : query;
        const res = await this.endpoint.chat({ prompt });
        const content = typeof res === "string" ? res : res?.content || "";
        return {
            route: "direct_chat",
            response: content,
        };
    }
}

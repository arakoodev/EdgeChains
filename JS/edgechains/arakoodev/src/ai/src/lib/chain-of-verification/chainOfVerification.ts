export interface VerificationQA {
    question: string;
    answer: string;
}

export interface ChainOfVerificationResult {
    query: string;
    baselineResponse: string;
    verificationQuestions: string[];
    verifications: VerificationQA[];
    finalVerifiedResponse: string;
}

export interface CoVeTemplates {
    baselineTemplate?: string;
    planVerificationsTemplate?: string;
    executeVerificationTemplate?: string;
    finalVerifiedTemplate?: string;
}

export interface CoVeChatEndpoint {
    chat: (options: {
        prompt: string;
        [key: string]: any;
    }) => Promise<{ content: string } | string>;
}

const DEFAULT_BASELINE_TEMPLATE = `Answer the following question accurately and concisely:
Question: {query}`;

const DEFAULT_PLAN_TEMPLATE = `Based on the original question and the baseline response below, generate a list of independent verification questions to fact-check every factual claim in the baseline response.
Return one verification question per line.

Question: {query}
Baseline Response: {baseline}`;

const DEFAULT_EXECUTE_TEMPLATE = `Answer the following verification question factually and concisely without assuming any prior draft is correct:
Verification Question: {question}`;

const DEFAULT_FINAL_TEMPLATE = `Given the original question, the initial baseline response, and the independently verified question-answer pairs below, write a revised, factually accurate final response that removes or corrects any hallucinated or contradicted claims.

Original Question: {query}
Baseline Response: {baseline}
Verification Pairs:
{verifications}

Final Verified Response:`;

export class ChainOfVerification {
    private endpoint: CoVeChatEndpoint;
    private templates: Required<CoVeTemplates>;

    constructor(endpoint: CoVeChatEndpoint, templates: CoVeTemplates = {}) {
        this.endpoint = endpoint;
        this.templates = {
            baselineTemplate: templates.baselineTemplate || DEFAULT_BASELINE_TEMPLATE,
            planVerificationsTemplate: templates.planVerificationsTemplate || DEFAULT_PLAN_TEMPLATE,
            executeVerificationTemplate:
                templates.executeVerificationTemplate || DEFAULT_EXECUTE_TEMPLATE,
            finalVerifiedTemplate: templates.finalVerifiedTemplate || DEFAULT_FINAL_TEMPLATE,
        };
    }

    private async callEndpoint(prompt: string): Promise<string> {
        const res = await this.endpoint.chat({ prompt });
        return (typeof res === "string" ? res : res?.content || "").trim();
    }

    /**
     * Stage 1: Generate initial baseline response to the user query.
     */
    public async generateBaseline(query: string): Promise<string> {
        const prompt = this.templates.baselineTemplate.replace(/\{query\}/g, query);
        return await this.callEndpoint(prompt);
    }

    /**
     * Stage 2: Plan verification questions based on the query and baseline response.
     */
    public async planVerifications(query: string, baselineResponse: string): Promise<string[]> {
        const prompt = this.templates.planVerificationsTemplate
            .replace(/\{query\}/g, query)
            .replace(/\{baseline\}/g, baselineResponse);
        const raw = await this.callEndpoint(prompt);

        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map((q) => String(q).trim()).filter(Boolean);
            }
        } catch {
            // Fall back to line-delimited questions
        }

        return raw
            .split(/\r?\n/)
            .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim())
            .filter(Boolean);
    }

    /**
     * Stage 3: Execute each verification question independently (factored mode)
     * so hallucinations in the baseline draft do not bias verification answers.
     */
    public async executeVerifications(questions: string[]): Promise<VerificationQA[]> {
        const results: VerificationQA[] = [];
        for (const question of questions) {
            const prompt = this.templates.executeVerificationTemplate.replace(
                /\{question\}/g,
                question
            );
            const answer = await this.callEndpoint(prompt);
            results.push({ question, answer });
        }
        return results;
    }

    /**
     * Stage 4: Synthesize the final verified response incorporating verified facts.
     */
    public async generateFinalVerifiedResponse(
        query: string,
        baselineResponse: string,
        verifications: VerificationQA[]
    ): Promise<string> {
        const formattedVerifications = verifications
            .map((v, i) => `Q${i + 1}: ${v.question}\nA${i + 1}: ${v.answer}`)
            .join("\n\n");

        const prompt = this.templates.finalVerifiedTemplate
            .replace(/\{query\}/g, query)
            .replace(/\{baseline\}/g, baselineResponse)
            .replace(/\{verifications\}/g, formattedVerifications);

        return await this.callEndpoint(prompt);
    }

    /**
     * Runs the complete 4-stage Chain-of-Verification (CoVe) pipeline to reduce hallucination.
     */
    public async run(query: string): Promise<ChainOfVerificationResult> {
        const baselineResponse = await this.generateBaseline(query);
        const verificationQuestions = await this.planVerifications(query, baselineResponse);
        const verifications = await this.executeVerifications(verificationQuestions);
        const finalVerifiedResponse = await this.generateFinalVerifiedResponse(
            query,
            baselineResponse,
            verifications
        );

        return {
            query,
            baselineResponse,
            verificationQuestions,
            verifications,
            finalVerifiedResponse,
        };
    }
}

import { CoTOptions, ThoughtResult, ThoughtStep, ThoughtGeneratorFn, ThoughtEvaluatorFn } from "./types.js";

export class ChainOfThought {
    private maxSteps: number;
    private verbose: boolean;
    private thoughtGenerator?: ThoughtGeneratorFn;
    private thoughtEvaluator?: ThoughtEvaluatorFn;

    constructor(options: CoTOptions = {}) {
        this.maxSteps = options.maxSteps ?? 5;
        this.verbose = options.verbose ?? false;
        this.thoughtGenerator = options.thoughtGenerator;
        this.thoughtEvaluator = options.thoughtEvaluator;
    }

    /**
     * Parse raw multi-line reasoning text into structured steps.
     */
    public parseSteps(rawText: string): ThoughtStep[] {
        const lines = rawText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        const steps: ThoughtStep[] = [];
        let currentStepNumber = 1;

        for (const line of lines) {
            const stepMatch = line.match(/^(?:Step\s*(\d+)[:.]?|(\d+)[:.]|\*\s*Step\s*(\d+)[:.]?)\s*(.*)/i);
            if (stepMatch) {
                const num = parseInt(stepMatch[1] || stepMatch[2] || stepMatch[3] || String(currentStepNumber), 10);
                const content = stepMatch[4].trim() || line;
                steps.push({
                    stepNumber: num,
                    thought: content,
                });
                currentStepNumber = num + 1;
            } else if (steps.length > 0) {
                // Append continuation to previous step
                steps[steps.length - 1].thought += " " + line;
            } else {
                steps.push({
                    stepNumber: currentStepNumber++,
                    thought: line,
                });
            }
        }

        return steps;
    }

    /**
     * Default heuristic evaluator if no model evaluator is provided.
     */
    private defaultEvaluator(thought: string): number {
        if (!thought || thought.length < 5) return 0.1;
        let score = 0.5;
        if (/because|therefore|hence|since|implies|thus|steps?/i.test(thought)) score += 0.25;
        if (/\d+[\+\-\*\/=]\d+/.test(thought) || /conclusion|result|final/i.test(thought)) score += 0.15;
        if (/contradiction|invalid|error/i.test(thought)) score -= 0.2;
        return Math.max(0.0, Math.min(1.0, score));
    }

    /**
     * Execute chain of thought reasoning over the query.
     */
    public async reason(query: string, context?: string): Promise<ThoughtResult> {
        let trace: string[] = [];
        let steps: ThoughtStep[] = [];
        let finalAnswer = "";

        if (this.thoughtGenerator) {
            const prompt = `Question: ${query}\n${context ? `Context: ${context}\n` : ""}Let's think step by step:`;
            const generated = await this.thoughtGenerator(prompt, context, 0);
            const rawThoughts = Array.isArray(generated) ? generated.join("\n") : generated;
            steps = this.parseSteps(rawThoughts);
        } else {
            // Self-contained default fallback step decomposition
            steps = [
                { stepNumber: 1, thought: `Analyze the query and decompose prerequisites: "${query}"` },
                { stepNumber: 2, thought: `Identify relevant logical constraints and contextual premises` },
                { stepNumber: 3, thought: `Evaluate intermediate deductions and potential contradictions` },
                { stepNumber: 4, thought: `Formulate verified final derivation` },
            ];
        }

        // Limit steps to maxSteps
        steps = steps.slice(0, this.maxSteps);

        let totalScore = 0;
        for (const step of steps) {
            const score = this.thoughtEvaluator
                ? await this.thoughtEvaluator(step.thought, context, query)
                : this.defaultEvaluator(step.thought);
            step.subConfidence = score;
            totalScore += score;
            trace.push(`[Step ${step.stepNumber}] ${step.thought} (Confidence: ${score.toFixed(2)})`);
        }

        const avgScore = steps.length > 0 ? totalScore / steps.length : 0;
        finalAnswer = steps.length > 0 ? steps[steps.length - 1].thought : query;

        return {
            query,
            finalAnswer,
            trace,
            steps,
            bestScore: avgScore,
            totalThoughtsEvaluated: steps.length,
        };
    }
}

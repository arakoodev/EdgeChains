import {
    EoTOptions,
    ThoughtNode,
    ThoughtResult,
    ThoughtStep,
    ThoughtGeneratorFn,
    ThoughtEvaluatorFn,
} from "./types.js";

export class EverythingOfThoughts {
    private maxDepth: number;
    private beamWidth: number;
    private branchingFactor: number;
    private temperature: number;
    private verbose: boolean;
    private thoughtGenerator?: ThoughtGeneratorFn;
    private thoughtEvaluator?: ThoughtEvaluatorFn;

    constructor(options: EoTOptions = {}) {
        this.maxDepth = options.maxDepth ?? 4;
        this.beamWidth = options.beamWidth ?? 3;
        this.branchingFactor = options.branchingFactor ?? 3;
        this.temperature = options.temperature ?? 0.7;
        this.verbose = options.verbose ?? false;
        this.thoughtGenerator = options.thoughtGenerator;
        this.thoughtEvaluator = options.thoughtEvaluator;
    }

    /**
     * Default heuristic scoring function when no external model/verifier is passed.
     */
    private defaultEvaluator(thought: string, query: string, depth: number): number {
        if (!thought || thought.trim().length === 0) return 0.0;
        let score = 0.4;

        // Logical indicators
        if (/deduce|follows|proves|consistent|valid|sub-goal|lemma/i.test(thought)) score += 0.2;
        if (/therefore|conclusion|final answer|verified|solution/i.test(thought)) score += 0.25;
        if (/impossible|contradiction|flaw|error|invalid/i.test(thought)) score -= 0.3;

        // Depth progression bonus: deeper coherent thoughts towards solution
        score += Math.min(0.15, depth * 0.05);

        return Math.max(0.0, Math.min(1.0, score));
    }

    /**
     * Generate candidate thoughts for a given parent node.
     */
    private async generateCandidateThoughts(
        node: ThoughtNode,
        query: string,
        context?: string
    ): Promise<string[]> {
        if (this.thoughtGenerator) {
            const prompt = `Goal: ${query}\nCurrent reasoning path:\n${node.thought}\nDepth: ${node.depth}\nGenerate ${this.branchingFactor} distinct next logical reasoning steps:`;
            const result = await this.thoughtGenerator(prompt, context, node.depth);
            if (Array.isArray(result)) {
                return result.slice(0, this.branchingFactor);
            }
            return result
                .split("\n")
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .slice(0, this.branchingFactor);
        }

        // Deterministic multi-hypothesis expansion (EoT paper: algorithmic thought generators)
        const hypotheses = [
            `Analyze implications and verify sub-constraints from: "${node.thought.slice(0, 60)}..."`,
            `Construct alternate proof path / counterexample check for: "${node.thought.slice(0, 60)}..."`,
            `Synthesize interim lemma into conclusive deduction for query: "${query.slice(0, 50)}..."`,
        ];
        return hypotheses.slice(0, this.branchingFactor);
    }

    /**
     * Search the thought space using Beam Search / MCTS hybrid exploration.
     */
    public async search(query: string, context?: string): Promise<ThoughtResult> {
        let totalThoughtsEvaluated = 1;
        const root: ThoughtNode = {
            id: "root-0",
            depth: 0,
            thought: `Initial Problem State: ${query}`,
            score: 1.0,
            visits: 1,
            children: [],
        };

        let currentBeam: ThoughtNode[] = [root];
        let bestTerminalNode: ThoughtNode = root;

        for (let depth = 1; depth <= this.maxDepth; depth++) {
            const nextCandidates: ThoughtNode[] = [];

            for (const parent of currentBeam) {
                const thoughtTexts = await this.generateCandidateThoughts(parent, query, context);

                for (let i = 0; i < thoughtTexts.length; i++) {
                    const text = thoughtTexts[i];
                    const score = this.thoughtEvaluator
                        ? await this.thoughtEvaluator(text, context, query)
                        : this.defaultEvaluator(text, query, depth);

                    totalThoughtsEvaluated++;
                    const childNode: ThoughtNode = {
                        id: `node-${depth}-${parent.id}-${i}`,
                        parentId: parent.id,
                        depth,
                        thought: text,
                        score,
                        visits: 1,
                        children: [],
                        isTerminal: depth === this.maxDepth || score >= 0.9,
                    };

                    parent.children.push(childNode);
                    nextCandidates.push(childNode);
                }
            }

            if (nextCandidates.length === 0) break;

            // Sort candidates by score descending (Beam Search selection)
            nextCandidates.sort((a, b) => b.score - a.score);

            // Retain top beamWidth candidates
            currentBeam = nextCandidates.slice(0, this.beamWidth);

            // Track best node seen so far
            if (currentBeam.length > 0 && currentBeam[0].score >= bestTerminalNode.score) {
                bestTerminalNode = currentBeam[0];
            }

            // Early termination if top candidate achieves high confidence
            if (currentBeam.length > 0 && currentBeam[0].score >= 0.95) {
                bestTerminalNode = currentBeam[0];
                break;
            }
        }

        // Traceback from best terminal node to root to construct reasoning trace
        const path: ThoughtNode[] = [];
        let curr: ThoughtNode | undefined = bestTerminalNode;

        const findNodeById = (node: ThoughtNode, id: string): ThoughtNode | undefined => {
            if (node.id === id) return node;
            for (const child of node.children) {
                const found = findNodeById(child, id);
                if (found) return found;
            }
            return undefined;
        };

        while (curr) {
            path.unshift(curr);
            if (!curr.parentId || curr.parentId === "root-0") {
                if (curr.id !== root.id) path.unshift(root);
                break;
            }
            curr = findNodeById(root, curr.parentId);
        }

        const trace = path.map(
            (n) => `[Depth ${n.depth}] ${n.thought} (Score: ${n.score.toFixed(3)})`
        );

        const steps: ThoughtStep[] = path.map((n, idx) => ({
            stepNumber: idx + 1,
            thought: n.thought,
            subConfidence: n.score,
        }));

        return {
            query,
            finalAnswer: bestTerminalNode.thought,
            trace,
            steps,
            bestScore: bestTerminalNode.score,
            totalThoughtsEvaluated,
            tree: root,
        };
    }
}

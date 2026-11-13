import { describe, it, expect } from "bun:test";
import { ChainOfThought } from "../lib/thoughts/ChainOfThought.js";
import { EverythingOfThoughts } from "../lib/thoughts/EverythingOfThoughts.js";

describe("Chain of Thought (CoT)", () => {
    it("should initialize with default parameters", () => {
        const cot = new ChainOfThought();
        expect(cot).toBeDefined();
    });

    it("should parse multi-line reasoning text into structured steps", () => {
        const cot = new ChainOfThought();
        const rawReasoning = `Step 1: Parse the user problem and extract known parameters.
Step 2: Apply mathematical transformation x = y + 2.
Step 3: Verify the boundary conditions.
Step 4: Conclude that the final answer is 42.`;

        const steps = cot.parseSteps(rawReasoning);
        expect(steps.length).toBe(4);
        expect(steps[0].stepNumber).toBe(1);
        expect(steps[0].thought).toContain("Parse the user problem");
        expect(steps[3].stepNumber).toBe(4);
        expect(steps[3].thought).toContain("final answer is 42");
    });

    it("should execute default step-by-step reasoning", async () => {
        const cot = new ChainOfThought({ maxSteps: 3 });
        const result = await cot.reason("What is the shortest path between A and B?");

        expect(result.query).toBe("What is the shortest path between A and B?");
        expect(result.steps.length).toBe(3);
        expect(result.trace.length).toBe(3);
        expect(result.bestScore).toBeGreaterThan(0);
        expect(result.finalAnswer).toBeDefined();
    });

    it("should accept custom generator and evaluator functions", async () => {
        const mockGenerator = async () => [
            "Step 1: Decompose problem into sub-graphs",
            "Step 2: Run Dijkstra algorithm therefore find optimal edge",
            "Step 3: Conclusion: distance is 15",
        ];

        const mockEvaluator = (thought: string) => {
            return thought.includes("Dijkstra") ? 0.95 : 0.8;
        };

        const cot = new ChainOfThought({
            thoughtGenerator: mockGenerator,
            thoughtEvaluator: mockEvaluator,
        });

        const result = await cot.reason("Find shortest path");
        expect(result.steps.length).toBe(3);
        expect(result.steps[1].subConfidence).toBe(0.95);
        expect(result.steps[0].subConfidence).toBe(0.8);
        expect(result.trace[1]).toContain("0.95");
    });
});

describe("Everything of Thoughts (EoT)", () => {
    it("should initialize with default parameters", () => {
        const eot = new EverythingOfThoughts();
        expect(eot).toBeDefined();
    });

    it("should explore thought graph and construct reasoning tree", async () => {
        const eot = new EverythingOfThoughts({
            maxDepth: 3,
            beamWidth: 2,
            branchingFactor: 3,
        });

        const result = await eot.search("Solve the 24 puzzle with [4, 4, 6, 8]");
        expect(result.query).toBe("Solve the 24 puzzle with [4, 4, 6, 8]");
        expect(result.tree).toBeDefined();
        expect(result.tree?.id).toBe("root-0");
        expect(result.tree?.children.length).toBeGreaterThan(0);
        expect(result.steps.length).toBeGreaterThanOrEqual(1);
        expect(result.trace.length).toBeGreaterThanOrEqual(1);
        expect(result.totalThoughtsEvaluated).toBeGreaterThan(1);
    });

    it("should select the highest-scoring reasoning path with custom generator & evaluator", async () => {
        const mockGenerator = async (prompt: string, context?: string, depth?: number) => {
            const currentDepth = depth ?? 0;
            return [
                `Depth ${currentDepth}: Branch A - explore partial sum`,
                `Depth ${currentDepth}: Branch B - verified deduction therefore solution`,
                `Depth ${currentDepth}: Branch C - dead end contradiction`,
            ];
        };

        const mockEvaluator = (thought: string) => {
            if (thought.includes("verified deduction")) return 0.98;
            if (thought.includes("dead end")) return 0.1;
            return 0.5;
        };

        const eot = new EverythingOfThoughts({
            maxDepth: 3,
            beamWidth: 2,
            branchingFactor: 3,
            thoughtGenerator: mockGenerator,
            thoughtEvaluator: mockEvaluator,
        });

        const result = await eot.search("Calculate target deduction");
        expect(result.bestScore).toBe(0.98);
        expect(result.finalAnswer).toContain("verified deduction");
        expect(result.steps.some((s) => s.thought.includes("verified deduction"))).toBe(true);
    });
});

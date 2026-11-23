import { describe, it, expect } from "vitest";
import {
    TreeOfThoughtsChain,
    LLMClient,
} from "../lib/tree-of-thoughts/treeOfThoughts.js";

/**
 * A deterministic fake LLM used to exercise the Tree-of-Thoughts search without
 * hitting the network. It proposes thoughts from a fixed script and scores them
 * with a simple heuristic so the search behaviour is fully reproducible.
 */
class ScriptedLLM implements LLMClient {
    calls: string[] = [];
    constructor(
        private readonly proposals: Record<string, string[]>,
        private readonly scorer: (problem: string, thought: string) => number
    ) {}

    async chat(prompt: string): Promise<string> {
        this.calls.push(prompt);
        // Proposal prompt?
        if (prompt.includes("Propose exactly")) {
            // The real history (if any) sits between the "Previous thoughts so far:"
            // marker and the "Propose exactly" instruction. Parse only that block so
            // the template's example lines ("1. <first thought>") are ignored.
            let last = "__root__";
            const histMatch = prompt.match(/Previous thoughts so far:\n([\s\S]*?)\n\nPropose exactly/);
            if (histMatch) {
                const numbered = [...histMatch[1].matchAll(/^\d+\.\s+(.*)$/gm)].map((m) =>
                    m[1].trim()
                );
                if (numbered.length > 0) last = numbered[numbered.length - 1];
            }
            const key = last in this.proposals ? last : "__root__";
            const thoughts = this.proposals[key] || this.proposals["__root__"] || [];
            return thoughts.map((t, i) => `${i + 1}. ${t}`).join("\n");
        }
        // Evaluation prompt? Extract the candidate thought after the marker.
        if (prompt.includes("Rate how promising")) {
            const marker = "Candidate thought / partial solution:\n";
            const after = prompt.split(marker)[1] || "";
            const thought = after.split("\n\nRate")[0].trim();
            const score = this.scorer("problem", thought);
            return score.toFixed(2);
        }
        return "";
    }
}

describe("TreeOfThoughtsChain", () => {
    it("requires a problem and an llm client", () => {
        expect(() => new TreeOfThoughtsChain({ problem: "", llm: {} as LLMClient })).toThrow();
        expect(
            () => new TreeOfThoughtsChain({ problem: "x", llm: undefined as any })
        ).toThrow();
    });

    it("runs BFS and returns the highest-scoring path", async () => {
        // Root proposes A (bad) and B (good). B proposes B1 (best).
        const proposals: Record<string, string[]> = {
            __root__: ["A", "B"],
            A: ["A1"],
            B: ["B1"],
            B1: ["B1-final"],
        };
        // Score: anything starting with B is great, A is poor.
        const scorer = (_p: string, thought: string) => {
            if (thought.startsWith("B1-final")) return 0.99;
            if (thought.startsWith("B")) return 0.9;
            if (thought.startsWith("A")) return 0.1;
            return 0.5;
        };
        const llm = new ScriptedLLM(proposals, scorer);
        const tot = new TreeOfThoughtsChain({
            problem: "Solve it",
            llm,
            k: 3,
            breadth: 2,
            maxDepth: 3,
        });

        const result = await tot.run();
        expect(result.bestPath[0]).toBe("Solve it");
        expect(result.answer).toBe("B1-final");
        expect(result.score).toBeCloseTo(0.99, 5);
        // Explored should have root + at least one expansion level.
        expect(result.explored.length).toBeGreaterThan(1);
    });

    it("respects breadth by pruning low-scoring states", async () => {
        const proposals: Record<string, string[]> = {
            __root__: ["good1", "bad1", "bad2"],
            good1: ["good2"],
            bad1: ["x"],
            bad2: ["y"],
        };
        const scorer = (_p: string, t: string) => (t.startsWith("good") ? 0.8 : 0.2);
        const llm = new ScriptedLLM(proposals, scorer);
        const tot = new TreeOfThoughtsChain({
            problem: "p",
            llm,
            k: 3,
            breadth: 1, // keep only the single best state each level
            maxDepth: 2,
        });
        const result = await tot.run();
        // With breadth 1 only the "good" branch survives.
        expect(result.answer).toBe("good2");
        expect(result.score).toBeCloseTo(0.8, 5);
    });

    it("supports custom propose and evaluate functions", async () => {
        const tot = new TreeOfThoughtsChain({
            problem: "custom",
            llm: {} as LLMClient, // unused because custom fns provided
            k: 2,
            breadth: 2,
            maxDepth: 2,
            proposeThoughts: async (_problem, path) => {
                if (path.length === 1) return ["step-1"];
                return ["step-2"];
            },
            evaluateThought: async (_problem, thought) => {
                return thought === "step-2" ? 1 : 0.3;
            },
        });
        const result = await tot.run();
        expect(result.bestPath).toEqual(["custom", "step-1", "step-2"]);
        expect(result.score).toBe(1);
    });

    it("parses numbered thoughts and numeric scores robustly", async () => {
        // Scorer returns text with extra words around the number.
        const llm: LLMClient = {
            async chat(prompt: string): Promise<string> {
                if (prompt.includes("Propose exactly")) {
                    return "Here are ideas:\n1) first idea\n2) second idea\n3) third idea";
                }
                return "I would rate this around 0.75 overall.";
            },
        };
        const tot = new TreeOfThoughtsChain({
            problem: "parse",
            llm,
            k: 3,
            breadth: 3,
            maxDepth: 1,
        });
        const result = await tot.run();
        // All three thoughts scored 0.75; best path is one of them at depth 1.
        expect(result.bestPath.length).toBe(2);
        expect(result.score).toBeCloseTo(0.75, 5);
    });
});
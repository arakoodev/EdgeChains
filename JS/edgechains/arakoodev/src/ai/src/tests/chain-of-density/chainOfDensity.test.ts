import fs from "fs";
import path from "path";
import {
    ChainOfDensityPromptRouter,
    ChainOfDensitySummarizer,
    isSummarizationQuery,
} from "../../lib/chain-of-density/chainOfDensity";

function loadCodTemplateFromJsonnet(): string {
    const jsonnetPath = path.join(
        __dirname,
        "../../testcases/chain-of-density/chainOfDensity.jsonnet"
    );
    const raw = fs.readFileSync(jsonnetPath, "utf8");
    const match = raw.match(/local\s+codPromptTemplate\s*=\s*\|\|\|([\s\S]*?)\|\|\|;/);
    return match ? match[1].trim() : "";
}

describe("Chain of Density Summarization & Prompt Router (#235)", () => {
    const template = loadCodTemplateFromJsonnet();

    test("detects summarization queries accurately", () => {
        expect(isSummarizationQuery("Please summarize that document for me")).toBe(true);
        expect(isSummarizationQuery("Give me a brief summary of the article")).toBe(true);
        expect(isSummarizationQuery("TL;DR of this paper")).toBe(true);
        expect(isSummarizationQuery("What is 2 + 2?")).toBe(false);
    });

    test("routes summarization queries to 5-step Chain-of-Density pipeline using Jsonnet template", async () => {
        const mockCodSteps = [
            {
                missing_entities: ["Chain of Density", "GPT-4"],
                denser_summary:
                    "Chain of Density (CoD) prompts GPT-4 to generate initial sparse summaries.",
            },
            {
                missing_entities: ["Salesforce AI", "MIT", "Columbia"],
                denser_summary:
                    "Researchers from Salesforce AI, MIT, and Columbia introduced Chain of Density (CoD) using GPT-4.",
            },
            {
                missing_entities: ["5 iterations", "80 words"],
                denser_summary:
                    "Researchers from Salesforce AI, MIT, and Columbia introduced Chain of Density (CoD), where GPT-4 iteratively adds missing entities across 5 iterations at a fixed ~80 words length.",
            },
        ];

        const mockEndpoint = {
            chat: jest.fn().mockResolvedValueOnce({
                content: JSON.stringify(mockCodSteps),
            }),
        };

        const router = new ChainOfDensityPromptRouter(mockEndpoint, {
            steps: 3,
            promptTemplate: template,
        });

        const result = await router.route({
            query: "summarize that document",
            document: "Full research paper text on Chain of Density summarization...",
        });

        expect(result.route).toBe("chain_of_density");
        if (result.route === "chain_of_density") {
            expect(result.steps).toHaveLength(3);
            expect(result.allEntities).toEqual([
                "Chain of Density",
                "GPT-4",
                "Salesforce AI",
                "MIT",
                "Columbia",
                "5 iterations",
                "80 words",
            ]);
            expect(result.finalSummary).toContain("5 iterations");
        }
    });

    test("routes non-summarization queries to direct chat completion", async () => {
        const mockEndpoint = {
            chat: jest.fn().mockResolvedValueOnce({
                content: "Direct answer to general question.",
            }),
        };

        const router = new ChainOfDensityPromptRouter(mockEndpoint);
        const result = await router.route({
            query: "How do I install Node.js on Ubuntu?",
        });

        expect(result).toEqual({
            route: "direct_chat",
            response: "Direct answer to general question.",
        });
    });

    test("ChainOfDensitySummarizer parses semicolon-delimited Missing_Entities format", async () => {
        const mockEndpoint = {
            chat: jest.fn().mockResolvedValueOnce({
                content: JSON.stringify([
                    {
                        Missing_Entities: "EntityA; EntityB",
                        Denser_Summary: "Summary with EntityA and EntityB.",
                    },
                ]),
            }),
        };

        const summarizer = new ChainOfDensitySummarizer(mockEndpoint, { steps: 1 });
        const res = await summarizer.summarize("Sample article");
        expect(res.allEntities).toEqual(["EntityA", "EntityB"]);
        expect(res.finalSummary).toBe("Summary with EntityA and EntityB.");
    });
});

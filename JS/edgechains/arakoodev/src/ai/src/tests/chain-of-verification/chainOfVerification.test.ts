import fs from "fs";
import path from "path";
import {
    ChainOfVerification,
    CoVeTemplates,
} from "../../lib/chain-of-verification/chainOfVerification";

function loadCoVeTemplatesFromJsonnet(): CoVeTemplates {
    const jsonnetPath = path.join(__dirname, "../../testcases/chain-of-verification/cove.jsonnet");
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Jsonnet = require("@arakoodev/jsonnet");
        const instance = new Jsonnet();
        return JSON.parse(instance.evaluateFile(jsonnetPath));
    } catch {
        const raw = fs.readFileSync(jsonnetPath, "utf8");
        const extract = (name: string) => {
            const match = raw.match(
                new RegExp(`local\\s+${name}\\s*=\\s*\\|\\|\\|([\\s\\S]*?)\\|\\|\\|;`)
            );
            return match ? match[1].trim() : "";
        };
        return {
            baselineTemplate: extract("baselineTemplate"),
            planVerificationsTemplate: extract("planVerificationsTemplate"),
            executeVerificationTemplate: extract("executeVerificationTemplate"),
            finalVerifiedTemplate: extract("finalVerifiedTemplate"),
        };
    }
}

describe("Chain-of-Verification (CoVe) with Jsonnet (#254)", () => {
    const templates = loadCoVeTemplatesFromJsonnet();

    test("loads all 4 CoVe prompt templates from cove.jsonnet", () => {
        expect(templates.baselineTemplate).toContain("{query}");
        expect(templates.planVerificationsTemplate).toContain("{baseline}");
        expect(templates.executeVerificationTemplate).toContain("{question}");
        expect(templates.finalVerifiedTemplate).toContain("{verifications}");
    });

    test("executes all 4 CoVe stages and corrects hallucinated claims", async () => {
        const promptsSeen: string[] = [];
        const mockEndpoint = {
            chat: jest
                .fn()
                .mockImplementationOnce(async ({ prompt }) => {
                    promptsSeen.push(prompt);
                    // Stage 1: Baseline response containing a hallucination (Ada Lovelace + Alan Turing + Guido van Rossum)
                    return {
                        content:
                            "Python was created by Guido van Rossum in 1991, and JavaScript was created by James Gosling in 1995.",
                    };
                })
                .mockImplementationOnce(async ({ prompt }) => {
                    promptsSeen.push(prompt);
                    // Stage 2: Plan verification questions
                    return {
                        content: [
                            "1. Who created Python and in what year?",
                            "2. Who created JavaScript and in what year?",
                        ].join("\n"),
                    };
                })
                .mockImplementationOnce(async ({ prompt }) => {
                    promptsSeen.push(prompt);
                    // Stage 3a: Independent verification 1 (must NOT contain the baseline draft)
                    expect(prompt).not.toContain("James Gosling");
                    return {
                        content: "Guido van Rossum created Python, first released in 1991.",
                    };
                })
                .mockImplementationOnce(async ({ prompt }) => {
                    promptsSeen.push(prompt);
                    // Stage 3b: Independent verification 2
                    expect(prompt).not.toContain("James Gosling");
                    return {
                        content: "Brendan Eich created JavaScript at Netscape in 1995.",
                    };
                })
                .mockImplementationOnce(async ({ prompt }) => {
                    promptsSeen.push(prompt);
                    // Stage 4: Final verified response
                    return {
                        content:
                            "Python was created by Guido van Rossum in 1991, and JavaScript was created by Brendan Eich in 1995.",
                    };
                }),
        };

        const cove = new ChainOfVerification(mockEndpoint, templates);
        const result = await cove.run("Who created Python and JavaScript?");

        expect(result.verificationQuestions).toEqual([
            "Who created Python and in what year?",
            "Who created JavaScript and in what year?",
        ]);
        expect(result.verifications).toHaveLength(2);
        expect(result.verifications[1].answer).toContain("Brendan Eich");
        expect(result.finalVerifiedResponse).toBe(
            "Python was created by Guido van Rossum in 1991, and JavaScript was created by Brendan Eich in 1995."
        );
        expect(promptsSeen).toHaveLength(5);
    });
});

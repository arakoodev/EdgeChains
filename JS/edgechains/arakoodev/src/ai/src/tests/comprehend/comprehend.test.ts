import axios from "axios";
import fs from "fs";
import path from "path";
import { AwsComprehendRedact } from "../../lib/aws-comprehend/comprehend";
import { OpenAI } from "../../lib/openai/openai";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const promptsPath = path.join(__dirname, "prompts.jsonnet");
const promptsData = JSON.parse(fs.readFileSync(promptsPath, "utf8"));

describe("AwsComprehendRedact", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("detectPiiEntities & redactPrompt", () => {
        test("should redact PII entities with ENTITY_TYPE tags using AWS Comprehend", async () => {
            const prompt: string = promptsData.customerSupportPrompt;
            const nameOffset = prompt.indexOf("Jane Doe");
            const emailOffset = prompt.indexOf("jane.doe@example.com");
            const ssnOffset = prompt.indexOf("123-45-6789");

            mockedAxios.post = jest.fn().mockResolvedValueOnce({
                data: {
                    Entities: [
                        { Type: "NAME", Score: 0.99, BeginOffset: nameOffset, EndOffset: nameOffset + "Jane Doe".length },
                        { Type: "EMAIL", Score: 0.99, BeginOffset: emailOffset, EndOffset: emailOffset + "jane.doe@example.com".length },
                        { Type: "SSN", Score: 0.98, BeginOffset: ssnOffset, EndOffset: ssnOffset + "123-45-6789".length },
                    ],
                },
            });

            const redactor = new AwsComprehendRedact({
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                region: "us-east-1",
                redactionMode: "ENTITY_TYPE",
            });

            const redacted = await redactor.redactPrompt(prompt);
            expect(redacted).toEqual("Customer [NAME] (email: [EMAIL], SSN: [SSN]) requested a refund for order #9812.");
        });

        test("should mask PII entities with maskCharacter when redactionMode is MASK", async () => {
            const prompt: string = promptsData.customerSupportPrompt;
            const ssnOffset = prompt.indexOf("123-45-6789");

            mockedAxios.post = jest.fn().mockResolvedValueOnce({
                data: {
                    Entities: [{ Type: "SSN", Score: 0.95, BeginOffset: ssnOffset, EndOffset: ssnOffset + 11 }],
                },
            });

            const redactor = new AwsComprehendRedact({
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                redactionMode: "MASK",
                maskCharacter: "*",
                entityTypes: ["SSN"],
            });

            const redacted = await redactor.redactPrompt(prompt);
            expect(redacted).toContain("SSN: ***********");
            expect(redacted).not.toContain("123-45-6789");
        });
    });

    describe("Observable chaining with Endpoint classes", () => {
        test("should chain AwsComprehendRedact observable directly with OpenAI Endpoint", async () => {
            const prompt: string = promptsData.customerSupportPrompt;
            const emailOffset = prompt.indexOf("jane.doe@example.com");
            const ssnOffset = prompt.indexOf("123-45-6789");

            mockedAxios.post = jest
                .fn()
                .mockResolvedValueOnce({
                    data: {
                        Entities: [
                            { Type: "EMAIL", Score: 0.99, BeginOffset: emailOffset, EndOffset: emailOffset + "jane.doe@example.com".length },
                            { Type: "SSN", Score: 0.99, BeginOffset: ssnOffset, EndOffset: ssnOffset + "123-45-6789".length },
                        ],
                    },
                })
                .mockResolvedValueOnce({
                    data: { choices: [{ message: { content: "Refund processed for redacted customer." } }] },
                });

            const redactor = new AwsComprehendRedact({
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            });
            const openAI = new OpenAI({ apiKey: "test_openai_key", orgId: "test_org" });

            const emittedValues: any[] = [];
            await new Promise<void>((resolve, reject) => {
                redactor
                    .observe(prompt)
                    .map((sanitizedPrompt) => {
                        expect(sanitizedPrompt).not.toContain("jane.doe@example.com");
                        expect(sanitizedPrompt).not.toContain("123-45-6789");
                        expect(sanitizedPrompt).toContain("[EMAIL]");
                        expect(sanitizedPrompt).toContain("[SSN]");
                        return sanitizedPrompt;
                    })
                    .chain(openAI, { model: "gpt-3.5-turbo" })
                    .subscribe({
                        next: (response) => emittedValues.push(response),
                        error: (err) => reject(err),
                        complete: () => resolve(),
                    });
            });

            expect(emittedValues).toEqual([{ content: "Refund processed for redacted customer." }]);
        });
    });
});

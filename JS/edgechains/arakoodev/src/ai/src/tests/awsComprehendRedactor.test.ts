import { describe, test, expect } from "vitest";
import { firstValueFrom, of, toArray } from "rxjs";
import {
    AWSComprehendRedactor,
    ComprehendRedactor,
    AwsComprehendRedactor,
    ComprehendRedactionChain,
    ComprehendObservable,
    chunkTextByBytes,
    type PiiEntity,
    type PiiEntityType,
    type ComprehendClientLike,
    type EndpointLike,
    type ChatMessage,
} from "../index.js";

const describeFn = describe;
const testFn = test;
const expectFn = expect;
function createMockComprehendClient(entities: PiiEntity[] = []): ComprehendClientLike {
    return {
        detectPiiEntities: async () => ({
            Entities: entities,
        }),
    };
}

function entitySpan(
    fullText: string,
    substring: string,
    type: PiiEntityType | string,
    score: number = 0.99
): PiiEntity {
    const utf8Buffer = Buffer.from(fullText, "utf-8");
    const subBuffer = Buffer.from(substring, "utf-8");
    const beginByte = utf8Buffer.indexOf(subBuffer);
    if (beginByte === -1) {
        throw new Error(`Substring "${substring}" not found in fullText "${fullText}"`);
    }
    return {
        Type: type as PiiEntityType,
        Score: score,
        BeginOffset: beginByte,
        EndOffset: beginByte + subBuffer.length,
    };
}

describeFn("AWSComprehendRedactor", () => {
    testFn("should export class aliases correctly", () => {
        expectFn(AWSComprehendRedactor).toBeDefined();
        expectFn(ComprehendRedactor).toBe(AWSComprehendRedactor);
        expectFn(AwsComprehendRedactor).toBe(AWSComprehendRedactor);
    });

    testFn("should initialize with default configurations", () => {
        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(),
        });
        expectFn(redactor).toBeDefined();
        expectFn(redactor.getClient()).toBeDefined();
    });

    testFn("should return empty string / empty result for empty inputs", async () => {
        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(),
        });

        expectFn(await redactor.redact("")).toBe("");
        expectFn(await redactor.redact("   ")).toBe("   ");

        const detailed = await redactor.redactDetailed("");
        expectFn(detailed.redactedText).toBe("");
        expectFn(detailed.entities).toEqual([]);
        expectFn(detailed.redactedEntityCount).toBe(0);
    });

    testFn(
        "should redact sensitive PII using default REPLACE_WITH_PII_ENTITY_TYPE mode",
        async () => {
            const text = "Contact John Doe at john.doe@example.com or call 555-0199.";
            const mockEntities: PiiEntity[] = [
                entitySpan(text, "John Doe", "NAME", 0.98),
                entitySpan(text, "john.doe@example.com", "EMAIL", 0.99),
                entitySpan(text, "555-0199", "PHONE", 0.95),
            ];

            const redactor = new AWSComprehendRedactor({
                client: createMockComprehendClient(mockEntities),
            });

            const result = await redactor.redact(text);
            expectFn(result).toBe("Contact [NAME] at [EMAIL] or call [PHONE].");

            const detailed = await redactor.redactDetailed(text);
            expectFn(detailed.redactedText).toBe("Contact [NAME] at [EMAIL] or call [PHONE].");
            expectFn(detailed.originalText).toBe(text);
            expectFn(detailed.redactedEntityCount).toBe(3);
        }
    );

    testFn("should redact using MASK mode with default asterisk character", async () => {
        const text = "My SSN is 123-45-6789.";
        const mockEntities: PiiEntity[] = [entitySpan(text, "123-45-6789", "SSN", 0.99)];

        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            defaultMaskMode: "MASK",
        });

        const result = await redactor.redact(text);
        expectFn(result).toBe("My SSN is ***********.");
    });

    testFn("should redact using MASK mode with custom mask character", async () => {
        const text = "My PIN is 9876.";
        const mockEntities: PiiEntity[] = [entitySpan(text, "9876", "PIN", 0.99)];

        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
        });

        const result = await redactor.redact(text, {
            maskMode: "MASK",
            maskCharacter: "#",
        });
        expectFn(result).toBe("My PIN is ####.");
    });

    testFn("should redact using CUSTOM placeholder string", async () => {
        const mockKey = "AKIA" + "EXAMPLEKEY123456";
        const text = `Secret key is ${mockKey}.`;
        const mockEntities: PiiEntity[] = [entitySpan(text, mockKey, "AWS_ACCESS_KEY", 0.99)];

        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            defaultMaskMode: "CUSTOM",
            customPlaceholder: "[CONFIDENTIAL]",
        });

        const result = await redactor.redact(text);
        expectFn(result).toBe("Secret key is [CONFIDENTIAL].");
    });

    testFn("should redact using CUSTOM placeholder function", async () => {
        const text = "User alice has email alice@work.com.";
        const mockEntities: PiiEntity[] = [entitySpan(text, "alice@work.com", "EMAIL", 0.99)];

        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
        });

        const result = await redactor.redact(text, {
            maskMode: "CUSTOM",
            customPlaceholder: (entity, orig) => `<REDACTED_${entity.Type}_${orig.length}CHARS>`,
        });

        expectFn(result).toBe("User alice has email <REDACTED_EMAIL_14CHARS>.");
    });

    testFn("should filter entities below scoreThreshold", async () => {
        const text = "Maybe John Doe is here with 555-0100.";
        const mockEntities: PiiEntity[] = [
            entitySpan(text, "John Doe", "NAME", 0.4), // Below 0.5 threshold
            entitySpan(text, "555-0100", "PHONE", 0.95), // Above threshold
        ];

        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
            defaultScoreThreshold: 0.5,
        });

        const result = await redactor.redact(text);
        expectFn(result).toBe("Maybe John Doe is here with [PHONE].");
    });

    testFn("should filter entities by allowed entityTypes", async () => {
        const text = "User John Doe has email john@test.com and phone 555-1234.";
        const mockEntities: PiiEntity[] = [
            entitySpan(text, "John Doe", "NAME", 0.99),
            entitySpan(text, "john@test.com", "EMAIL", 0.99),
            entitySpan(text, "555-1234", "PHONE", 0.99),
        ];

        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
        });

        const result = await redactor.redact(text, {
            entityTypes: ["EMAIL"],
        });

        expectFn(result).toBe("User John Doe has email [EMAIL] and phone 555-1234.");
    });

    testFn(
        "should correctly handle multi-byte UTF-8 characters without offset corruption",
        async () => {
            const text =
                "Hello 👋 world! 🌍 Contact Alice Smith at alice@example.com for details. ✨";
            const mockEntities: PiiEntity[] = [
                entitySpan(text, "Alice Smith", "NAME", 0.99),
                entitySpan(text, "alice@example.com", "EMAIL", 0.99),
            ];

            const redactor = new AWSComprehendRedactor({
                client: createMockComprehendClient(mockEntities),
            });

            const result = await redactor.redact(text);
            expectFn(result).toBe("Hello 👋 world! 🌍 Contact [NAME] at [EMAIL] for details. ✨");
        }
    );

    testFn("should resolve overlapping entities by picking the longer span", async () => {
        const text = "Send to 123 Main Street Suite 400.";
        const utf8 = Buffer.from(text, "utf-8");

        const fullAddress = "123 Main Street Suite 400";
        const shortStreet = "Main Street";

        const startFull = utf8.indexOf(Buffer.from(fullAddress, "utf-8"));
        const startShort = utf8.indexOf(Buffer.from(shortStreet, "utf-8"));

        const mockEntities: PiiEntity[] = [
            {
                Type: "ADDRESS",
                Score: 0.95,
                BeginOffset: startFull,
                EndOffset: startFull + Buffer.byteLength(fullAddress, "utf-8"),
            },
            {
                Type: "ADDRESS",
                Score: 0.99,
                BeginOffset: startShort,
                EndOffset: startShort + Buffer.byteLength(shortStreet, "utf-8"),
            },
        ];

        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(mockEntities),
        });

        const result = await redactor.redact(text);
        expectFn(result).toBe("Send to [ADDRESS].");
    });

    testFn("should support AWS SDK v3 client with .send method", async () => {
        const text = "Call 555-9999.";
        const clientWithSend: ComprehendClientLike = {
            send: async () => ({
                Entities: [entitySpan(text, "555-9999", "PHONE", 0.99)],
            }),
        };

        const redactor = new AWSComprehendRedactor({ client: clientWithSend });
        const result = await redactor.redact(text);
        expectFn(result).toBe("Call [PHONE].");
    });

    testFn("should throw descriptive error when Comprehend fails", async () => {
        const failingClient: ComprehendClientLike = {
            detectPiiEntities: async () => {
                throw new Error("AWS service unreachable");
            },
        };

        const redactor = new AWSComprehendRedactor({ client: failingClient });
        await expectFn(redactor.redact("test")).rejects.toThrow(
            /AWS Comprehend DetectPiiEntities failed: AWS service unreachable/
        );
    });

    testFn("should redact messages array via redactMessages", async () => {
        const messages: ChatMessage[] = [
            { role: "system", content: "You are a helpful assistant." },
            {
                role: "user",
                content: "My name is Bob Vance and email is bob@vance.com.",
            },
        ];

        const client: ComprehendClientLike = {
            detectPiiEntities: async ({ Text }) => {
                if (Text.includes("Bob Vance")) {
                    return {
                        Entities: [
                            entitySpan(Text, "Bob Vance", "NAME", 0.99),
                            entitySpan(Text, "bob@vance.com", "EMAIL", 0.99),
                        ],
                    };
                }
                return { Entities: [] };
            },
        };

        const redactor = new AWSComprehendRedactor({ client });
        const redactedMessages = await redactor.redactMessages(messages);

        expectFn(redactedMessages[0].content).toBe("You are a helpful assistant.");
        expectFn(redactedMessages[1].content).toBe("My name is [NAME] and email is [EMAIL].");
        expectFn(redactedMessages[1].role).toBe("user");
    });

    testFn("should redact strings via redactObservable", async () => {
        const text = "Contact alice@test.com.";
        const client = createMockComprehendClient([
            entitySpan(text, "alice@test.com", "EMAIL", 0.99),
        ]);
        const redactor = new AWSComprehendRedactor({ client });

        const observable$ = redactor.redactObservable(text);
        const result = await firstValueFrom(observable$);
        expectFn(result).toBe("Contact [EMAIL].");
    });

    testFn("should redact Observable<string> stream via redactObservable", async () => {
        const client: ComprehendClientLike = {
            detectPiiEntities: async ({ Text }) => {
                const ents: PiiEntity[] = [];
                if (Text.includes("first@test.com")) {
                    ents.push(entitySpan(Text, "first@test.com", "EMAIL", 0.99));
                }
                if (Text.includes("second@test.com")) {
                    ents.push(entitySpan(Text, "second@test.com", "EMAIL", 0.99));
                }
                return { Entities: ents };
            },
        };

        const redactor = new AWSComprehendRedactor({ client });
        const stream$ = of("Email: first@test.com", "Email: second@test.com");
        const results = await firstValueFrom(redactor.redactObservable(stream$).pipe(toArray()));

        expectFn(results).toEqual(["Email: [EMAIL]", "Email: [EMAIL]"]);
    });

    testFn("should chunk large text over chunkSizeBytes seamlessly", async () => {
        const part1 = "Section 1 mentions user Alice and email alice@company.com.\n\n";
        const part2 = "Section 2 mentions user Bob and phone 555-8888.\n\n";
        const combined = part1 + part2;

        const chunks = chunkTextByBytes(combined, 60);
        expectFn(chunks.length).toBeGreaterThan(1);
        expectFn(chunks.map((c) => c.text).join("")).toBe(combined);

        const client: ComprehendClientLike = {
            detectPiiEntities: async ({ Text }) => {
                const ents: PiiEntity[] = [];
                if (Text.includes("alice@company.com")) {
                    ents.push(entitySpan(Text, "alice@company.com", "EMAIL", 0.99));
                }
                if (Text.includes("555-8888")) {
                    ents.push(entitySpan(Text, "555-8888", "PHONE", 0.99));
                }
                return { Entities: ents };
            },
        };

        const redactor = new AWSComprehendRedactor({
            client,
            chunkSizeBytes: 60,
        });

        const result = await redactor.redact(combined);
        expectFn(result).toBe(
            "Section 1 mentions user Alice and email [EMAIL].\n\nSection 2 mentions user Bob and phone [PHONE].\n\n"
        );
    });
});

describeFn("Chaining AWSComprehendRedactor with Endpoint classes", () => {
    testFn("should chain with endpoint.chat using Promise API", async () => {
        const text = "Please assist user with SSN 123-45-6789.";
        const client = createMockComprehendClient([entitySpan(text, "123-45-6789", "SSN", 0.99)]);
        const redactor = new AWSComprehendRedactor({ client });

        let receivedPrompt = "";
        const mockEndpoint: EndpointLike = {
            chat: async (options) => {
                receivedPrompt = options.prompt || "";
                return { content: `Echo: ${receivedPrompt}` };
            },
        };

        const response = await redactor.chain<{ content: string }>(mockEndpoint, {
            prompt: text,
        });

        expectFn(receivedPrompt).toBe("Please assist user with SSN [SSN].");
        expectFn(response.content).toBe("Echo: Please assist user with SSN [SSN].");
    });

    testFn("should chain with endpoint.makeRequest when chat is not available", async () => {
        const text = "Call 555-4321.";
        const client = createMockComprehendClient([entitySpan(text, "555-4321", "PHONE", 0.99)]);
        const redactor = new AWSComprehendRedactor({ client });

        let calledPrompt = "";
        const mockLlamaEndpoint: EndpointLike = {
            makeRequest: async (options) => {
                calledPrompt = options.prompt || "";
                return { data: { output: `Llama processed: ${calledPrompt}` } };
            },
        };

        const res = await redactor.chain<{ data: { output: string } }>(mockLlamaEndpoint, {
            prompt: text,
        });
        expectFn(calledPrompt).toBe("Call [PHONE].");
        expectFn(res.data.output).toBe("Llama processed: Call [PHONE].");
    });

    testFn("should chain with endpoint as an Observable via chainObservable", async () => {
        const text = "My credit card is 4111-2222-3333-4444.";
        const client = createMockComprehendClient([
            entitySpan(text, "4111-2222-3333-4444", "CREDIT_DEBIT_NUMBER", 0.99),
        ]);
        const redactor = new AWSComprehendRedactor({ client });

        const mockEndpoint: EndpointLike = {
            chat: async (options) => ({
                reply: `Safe input received: ${options.prompt}`,
            }),
        };

        const result$ = redactor.chainObservable<{ reply: string }>(mockEndpoint, {
            prompt: text,
        });

        const emitted = await firstValueFrom(result$);
        expectFn(emitted.reply).toBe(
            "Safe input received: My credit card is [CREDIT_DEBIT_NUMBER]."
        );
    });

    testFn("should transparently wrap endpoint using redactor.wrap()", async () => {
        const text = "Contact dev@test.com.";
        const client = createMockComprehendClient([
            entitySpan(text, "dev@test.com", "EMAIL", 0.99),
        ]);
        const redactor = new AWSComprehendRedactor({ client });

        const originalEndpoint: EndpointLike = {
            name: "MockGPT",
            chat: async (options) => ({
                output: `Response for: ${options.prompt}`,
            }),
            streamedChat: async (options) => ({
                streamOutput: `Streamed: ${options.prompt}`,
            }),
        };

        const wrappedEndpoint = redactor.wrap(originalEndpoint);
        expectFn(
            typeof wrappedEndpoint === "object" &&
                wrappedEndpoint !== null &&
                "name" in wrappedEndpoint &&
                wrappedEndpoint.name
        ).toBe("MockGPT");

        const chatRes = (await wrappedEndpoint.chat!({ prompt: text })) as {
            output: string;
        };
        expectFn(chatRes.output).toBe("Response for: Contact [EMAIL].");

        const streamRes = (await wrappedEndpoint.streamedChat!({
            prompt: text,
        })) as {
            streamOutput: string;
        };
        expectFn(streamRes.streamOutput).toBe("Streamed: Contact [EMAIL].");
    });
});

describeFn("ComprehendRedactionChain", () => {
    testFn("should throw if constructed without redactor or endpoint", () => {
        expectFn(
            () =>
                new ComprehendRedactionChain({} as unknown as { redactor: never; endpoint: never })
        ).toThrow(/ComprehendRedactionChain requires both 'redactor' and 'endpoint' instances/);
    });

    testFn("should expose getters for redactor and endpoint", () => {
        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(),
        });
        const endpoint: EndpointLike = { chat: async () => ({}) };
        const chain = new ComprehendRedactionChain({ redactor, endpoint });

        expectFn(chain.getRedactor()).toBe(redactor);
        expectFn(chain.getEndpoint()).toBe(endpoint);
    });

    testFn("should execute chain.run() and return endpoint response", async () => {
        const text = "Admin email admin@corp.com.";
        const client = createMockComprehendClient([
            entitySpan(text, "admin@corp.com", "EMAIL", 0.99),
        ]);
        const redactor = new AWSComprehendRedactor({ client });
        const endpoint: EndpointLike = {
            chat: async (opts) => ({ result: opts.prompt }),
        };

        const chain = new ComprehendRedactionChain({ redactor, endpoint });
        const res = await chain.run<{ result: string }>({ prompt: text });
        expectFn(res.result).toBe("Admin email [EMAIL].");
    });

    testFn("should execute chain.runObservable() and toObservable()", async () => {
        const text = "SSN 000-11-2222.";
        const client = createMockComprehendClient([entitySpan(text, "000-11-2222", "SSN", 0.99)]);
        const redactor = new AWSComprehendRedactor({ client });
        const endpoint: EndpointLike = {
            chat: async (opts) => ({ processed: opts.prompt }),
        };

        const chain = new ComprehendRedactionChain({ redactor, endpoint });

        const res1 = await firstValueFrom(
            chain.runObservable<{ processed: string }>({ prompt: text })
        );
        expectFn(res1.processed).toBe("SSN [SSN].");

        const res2 = await firstValueFrom(
            chain.toObservable<{ processed: string }>({ prompt: text })
        );
        expectFn(res2.processed).toBe("SSN [SSN].");
    });

    testFn("should pipe observable stream of prompts through pipeObservable", async () => {
        const client: ComprehendClientLike = {
            detectPiiEntities: async ({ Text }) => {
                const ents: PiiEntity[] = [];
                if (Text.includes("a@a.com")) {
                    ents.push(entitySpan(Text, "a@a.com", "EMAIL", 0.99));
                }
                if (Text.includes("b@b.com")) {
                    ents.push(entitySpan(Text, "b@b.com", "EMAIL", 0.99));
                }
                return { Entities: ents };
            },
        };

        const redactor = new AWSComprehendRedactor({ client });
        const endpoint: EndpointLike = {
            chat: async (opts) => `Answer for ${opts.prompt}`,
        };

        const chain = new ComprehendRedactionChain({ redactor, endpoint });
        const prompts$ = of("User a@a.com", "User b@b.com");

        const responses = await firstValueFrom(
            chain.pipeObservable<string>(prompts$).pipe(toArray())
        );

        expectFn(responses).toEqual(["Answer for User [EMAIL]", "Answer for User [EMAIL]"]);
    });
});

describeFn("ComprehendObservable static utilities", () => {
    testFn("should support ComprehendObservable.redact in RxJS pipe", async () => {
        const text = "User ssn 999-88-7777.";
        const client = createMockComprehendClient([entitySpan(text, "999-88-7777", "SSN", 0.99)]);
        const redactor = new AWSComprehendRedactor({ client });

        const result$ = of(text).pipe(ComprehendObservable.redact(redactor));
        const redacted = await firstValueFrom(result$);
        expectFn(redacted).toBe("User ssn [SSN].");
    });

    testFn("should support ComprehendObservable.redactMessages in RxJS pipe", async () => {
        const msgs: ChatMessage[] = [{ role: "user", content: "Email is test@example.com." }];
        const client = createMockComprehendClient([
            entitySpan(msgs[0].content, "test@example.com", "EMAIL", 0.99),
        ]);
        const redactor = new AWSComprehendRedactor({ client });

        const result$ = of(msgs).pipe(ComprehendObservable.redactMessages(redactor));
        const redacted = await firstValueFrom(result$);
        expectFn(redacted[0].content).toBe("Email is [EMAIL].");
    });

    testFn(
        "should chain prompt stream directly to endpoint using ComprehendObservable.chainEndpoint",
        async () => {
            const text = "Phone 555-0123.";
            const client = createMockComprehendClient([
                entitySpan(text, "555-0123", "PHONE", 0.99),
            ]);
            const redactor = new AWSComprehendRedactor({ client });
            const endpoint: EndpointLike = {
                chat: async (opts) => ({ text: `LLM saw: ${opts.prompt}` }),
            };

            const pipeline$ = of(text).pipe(
                ComprehendObservable.chainEndpoint<{ text: string }>(redactor, endpoint)
            );

            const out = await firstValueFrom(pipeline$);
            expectFn(out.text).toBe("LLM saw: Phone [PHONE].");
        }
    );

    testFn("should emit redacted prompts from ComprehendObservable.fromPrompts", async () => {
        const client: ComprehendClientLike = {
            detectPiiEntities: async ({ Text }) => {
                if (Text.includes("card@test.com")) {
                    return {
                        Entities: [entitySpan(Text, "card@test.com", "EMAIL", 0.99)],
                    };
                }
                return { Entities: [] };
            },
        };

        const redactor = new AWSComprehendRedactor({ client });
        const prompts = ["Plain prompt", "Secret card@test.com"];

        const list = await firstValueFrom(
            ComprehendObservable.fromPrompts(prompts, redactor).pipe(toArray())
        );

        expectFn(list).toEqual(["Plain prompt", "Secret [EMAIL]"]);
    });

    testFn("should construct ComprehendRedactionChain via ComprehendObservable.createChain", () => {
        const redactor = new AWSComprehendRedactor({
            client: createMockComprehendClient(),
        });
        const endpoint: EndpointLike = { chat: async () => ({}) };

        const chain = ComprehendObservable.createChain(redactor, endpoint);
        expectFn(chain).toBeInstanceOf(ComprehendRedactionChain);
    });
});

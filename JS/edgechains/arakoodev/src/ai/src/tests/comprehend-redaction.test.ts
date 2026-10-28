import axios from "axios";
import { ComprehendRedact, PiiEntity, RedactObservable } from "../lib/comprehend-redaction/redact";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const sample: PiiEntity[] = [
    { BeginOffset: 8, EndOffset: 28, Score: 0.99, Type: "EMAIL" },
    { BeginOffset: 35, EndOffset: 47, Score: 0.98, Type: "PHONE" },
];

const TEXT = "Contact jane.doe@example.com, call 415-555-0132.";

beforeEach(() => {
    jest.clearAllMocks();
    // Mirror the real AWS DetectPiiEntities response shape: the entity list
    // is returned under `Entities` (see AWS API Reference), not `Result`.
    const mockPost = jest.fn().mockResolvedValue({ data: JSON.stringify({ Entities: sample }) });
    mockedAxios.create = jest.fn(() => ({
        post: mockPost,
    })) as unknown as jest.Mock;
});

const creds = {
    accessKeyId: "AKIATEST",
    secretAccessKey: "SECRETTEST",
    region: "us-east-1",
    endpoint: "http://127.0.0.1:9/comprehend/",
};

describe("ComprehendRedact PII redaction & observable chaining (#290)", () => {
    test("detectPii returns entities and signs with SigV4", async () => {
        const r = new ComprehendRedact(creds);
        const entities = await r.detectPii(TEXT);
        expect(entities).toEqual(sample);
        const post = mockedAxios.create().post as jest.Mock;
        const [url, payload, cfg] = post.mock.calls[0];
        expect(url).toBe("http://127.0.0.1:9/comprehend/");
        expect(JSON.parse(payload)).toEqual({ Text: TEXT, LanguageCode: "en" });
        expect(cfg.headers["x-amz-target"]).toBe("AmazonComprehend.DetectPiiEntities");
        expect(cfg.headers["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/);
        expect(cfg.headers.authorization).toMatch(
            /^AWS4-HMAC-SHA256 Credential=AKIATEST\/\d{8}\/us-east-1\/comprehend\/aws4_request, SignedHeaders=.* Signature=[a-f0-9]{64}$/
        );
    });

    test("redactText TAG mode replaces PII with [TYPE] tokens", async () => {
        const r = new ComprehendRedact(creds);
        const out = await r.redactText(TEXT, "TAG");
        expect(out).toBe("Contact [EMAIL], call [PHONE].");
    });

    test("redactText MASK mode replaces PII with *****", async () => {
        const r = new ComprehendRedact(creds);
        const out = await r.redactText(TEXT, "MASK");
        expect(out).toBe("Contact *****, call *****.");
    });

    test("redactText returns input unchanged when no PII found", async () => {
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({ data: JSON.stringify({ Entities: [] }) }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        expect(await r.redactText("no pii here")).toBe("no pii here");
    });

    test("throws a clear error when credentials are missing", async () => {
        process.env.AWS_ACCESS_KEY_ID = "";
        process.env.AWS_SECRET_ACCESS_KEY = "";
        const r = new ComprehendRedact({ endpoint: "http://127.0.0.1:9/" });
        await expect(r.detectPii(TEXT)).rejects.toThrow(/AWS credentials are required/);
    });

    test("redactObservable is thenable, subscribable and async-iterable", async () => {
        const r = new ComprehendRedact(creds);
        const obs: RedactObservable = r.redactObservable(TEXT);
        const viaThen = await obs.then((v) => v);
        expect(viaThen).toBe("Contact [EMAIL], call [PHONE].");
        const viaSubscribe = await new Promise<string>((res) => obs.subscribe(res));
        expect(viaSubscribe).toBe("Contact [EMAIL], call [PHONE].");
        const collected: string[] = [];
        for await (const v of obs) collected.push(v);
        expect(collected).toEqual(["Contact [EMAIL], call [PHONE]."]);
    });

    test("chainWithEndpoint redacts the prompt before calling endpoint.chat", async () => {
        const r = new ComprehendRedact(creds);
        const chat = jest.fn().mockResolvedValue({ content: "ok" });
        const fakeEndpoint = { chat };
        const out = await r.chainWithEndpoint(fakeEndpoint, TEXT, {
            mode: "MASK",
            model: "gpt-4",
        });
        expect(out).toEqual({ content: "ok" });
        expect(chat).toHaveBeenCalledWith({
            prompt: "Contact *****, call *****.",
            model: "gpt-4",
        });
    });

    test("detectPii parses the real AWS Entities response (regression for the Result/Entities bug)", async () => {
        // Real Amazon Comprehend DetectPiiEntities returns the list under `Entities`.
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({ data: JSON.stringify({ Entities: sample }) }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        expect(await r.detectPii(TEXT)).toEqual(sample);
    });

    test("detectPii still accepts a legacy Result-shaped local mock", async () => {
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({ data: JSON.stringify({ Result: sample }) }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        expect(await r.detectPii(TEXT)).toEqual(sample);
    });

    test("detectPii fails closed on an unexpected response shape (no silent passthrough)", async () => {
        // A 200 whose body has no Entities/Result array must throw, not return
        // [] and let the original (un-redacted) text through.
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({ data: JSON.stringify({ Message: "throttled" }) }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        await expect(r.detectPii(TEXT)).rejects.toThrow(/no `Entities`\/`Result` array/);
    });

    test("redactText propagates the fail-closed error instead of returning raw text", async () => {
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({ data: JSON.stringify(null) }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        await expect(r.redactText(TEXT)).rejects.toThrow(/no `Entities`\/`Result` array/);
    });

    test("redactText cuts on code points, so an emoji before the entity does not leak PII", async () => {
        // AWS reports offsets in UTF-8 code points; JS slice() uses UTF-16 units.
        // In "Hola 😀 a@b.cl." the emoji is one code point (index 5) but two
        // UTF-16 units, so "a@b.cl" sits at code points 7..13 but UTF-16 8..14.
        // Slicing at the raw code point offsets would yield "Hola 😀[EMAIL]l."
        // (the final "l" leaks) instead of a clean redaction.
        const uniText = "Hola 😀 a@b.cl.";
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({
                data: JSON.stringify({
                    Entities: [{ BeginOffset: 7, EndOffset: 13, Score: 0.99, Type: "EMAIL" }],
                }),
            }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        expect(await r.redactText(uniText, "TAG")).toBe("Hola 😀 [EMAIL].");
    });

    test("chainWithEndpoint: a prompt key inside opts cannot override the redacted prompt", async () => {
        // If the caller also passes `prompt` inside opts it used to be spread
        // after the redacted prompt and win, sending the un-redacted PII to the
        // endpoint. The redacted prompt must take precedence.
        const nameText = "Ana";
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({
                data: JSON.stringify({
                    Entities: [{ BeginOffset: 0, EndOffset: 3, Score: 0.99, Type: "NAME" }],
                }),
            }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        const chat = jest.fn().mockResolvedValue({ content: "ok" });
        await r.chainWithEndpoint({ chat }, nameText, {
            prompt: nameText,
            model: "gpt-4",
        });
        expect(chat).toHaveBeenCalledWith({ prompt: "[NAME]", model: "gpt-4" });
    });

    test("redactText rejects malformed entity spans instead of leaking raw text (fail closed)", async () => {
        const bad: PiiEntity[] = [
            { BeginOffset: 100, EndOffset: 116, Score: 0.99, Type: "EMAIL" }, // beyond the text
            { BeginOffset: 5, EndOffset: 2, Score: 0.99, Type: "EMAIL" }, // inverted
            { BeginOffset: -1, EndOffset: 5, Score: 0.99, Type: "EMAIL" }, // negative begin
            { BeginOffset: 1.5, EndOffset: 5, Score: 0.99, Type: "EMAIL" }, // fractional
            { BeginOffset: 0, EndOffset: 3, Score: 0.99, Type: "" }, // empty Type
        ];
        for (const e of bad) {
            mockedAxios.create = jest.fn(() => ({
                post: jest.fn().mockResolvedValue({ data: JSON.stringify({ Entities: [e] }) }),
            })) as unknown as jest.Mock;
            const r = new ComprehendRedact(creds);
            await expect(r.redactText("jane@example.com")).rejects.toThrow(/PII entity/);
        }
    });

    test("redactText merges overlapping spans (outer + inner) so no PII leaks", async () => {
        // Reviewer case: ALL [0,10) covering EMAIL [5,6). Applied naively
        // (outer first, on the already-modified string) this yields
        // "[ALL]m"; merged, the whole span is replaced once.
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({
                data: JSON.stringify({
                    Entities: [
                        { BeginOffset: 0, EndOffset: 10, Score: 0.99, Type: "ALL" },
                        { BeginOffset: 5, EndOffset: 6, Score: 0.9, Type: "EMAIL" },
                    ],
                }),
            }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        expect(await r.redactText("0123456789", "TAG")).toBe("[ALL]");
        expect(await r.redactText("0123456789", "MASK")).toBe("*****");
    });

    test("duplicate spans collapse to a single replacement (no index corruption)", async () => {
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({
                data: JSON.stringify({ Entities: [sample[0], sample[0], sample[1]] }),
            }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        expect(await r.redactText(TEXT, "TAG")).toBe("Contact [EMAIL], call [PHONE].");
        expect(await r.redactText(TEXT, "MASK")).toBe("Contact *****, call *****.");
    });

    test("observable failures surface through catch/then and subscribe (no silent success)", async () => {
        mockedAxios.create = jest.fn(() => ({
            post: jest.fn().mockResolvedValue({ data: JSON.stringify({ Message: "throttled" }) }),
        })) as unknown as jest.Mock;
        const r = new ComprehendRedact(creds);
        const obs = r.redactObservable(TEXT);
        // thenable: rejection propagates instead of resolving
        await expect(obs.then((v) => v)).rejects.toThrow(/no `Entities`\/`Result` array/);
        await expect(obs.catch(() => "recovered")).resolves.toBe("recovered");
        // subscribe: onError receives the error, onNext never fires
        const got: unknown[] = [];
        obs.subscribe(
            (v) => got.push(v),
            (e) => got.push(e)
        );
        await new Promise((res) => setTimeout(res, 0));
        expect(got).toHaveLength(1);
        expect(got[0]).toBeInstanceOf(Error);
        // chainWithEndpoint: rejects instead of calling the endpoint with raw text
        const chat = jest.fn().mockResolvedValue({ content: "ok" });
        await expect(r.chainWithEndpoint({ chat }, TEXT)).rejects.toThrow(
            /no `Entities`\/`Result` array/
        );
        expect(chat).not.toHaveBeenCalled();
    });

    test("SigV4 canonicalizes the query string (parameter order must not change the signature)", async () => {
        const authHeaderFor = async (search: string): Promise<string> => {
            const mockPost = jest.fn().mockResolvedValue({
                data: JSON.stringify({ Entities: [] }),
            });
            mockedAxios.create = jest.fn(() => ({ post: mockPost })) as unknown as jest.Mock;
            const r = new ComprehendRedact({
                accessKeyId: "AKIATEST",
                secretAccessKey: "SECRETTEST",
                region: "us-east-1",
                endpoint: `http://127.0.0.1:9/comprehend/${search}`,
            });
            await r.detectPii(TEXT);
            const cfg = mockPost.mock.calls[0][2];
            return cfg.headers.authorization as string;
        };
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-02T03:04:05.678Z"));
        try {
            const a = await authHeaderFor("?z=2&a=1");
            const b = await authHeaderFor("?a=1&z=2");
            expect(a).toMatch(/^AWS4-HMAC-SHA256 .*Signature=[a-f0-9]{64}$/);
            expect(a).toBe(b);
        } finally {
            jest.useRealTimers();
        }
    });

    test("SigV4 preserves a literal '+' in the query (signed value matches the sent value)", async () => {
        const authHeaderFor = async (search: string): Promise<string> => {
            const mockPost = jest.fn().mockResolvedValue({
                data: JSON.stringify({ Entities: [] }),
            });
            mockedAxios.create = jest.fn(() => ({ post: mockPost })) as unknown as jest.Mock;
            const r = new ComprehendRedact({
                accessKeyId: "AKIATEST",
                secretAccessKey: "SECRETTEST",
                region: "us-east-1",
                endpoint: `http://127.0.0.1:9/comprehend/${search}`,
            });
            await r.detectPii(TEXT);
            const cfg = mockPost.mock.calls[0][2];
            return cfg.headers.authorization as string;
        };
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-02T03:04:05.678Z"));
        try {
            // A literal '+' on the wire is a literal '+' under AWS/Smithy query
            // semantics, so it must be signed exactly like its escaped form, and
            // unlike a space (which a naive URLSearchParams parse would conflate).
            const plus = await authHeaderFor("?q=a+b");
            const escapedPlus = await authHeaderFor("?q=a%2Bb");
            const space = await authHeaderFor("?q=a%20b");
            expect(plus).toMatch(/^AWS4-HMAC-SHA256 .*Signature=[a-f0-9]{64}$/);
            expect(plus).toBe(escapedPlus);
            expect(plus).not.toBe(space);
        } finally {
            jest.useRealTimers();
        }
    });
});

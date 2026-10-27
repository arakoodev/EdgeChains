import axios from "axios";
import {
    ComprehendRedact,
    PiiEntity,
    RedactObservable,
} from "../lib/comprehend-redaction/redact";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const sample: PiiEntity[] = [
    { BeginOffset: 8, EndOffset: 28, Score: 0.99, Type: "EMAIL" },
    { BeginOffset: 35, EndOffset: 47, Score: 0.98, Type: "PHONE" },
];

const TEXT = "Contact jane.doe@example.com, call 415-555-0132.";

beforeEach(() => {
    jest.clearAllMocks();
    const mockPost = jest.fn().mockResolvedValue({ data: JSON.stringify({ Result: sample }) });
    mockedAxios.create = jest.fn(() => ({ post: mockPost })) as unknown as jest.Mock;
});

const creds = { accessKeyId: "AKIATEST", secretAccessKey: "SECRETTEST", region: "us-east-1", endpoint: "http://127.0.0.1:9/comprehend/" };

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
        expect(cfg.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIATEST\/\d{8}\/us-east-1\/comprehend\/aws4_request, SignedHeaders=.* Signature=[a-f0-9]{64}$/);
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
        mockedAxios.create = jest.fn(() => ({ post: jest.fn().mockResolvedValue({ data: JSON.stringify({ Result: [] }) }) })) as unknown as jest.Mock;
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
        const out = await r.chainWithEndpoint(fakeEndpoint, TEXT, { mode: "MASK", model: "gpt-4" });
        expect(out).toEqual({ content: "ok" });
        expect(chat).toHaveBeenCalledWith({ prompt: "Contact *****, call *****.", model: "gpt-4" });
    });
});

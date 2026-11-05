import { of, firstValueFrom, toArray } from "rxjs";
import { ComprehendRedactor, ComprehendPiiEntity } from "../../lib/comprehend/comprehend";

const MOCK_ENTITIES: ComprehendPiiEntity[] = [
    { Score: 0.99, Type: "NAME", BeginOffset: 0, EndOffset: 5 },
    { Score: 0.98, Type: "PHONE_NUMBER", BeginOffset: 13, EndOffset: 25 },
    { Score: 0.97, Type: "EMAIL", BeginOffset: 49, EndOffset: 66 },
];

const TEXT = "Alice called +12065550100 about her order, email alice@example.com";

/** controllable fake send() */
let sendImpl: (cmd: unknown) => Promise<{ Entities?: ComprehendPiiEntity[] }>;
let sendCalls = 0;

jest.mock("@aws-sdk/client-comprehend", () => {
    return {
        LanguageCode: {},
        ComprehendClient: jest.fn().mockImplementation(() => ({
            send: (cmd: unknown) => sendImpl(cmd),
        })),
        DetectPiiEntitiesCommand: jest.fn().mockImplementation((input: unknown) => input),
    };
});

const makeRedactor = (opts: Record<string, unknown> = {}) => {
    const r = new ComprehendRedactor(opts as any);
    return r;
};

describe("ComprehendRedactor", () => {
    beforeEach(() => {
        process.env.AWS_ACCESS_KEY_ID = "akid";
        process.env.AWS_SECRET_ACCESS_KEY = "sk";
        sendCalls = 0;
        sendImpl = async () => ({ Entities: MOCK_ENTITIES });
    });

    it("constructs with env credentials and defaults", () => {
        const r = makeRedactor();
        expect(r.accessKeyId).toBe("akid");
        expect(r.region).toBe("us-east-1");
        expect(r.replacement).toBe("[REDACTED]");
    });

    it("detectPii sends DetectPiiEntitiesCommand via the client and returns entities", async () => {
        const r = makeRedactor({ region: "us-west-2" });
        const entities = await r.detectPii(TEXT);
        expect(entities).toHaveLength(3);
    });

    it("redactFromEntities replaces all detected spans", () => {
        const r = makeRedactor();
        const out = r.redactFromEntities(TEXT, MOCK_ENTITIES);
        expect(out).toBe("[REDACTED] called [REDACTED] about her order, email [REDACTED]");
    });

    it("redactFromEntities filters by type when redactTypes set", () => {
        const r = makeRedactor({ redactTypes: ["PHONE_NUMBER"] });
        const out = r.redactFromEntities(TEXT, MOCK_ENTITIES);
        expect(out).toContain("Alice");
        expect(out).not.toContain("+12065550100");
    });

    it("redact() chains detect + replace", async () => {
        const r = makeRedactor();
        const out = await r.redact(TEXT);
        expect(out).toBe("[REDACTED] called [REDACTED] about her order, email [REDACTED]");
    });

    it("redactStream() redacts values flowing through the observable chain", async () => {
        const r = makeRedactor();
        const result = (await firstValueFrom(
            r.redactStream(of(TEXT)).pipe(toArray())
        )) as string[];
        expect(result[0]).not.toContain("Alice");
    });

    it("redactStream() propagates errors", async () => {
        sendImpl = async () => {
            throw new Error("throttled");
        };
        const r = makeRedactor();
        await expect(firstValueFrom(r.redactStream(of(TEXT)))).rejects.toThrow("throttled");
    });
});

import { of, firstValueFrom, toArray } from "rxjs";
import { ComprehendRedactor, ComprehendPiiEntity } from "../lib/comprehend/comprehend";

const MOCK_ENTITIES: ComprehendPiiEntity[] = [
    { Score: 0.99, Type: "NAME", BeginOffset: 0, EndOffset: 5 },
    { Score: 0.98, Type: "PHONE_NUMBER", BeginOffset: 13, EndOffset: 25 },
    { Score: 0.97, Type: "EMAIL", BeginOffset: 49, EndOffset: 66 },
];

const TEXT = "Alice called +12065550100 about her order, email alice@example.com";

/** Fake ComprehendClient with a controllable send() */
const makeFakeClient = (entities: ComprehendPiiEntity[] = MOCK_ENTITIES, failFirst = false) => {
    let calls = 0;
    return {
        send: jest.fn(async (_cmd: unknown) => {
            calls++;
            if (failFirst && calls === 1) throw new Error("throttled");
            return { Entities: entities };
        }),
        calls,
    };
};

describe("ComprehendRedactor", () => {
    beforeEach(() => {
        process.env.AWS_ACCESS_KEY_ID = "akid";
        process.env.AWS_SECRET_ACCESS_KEY = "sk";
        jest.restoreAllMocks();
    });

    it("constructs with env credentials and defaults", () => {
        const r = new ComprehendRedactor({});
        expect(r.accessKeyId).toBe("akid");
        expect(r.region).toBe("us-east-1");
        expect(r.replacement).toBe("[REDACTED]");
    });

    it("detectPii sends DetectPiiEntitiesCommand via the client and returns entities", async () => {
        const fake = makeFakeClient();
        const r = new ComprehendRedactor({ region: "us-west-2" });
        (r as any).injectedClient = fake;
        const entities = await r.detectPii(TEXT);
        expect(fake.send).toHaveBeenCalledTimes(1);
        expect(entities).toHaveLength(3);
    });

    it("redactFromEntities replaces all detected spans", () => {
        const r = new ComprehendRedactor();
        const out = r.redactFromEntities(TEXT, MOCK_ENTITIES);
        expect(out).toBe("[REDACTED] called [REDACTED] about her order, email [REDACTED]");
    });

    it("redactFromEntities filters by type when redactTypes set", () => {
        const r = new ComprehendRedactor({ redactTypes: ["PHONE_NUMBER"] });
        const out = r.redactFromEntities(TEXT, MOCK_ENTITIES);
        expect(out).toContain("Alice");
        expect(out).not.toContain("+12065550100");
    });

    it("redact() chains detect + replace via injected client", async () => {
        const fake = makeFakeClient();
        const r = new ComprehendRedactor();
        (r as any).injectedClient = fake;
        const out = await r.redact(TEXT);
        expect(out).toBe("[REDACTED] called [REDACTED] about her order, email [REDACTED]");
    });

    it("redactStream() redacts values flowing through the observable chain", async () => {
        const fake = makeFakeClient();
        const r = new ComprehendRedactor();
        (r as any).injectedClient = fake;
        const result = await firstValueFrom(r.redactStream(of(TEXT)).pipe(toArray()));
        expect(result[0]).not.toContain("Alice");
    });

    it("redactStream() propagates errors", async () => {
        const fake = makeFakeClient([], true);
        const r = new ComprehendRedactor();
        (r as any).injectedClient = fake;
        await expect(firstValueFrom(r.redactStream(of(TEXT)))).rejects.toThrow("throttled");
    });
});

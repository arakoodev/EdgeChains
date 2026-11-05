import { ComprehendRedactor } from "../lib/comprehend/comprehend";

jest.mock("axios");
import axios from "axios";
const mockedAxios = axios as jest.Mocked<typeof axios>;
import { of } from "rxjs";
import { firstValueFrom, toArray } from "rxjs";

const MOCK_ENTITIES = [
    { Score: 0.99, Type: "NAME", BeginOffset: 0, EndOffset: 5 },      // "Alice"
    { Score: 0.98, Type: "PHONE_NUMBER", BeginOffset: 26, EndOffset: 38 }, // number
    { Score: 0.97, Type: "EMAIL", BeginOffset: 52, EndOffset: 74 },
];

const TEXT = "Alice called +12065550100 about her order, email alice@example.com";

describe("ComprehendRedactor", () => {
    beforeEach(() => {
        mockedAxios.request.mockReset();
        process.env.AWS_ACCESS_KEY_ID = "akid";
        process.env.AWS_SECRET_ACCESS_KEY = "sk";
    });

    it("constructs with env credentials and defaults", () => {
        const r = new ComprehendRedactor({});
        expect(r.accessKeyId).toBe("akid");
        expect(r.region).toBe("us-east-1");
        expect(r.replacement).toBe("[REDACTED]");
    });

    it("detectPii posts DetectPiiEntities to the regional endpoint", async () => {
        mockedAxios.request.mockResolvedValueOnce({ data: { Entities: MOCK_ENTITIES } });
        const r = new ComprehendRedactor({ region: "us-west-2" });
        const entities = await r.detectPii(TEXT);
        const cfg = mockedAxios.request.mock.calls[0][0];
        expect(cfg.url).toContain("comprehend.us-west-2.amazonaws.com");
        expect(cfg.headers["X-Amz-Target"]).toContain("DetectPiiEntities");
        expect(entities).toHaveLength(3);
    });

    it("redactFromEntities replaces all detected spans", () => {
        const r = new ComprehendRedactor();
        const out = r.redactFromEntities(TEXT, MOCK_ENTITIES);
        expect(out).not.toContain("Alice");
        expect(out).not.toContain("+12065550100");
        expect(out).not.toContain("alice@example.com");
        expect(out).toContain("[REDACTED]");
    });

    it("redactFromEntities filters by type when redactTypes set", () => {
        const r = new ComprehendRedactor({ redactTypes: ["PHONE_NUMBER"] });
        const out = r.redactFromEntities(TEXT, MOCK_ENTITIES);
        expect(out).toContain("Alice"); // name kept
        expect(out).not.toContain("+12065550100");
    });

    it("redact() chains detect + replace", async () => {
        mockedAxios.request.mockResolvedValueOnce({ data: { Entities: MOCK_ENTITIES } });
        const r = new ComprehendRedactor();
        const out = await r.redact(TEXT);
        expect(out).toBe("[REDACTED] called [REDACTED] about her order, email [REDACTED]");
    });

    it("redactStream() redacts values flowing through the observable chain", async () => {
        mockedAxios.request.mockResolvedValue({ data: { Entities: MOCK_ENTITIES } });
        const r = new ComprehendRedactor();
        const result = await firstValueFrom(r.redactStream(of(TEXT)).pipe(toArray()));
        expect(result[0]).not.toContain("Alice");
    });

    it("redactStream() propagates errors", async () => {
        mockedAxios.request.mockRejectedValue(new Error("aws down"));
        const r = new ComprehendRedactor();
        await expect(firstValueFrom(r.redactStream(of(TEXT)))).rejects.toThrow("aws down");
    });
});

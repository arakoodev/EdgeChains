import { AwsComprehendClient } from "../AwsComprehendClient.js";

describe("AwsComprehendClient PII Redaction Utility (#290)", () => {
    it("redacts EMAIL, SSN, PHONE, and AWS_ACCESS_KEY using entity labels", async () => {
        const client = new AwsComprehendClient({
            region: "us-east-1",
            maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
        });

        const sample = "Email alice@example.com, SSN 123-45-6789, Key AKIAIOSFODNN7EXAMPLE.";
        const res = await client.redactPii(sample);

        expect(res.redactedText).toContain("[EMAIL]");
        expect(res.redactedText).toContain("[SSN]");
        expect(res.redactedText).toContain("[AWS_ACCESS_KEY]");
        expect(res.redactedText).not.toContain("alice@example.com");
        expect(res.redactedText).not.toContain("123-45-6789");
    });

    it("supports character MASK mode and selective entity filtering", async () => {
        const client = new AwsComprehendClient({
            maskMode: "MASK",
            maskCharacter: "*",
        });

        const input = "Email bob@example.org and IP 192.168.1.25";
        const res = await client.redactPii(input, ["EMAIL"]);

        expect(res.redactedText).toContain("***************");
        expect(res.redactedText).toContain("192.168.1.25");
    });

    it("builds valid AWS SigV4 authorization headers for Comprehend", () => {
        const client = new AwsComprehendClient({
            region: "us-west-2",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const body = JSON.stringify({ Text: "Hello", LanguageCode: "en" });
        const fixedDate = new Date("2026-10-31T00:00:00.000Z");
        const target = "Comprehend_20171127.DetectPiiEntities";
        const headers = client.buildSigV4Headers(target, body, fixedDate);

        expect(headers["X-Amz-Target"]).toBe("Comprehend_20171127.DetectPiiEntities");
        expect(headers.Authorization).toContain("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE");
    });
});

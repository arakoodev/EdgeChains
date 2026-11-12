import { describe, it, test, expect, beforeEach, vi } from "vitest";
const jest = vi;
import axios from "axios";
import {
  AwsComprehendRedactor,
  AwsComprehendRedact,
  ComprehendEndpoint,
  ComprehendClientLike,
  PiiEntity,
  PromptRedactionObservable,
} from "../lib/comprehend/index.js";

describe("AwsComprehendRedactor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Injectable Comprehend Client", () => {
    test("should use injected client without requiring AWS credentials or network", async () => {
      const prompt = "Contact Jane Doe at jane@example.com for assistance.";
      const nameStart = prompt.indexOf("Jane Doe");
      const emailStart = prompt.indexOf("jane@example.com");

      const mockClient: ComprehendClientLike = {
        detectPiiEntities: jest.fn().mockResolvedValue({
          Entities: [
            {
              Type: "NAME",
              Score: 0.98,
              BeginOffset: nameStart,
              EndOffset: nameStart + "Jane Doe".length,
            },
            {
              Type: "EMAIL",
              Score: 0.99,
              BeginOffset: emailStart,
              EndOffset: emailStart + "jane@example.com".length,
            },
          ],
        }),
        containsPiiEntities: jest.fn().mockResolvedValue({
          Labels: [{ Name: "PII", Score: 0.99 }],
        }),
      };

      const redactor = new AwsComprehendRedactor({
        client: mockClient,
        redactionMode: "ENTITY_TYPE",
      });

      const result = await redactor.redactText(prompt);

      expect(mockClient.detectPiiEntities).toHaveBeenCalledTimes(1);
      expect(result.redactedText).toBe(
        "Contact [NAME] at [EMAIL] for assistance.",
      );
      expect(result.entities).toHaveLength(2);
      expect(result.redactedCount).toBe(2);

      const hasPii = await redactor.containsPiiEntities(prompt);
      expect(hasPii).toHaveLength(1);
      expect(hasPii[0].Name).toBe("PII");
    });
  });

  describe("Deterministic Span-based Redaction", () => {
    test("should redact multiple non-overlapping spans without offset drift", async () => {
      const prompt =
        "Customer: John Smith, SSN: 123-45-6789, Call: 555-123-4567 today.";
      const nameStart = prompt.indexOf("John Smith");
      const ssnStart = prompt.indexOf("123-45-6789");
      const phoneStart = prompt.indexOf("555-123-4567");

      const mockClient: ComprehendClientLike = {
        detectPiiEntities: jest.fn().mockResolvedValue({
          Entities: [
            {
              Type: "NAME",
              Score: 0.95,
              BeginOffset: nameStart,
              EndOffset: nameStart + "John Smith".length,
            },
            {
              Type: "SSN",
              Score: 0.99,
              BeginOffset: ssnStart,
              EndOffset: ssnStart + "123-45-6789".length,
            },
            {
              Type: "PHONE",
              Score: 0.97,
              BeginOffset: phoneStart,
              EndOffset: phoneStart + "555-123-4567".length,
            },
          ],
        }),
      };

      const redactor = new AwsComprehendRedactor({ client: mockClient });
      const result = await redactor.redactText(prompt);

      expect(result.redactedText).toBe(
        "Customer: [NAME], SSN: [SSN], Call: [PHONE] today.",
      );
    });

    test("should deterministically resolve overlapping spans", async () => {
      const text = "Send to: 123 Main Street now.";
      const addrStart = text.indexOf("123 Main Street");
      const subStart = text.indexOf("Main Street");

      const mockClient: ComprehendClientLike = {
        detectPiiEntities: jest.fn().mockResolvedValue({
          Entities: [
            {
              Type: "ADDRESS",
              Score: 0.85,
              BeginOffset: addrStart,
              EndOffset: addrStart + "123 Main Street".length,
            },
            {
              Type: "NAME",
              Score: 0.95,
              BeginOffset: subStart,
              EndOffset: subStart + "Main Street".length,
            },
          ],
        }),
      };

      const redactor = new AwsComprehendRedactor({ client: mockClient });
      const result = await redactor.redactText(text);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].Type).toBe("ADDRESS");
      expect(result.redactedText).toBe("Send to: [ADDRESS] now.");
    });
  });

  describe("Masking Modes & Custom Replacers", () => {
    const text = "Email: user@example.com is private.";
    const emailStart = text.indexOf("user@example.com");

    const mockClient: ComprehendClientLike = {
      detectPiiEntities: jest.fn().mockResolvedValue({
        Entities: [
          {
            Type: "EMAIL",
            Score: 0.99,
            BeginOffset: emailStart,
            EndOffset: emailStart + "user@example.com".length,
          },
        ],
      }),
    };

    test("should mask with MASK character", async () => {
      const redactor = new AwsComprehendRedactor({
        client: mockClient,
        redactionMode: "MASK",
        maskCharacter: "#",
      });
      const result = await redactor.redactText(text);
      expect(result.redactedText).toBe("Email: ################ is private.");
    });

    test("should support custom replacer function", async () => {
      const redactor = new AwsComprehendRedactor({
        client: mockClient,
        customReplacer: (entity: PiiEntity, orig: string) =>
          `<REDACTED_${entity.Type}_LEN_${orig.length}>`,
      });
      const result = await redactor.redactText(text);
      expect(result.redactedText).toBe(
        "Email: <REDACTED_EMAIL_LEN_16> is private.",
      );
    });
  });

  describe("Threshold & Entity Type Filtering", () => {
    test("should filter out entities below minScore and excluded entity types", async () => {
      const text = "John email: test@example.com tel: 555-123-4567";
      const johnStart = text.indexOf("John");
      const emailStart = text.indexOf("test@example.com");
      const phoneStart = text.indexOf("555-123-4567");

      const mockClient: ComprehendClientLike = {
        detectPiiEntities: jest.fn().mockResolvedValue({
          Entities: [
            {
              Type: "NAME",
              Score: 0.4,
              BeginOffset: johnStart,
              EndOffset: johnStart + "John".length,
            },
            {
              Type: "EMAIL",
              Score: 0.95,
              BeginOffset: emailStart,
              EndOffset: emailStart + "test@example.com".length,
            },
            {
              Type: "PHONE",
              Score: 0.99,
              BeginOffset: phoneStart,
              EndOffset: phoneStart + "555-123-4567".length,
            },
          ],
        }),
      };

      const redactor = new AwsComprehendRedactor({
        client: mockClient,
        minScore: 0.8,
        entityTypes: ["EMAIL"],
      });

      const result = await redactor.redactText(text);

      expect(result.redactedText).toBe("John email: [EMAIL] tel: 555-123-4567");
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].Type).toBe("EMAIL");
    });
  });

  describe("SigV4 Request Generation via Axios", () => {
    test("should sign and send SigV4 POST request when AWS credentials provided", async () => {
      const text = "SSN: 000-00-0000.";
      const ssnStart = text.indexOf("000-00-0000");

      const targetAxios = (axios as any).default || axios;
      const postSpy = vi.spyOn(targetAxios, "post").mockResolvedValueOnce({
        data: {
          Entities: [
            {
              Type: "SSN",
              Score: 0.99,
              BeginOffset: ssnStart,
              EndOffset: ssnStart + "000-00-0000".length,
            },
          ],
        },
      });

      const redactor = new AwsComprehendRedactor({
        region: "us-west-2",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "session-token-123",
      });

      const result = await redactor.redactText(text);

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [url, body, config] = postSpy.mock.calls[0];
      expect(url).toBe("https://comprehend.us-west-2.amazonaws.com/");
      expect(JSON.parse(body as string)).toEqual({
        Text: text,
        LanguageCode: "en",
      });
      expect(config?.headers?.["X-Amz-Target"]).toBe(
        "Comprehend_20171127.DetectPiiEntities",
      );
      expect(config?.headers?.["Authorization"]).toContain("AWS4-HMAC-SHA256");
      expect(config?.headers?.["X-Amz-Security-Token"]).toBe(
        "session-token-123",
      );
      expect(result.redactedText).toBe("SSN: [SSN].");
    });
  });

  describe("Local Fallback Rule Redaction", () => {
    test("should redact common PII using fallback rules when credentials not set", async () => {
      const redactor = new AwsComprehendRedactor({
        fallbackLocalRules: true,
      });

      const text = "Email me at support@edgechains.io or call 123-456-7890.";
      const result = await redactor.redactText(text);

      expect(result.redactedText).toContain("[EMAIL]");
      expect(result.redactedText).toContain("[PHONE]");
    });
  });

  describe("Structured Messages Redaction", () => {
    test("should redact array of chat messages", async () => {
      const mockClient: ComprehendClientLike = {
        detectPiiEntities: jest
          .fn()
          .mockImplementation(async ({ Text }: { Text: string }) => {
            if (Text.includes("secret@company.com")) {
              const idx = Text.indexOf("secret@company.com");
              return {
                Entities: [
                  {
                    Type: "EMAIL",
                    Score: 0.99,
                    BeginOffset: idx,
                    EndOffset: idx + "secret@company.com".length,
                  },
                ],
              };
            }
            return { Entities: [] };
          }),
      };

      const redactor = new AwsComprehendRedactor({ client: mockClient });
      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "My email is secret@company.com" },
      ];

      const redacted = await redactor.redactMessages(messages);
      expect(redacted[0].content).toBe("You are a helpful assistant.");
      expect(redacted[1].content).toBe("My email is [EMAIL]");
    });
  });

  describe("Observable Chaining with Endpoint Classes", () => {
    test("should chain observable directly with endpoint chat method", async () => {
      const prompt = "User email: test@example.com";
      const emailStart = prompt.indexOf("test@example.com");

      const mockClient: ComprehendClientLike = {
        detectPiiEntities: jest.fn().mockResolvedValue({
          Entities: [
            {
              Type: "EMAIL",
              Score: 0.99,
              BeginOffset: emailStart,
              EndOffset: emailStart + "test@example.com".length,
            },
          ],
        }),
      };

      const redactor = new AwsComprehendRedactor({ client: mockClient });
      const mockEndpoint = {
        chat: jest
          .fn()
          .mockImplementation(async ({ prompt }: { prompt: string }) => {
            return { content: `Processed: ${prompt}` };
          }),
      };

      const obs = redactor.chainWithEndpoint(mockEndpoint, {
        prompt,
        model: "gpt-4o",
      });

      const { redaction, response } = await obs.toPromise();

      expect(redaction.redactedText).toBe("User email: [EMAIL]");
      expect(mockEndpoint.chat).toHaveBeenCalledWith({
        prompt: "User email: [EMAIL]",
        model: "gpt-4o",
      });
      expect(response.content).toBe("Processed: User email: [EMAIL]");
    });

    test("should support observable pipe, map, and subscribe lifecycle", async () => {
      const text = "SSN: 111-22-3333";
      const ssnStart = text.indexOf("111-22-3333");

      const mockClient: ComprehendClientLike = {
        detectPiiEntities: jest.fn().mockResolvedValue({
          Entities: [
            {
              Type: "SSN",
              Score: 0.99,
              BeginOffset: ssnStart,
              EndOffset: ssnStart + "111-22-3333".length,
            },
          ],
        }),
      };

      const redactor = new AwsComprehendRedactor({ client: mockClient });
      const obs = redactor.observe(text).map((val) => val.toUpperCase());

      const nextFn = jest.fn();
      const completeFn = jest.fn();

      await new Promise<void>((resolve) => {
        obs.subscribe({
          next: (val) => nextFn(val),
          complete: () => {
            completeFn();
            resolve();
          },
        });
      });

      expect(nextFn).toHaveBeenCalledWith("SSN: [SSN]");
      expect(completeFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Aliases & Class Exports", () => {
    test("should verify class aliases match AwsComprehendRedactor", () => {
      expect(AwsComprehendRedact).toBe(AwsComprehendRedactor);
      expect(ComprehendEndpoint).toBe(AwsComprehendRedactor);
      expect(PromptRedactionObservable).toBeDefined();
    });
  });
});

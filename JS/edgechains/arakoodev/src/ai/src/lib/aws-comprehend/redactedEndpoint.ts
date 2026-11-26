import type { AwsComprehend } from "./comprehend.js";

interface ChatEndpoint {
  chat: (options: any) => Promise<any>;
}

interface RedactedEndpointOptions {
  /** Also redact the messages of chat calls. Defaults to true. */
  redactMessages?: boolean;
}

/**
 * An Endpoint class that chains an `AwsComprehend` redactor in front of
 * any existing Endpoint class (OpenAI, GeminiAI, LlamaAI, ...).
 *
 * The wrapped endpoint keeps its own `chat` signature and behaviour; this
 * class only redacts the prompt (and, by default, the message contents)
 * with Amazon Comprehend before the call is delegated, so sensitive
 * information is never sent to the underlying model provider.
 *
 * @example
 * const redactedOpenAI = new ComprehendRedactedEndpoint(
 *     new OpenAI({ apiKey: "..." }),
 *     new AwsComprehend({ region: "us-east-1" })
 * );
 * const response = await redactedOpenAI.chat({
 *     prompt: "Email John Doe at john@example.com about his order",
 * });
 */
export class ComprehendRedactedEndpoint<T extends ChatEndpoint = ChatEndpoint> {
  endpoint: T;
  redactor: AwsComprehend;
  redactMessagesEnabled: boolean;

  constructor(
    endpoint: T,
    redactor: AwsComprehend,
    options: RedactedEndpointOptions = {},
  ) {
    this.endpoint = endpoint;
    this.redactor = redactor;
    this.redactMessagesEnabled = options.redactMessages !== false;
  }

  async chat(chatOptions: any): Promise<any> {
    const redactedOptions = { ...chatOptions };
    if (typeof redactedOptions.prompt === "string") {
      const { redactedText } = await this.redactor.redactPii(
        redactedOptions.prompt,
      );
      redactedOptions.prompt = redactedText;
    }
    if (this.redactMessagesEnabled && Array.isArray(redactedOptions.messages)) {
      redactedOptions.messages = await this.redactor.redactMessages(
        redactedOptions.messages,
      );
    }
    return this.endpoint.chat(redactedOptions);
  }
}

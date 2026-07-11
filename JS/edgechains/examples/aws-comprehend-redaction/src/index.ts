import {
    ComprehendPiiRedactor,
    type ChatEndpoint,
    type ComprehendClientLike,
    type RedactableChatOptions,
} from "@arakoodev/edgechains.js/ai";
import type { PiiEntity } from "@aws-sdk/client-comprehend";
import { firstValueFrom, of } from "rxjs";

class DemoEndpoint implements ChatEndpoint<
    RedactableChatOptions,
    { content: string }
> {
    async chat(options: RedactableChatOptions): Promise<{ content: string }> {
        return {
            content: `Endpoint received: ${options.prompt ?? ""}`,
        };
    }
}

function codePointOffset(text: string, value: string): number {
    const utf16Offset = text.indexOf(value);
    return Array.from(text.slice(0, utf16Offset)).length;
}

function createOfflineClient(): ComprehendClientLike {
    return {
        async send(command) {
            const text = command.input.Text ?? "";
            const email = "jane@example.com";
            const phone = "555-010-1234";
            const entities: PiiEntity[] = [email, phone]
                .filter((value) => text.includes(value))
                .map((value) => {
                    const begin = codePointOffset(text, value);
                    return {
                        Type: value === email ? "EMAIL" : "PHONE",
                        Score: 0.999,
                        BeginOffset: begin,
                        EndOffset: begin + Array.from(value).length,
                    };
                });

            return { Entities: entities };
        },
    };
}

const useRealAws = process.env.USE_REAL_AWS === "true";
const redactor = new ComprehendPiiRedactor({
    client: useRealAws ? undefined : createOfflineClient(),
    region: process.env.AWS_REGION ?? "us-east-1",
    languageCode: "en",
    minScore: 0.8,
});

const endpoint = new DemoEndpoint();
const input = {
    prompt: "🔒 Please contact jane@example.com or call 555-010-1234.",
};

const response = await firstValueFrom(
    of(input).pipe(redactor.endpointOperator(endpoint))
);

console.log("Original:", input.prompt);
console.log(response.content);

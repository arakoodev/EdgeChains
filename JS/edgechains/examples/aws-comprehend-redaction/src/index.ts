import { ComprehendPiiRedactor, type ComprehendClientLike } from "@arakoodev/edgechains.js/ai";
import { firstValueFrom, of } from "rxjs";

const prompt = "🔒 Contact jane@example.com or SSN 123-45-6789 before sharing this prompt.";
const email = "jane@example.com";
const ssn = "123-45-6789";

function spanFor(text: string, needle: string, type: string) {
    const idx = text.indexOf(needle);
    const begin = Array.from(text.slice(0, idx)).length;
    return {
        Type: type,
        Score: 0.999,
        BeginOffset: begin,
        EndOffset: begin + Array.from(needle).length,
    };
}

const offlineClient: ComprehendClientLike = {
    async detectPiiEntities({ Text }) {
        return {
            Entities: [spanFor(Text, email, "EMAIL"), spanFor(Text, ssn, "SSN")],
        };
    },
};

const redactor = new ComprehendPiiRedactor({
    client: offlineClient,
    languageCode: "en",
    confidenceThreshold: 0.8,
    maskMode: "ENTITY_TYPE",
});

const endpoint = {
    async chat(options: { prompt: string }) {
        return `Endpoint received: ${options.prompt}`;
    },
};

console.log("Original:", prompt);
console.log(await firstValueFrom(of({ prompt }).pipe(redactor.endpointOperator(endpoint))));

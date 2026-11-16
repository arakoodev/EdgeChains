import { of } from "rxjs";
import { ComprehendRedactor, ComprehendClientLike } from "../../lib/redactor/ComprehendRedactor";

async function runComprehendRedactorDemo() {
    const client: ComprehendClientLike = {
        async detectPiiEntities({ Text }) {
            const entities = [];
            const emailMatch = Text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch && emailMatch.index !== undefined) {
                entities.push({
                    Type: "EMAIL",
                    Score: 0.99,
                    BeginOffset: emailMatch.index,
                    EndOffset: emailMatch.index + emailMatch[0].length,
                });
            }
            return { Entities: entities };
        },
    };

    const redactor = new ComprehendRedactor(client, "en", 0.75);
    redactor.chainObservable(of("Customer support transcript for alice.smith@enterprise.io")).subscribe((sanitized) => {
        console.log("Sanitized Prompt:", sanitized);
    });
}

runComprehendRedactorDemo().catch(console.error);

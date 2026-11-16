import { of, firstValueFrom } from "rxjs";
import { ComprehendRedactor, ComprehendClientLike } from "../lib/redactor/ComprehendRedactor";

describe("ComprehendRedactor (#290)", () => {
    it("redacts PII spans via AWS Comprehend and chains with RxJS Observable endpoints", async () => {
        const mockClient: ComprehendClientLike = {
            async detectPiiEntities({ Text }) {
                const idx = Text.indexOf("john@example.com");
                return {
                    Entities: idx >= 0 ? [{ Type: "EMAIL", Score: 0.99, BeginOffset: idx, EndOffset: idx + 16 }] : [],
                };
            },
        };
        const redactor = new ComprehendRedactor(mockClient);
        const out = await firstValueFrom(redactor.chainObservable(of("Contact john@example.com for details.")));
        expect(out).toBe("Contact [REDACTED_EMAIL] for details.");
    });
});

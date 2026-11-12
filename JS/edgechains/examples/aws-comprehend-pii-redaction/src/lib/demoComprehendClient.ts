import type { ComprehendClientLike } from "@arakoodev/edgechains.js/ai";

type DemoEntity = {
    Score: number;
    Type: string;
    BeginOffset: number;
    EndOffset: number;
};

const DEMO_PATTERNS: Array<{ type: string; regex: RegExp }> = [
    { type: "EMAIL", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: "PHONE", regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
    { type: "CREDIT_DEBIT_NUMBER", regex: /\b\d{13,16}\b/g },
    {
        type: "NAME",
        regex: /\b(?:Alice|Bob|Jane|John|Johnson|Smith|Stiles)(?:\s+(?:Alice|Bob|Jane|John|Johnson|Smith|Stiles))?\b/g,
    },
];

export function detectDemoPii(text: string): DemoEntity[] {
    const entities: DemoEntity[] = [];
    for (const pattern of DEMO_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            entities.push({
                Score: 0.99,
                Type: pattern.type,
                BeginOffset: match.index,
                EndOffset: match.index + match[0].length,
            });
        }
    }
    return entities.sort((left, right) => left.BeginOffset - right.BeginOffset);
}

function commandName(command: unknown): string {
    return command && typeof command === "object" && command.constructor
        ? command.constructor.name
        : "";
}

function commandText(command: unknown): string {
    if (
        command &&
        typeof command === "object" &&
        "input" in command &&
        command.input &&
        typeof command.input === "object" &&
        "Text" in command.input
    ) {
        return String((command.input as { Text?: string }).Text || "");
    }
    return "";
}

/**
 * Local stand-in for Amazon Comprehend so the example runs without AWS keys.
 * It answers both `ContainsPiiEntities` (labels) and `DetectPiiEntities` (offsets).
 */
export function createDemoComprehendClient(): ComprehendClientLike {
    return {
        send: async (command: unknown) => {
            const text = commandText(command);
            const entities = detectDemoPii(text);
            if (commandName(command) === "ContainsPiiEntitiesCommand") {
                const labels = [...new Set(entities.map((entity) => entity.Type))].map((Name) => ({
                    Name,
                    Score: 0.99,
                }));
                return { Labels: labels };
            }
            return { Entities: entities };
        },
    };
}

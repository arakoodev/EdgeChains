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
    { type: "NAME", regex: /\b(?:Alice|Bob|John|Jane|Johnson|Smith)\b/g },
];

function detectDemoPii(text: string): DemoEntity[] {
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
    return entities.sort((a, b) => a.BeginOffset - b.BeginOffset);
}

function createDemoComprehendClient() {
    return {
        send: async (command: { input?: { Text?: string } }) => {
            const text = command.input?.Text || "";
            return { Entities: detectDemoPii(text) };
        },
    };
}

module.exports = { createDemoComprehendClient, detectDemoPii };

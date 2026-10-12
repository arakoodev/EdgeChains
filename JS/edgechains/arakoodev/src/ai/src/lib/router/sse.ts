async function* toAsyncText(input: unknown): AsyncGenerator<string> {
    if (typeof input === "string") {
        yield input;
        return;
    }

    if (input instanceof Uint8Array) {
        yield new TextDecoder().decode(input);
        return;
    }

    const maybeReadable = input as { getReader?: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } };
    if (maybeReadable?.getReader) {
        const reader = maybeReadable.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) yield decoder.decode(value, { stream: true });
        }
        return;
    }

    const maybeAsync = input as AsyncIterable<unknown>;
    if (maybeAsync?.[Symbol.asyncIterator]) {
        for await (const chunk of maybeAsync) {
            if (typeof chunk === "string") {
                yield chunk;
            } else if (chunk instanceof Uint8Array) {
                yield new TextDecoder().decode(chunk);
            } else if (typeof (chunk as { toString?: () => string })?.toString === "function") {
                yield (chunk as { toString: () => string }).toString();
            } else {
                yield String(chunk);
            }
        }
        return;
    }

    if (input != null) yield String(input);
}

export async function* parseSSE(input: unknown): AsyncGenerator<unknown> {
    let buffer = "";

    for await (const text of toAsyncText(input)) {
        buffer += text;
        const events = buffer.split(/\n\s*\n/);
        buffer = events.pop() ?? "";

        for (const event of events) {
            const data = event
                .split(/\r?\n/)
                .filter((line) => line.trim().startsWith("data:"))
                .map((line) => line.replace(/^\s*data:\s?/, ""))
                .join("\n")
                .trim();

            if (!data || data === "[DONE]") continue;
            try {
                yield JSON.parse(data);
            } catch {
                yield data;
            }
        }
    }

    const tail = buffer.trim();
    if (!tail) return;

    for (const line of tail.split(/\r?\n/)) {
        const cleaned = line.replace(/^\s*data:\s?/, "").trim();
        if (!cleaned || cleaned === "[DONE]") continue;
        try {
            yield JSON.parse(cleaned);
        } catch {
            yield cleaned;
        }
    }
}

export async function* parseJsonLines(input: unknown): AsyncGenerator<unknown> {
    let buffer = "";

    for await (const text of toAsyncText(input)) {
        buffer += text;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "[DONE]") continue;
            try {
                yield JSON.parse(trimmed);
            } catch {
                yield trimmed;
            }
        }
    }

    const tail = buffer.trim();
    if (!tail || tail === "[DONE]") return;
    try {
        yield JSON.parse(tail);
    } catch {
        yield tail;
    }
}

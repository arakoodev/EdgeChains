// Minimal Server-Sent Events parser. We deliberately avoid pulling
// `eventsource-parser` here so the SDK stays dep-light; the protocol is
// small enough to handle inline.
//
// Accepts either a Node Readable stream (axios responseType: "stream") or any
// AsyncIterable<Buffer | Uint8Array | string>.

export interface SSEEvent {
    event?: string;
    data: string;
    id?: string;
}

type Source = AsyncIterable<Buffer | Uint8Array | string> | NodeJS.ReadableStream;

async function* toAsyncIterable(src: Source): AsyncIterable<string> {
    // Node Readable streams are AsyncIterable in modern Node, but we coerce
    // explicitly so callers don't have to care.
    const it: AsyncIterable<any> =
        typeof (src as any)[Symbol.asyncIterator] === "function"
            ? (src as AsyncIterable<any>)
            : (async function* () {
                  // Fallback: treat as a Readable in flowing mode
                  for await (const chunk of src as any) yield chunk;
              })();

    for await (const chunk of it) {
        if (typeof chunk === "string") yield chunk;
        else if (chunk instanceof Uint8Array) yield Buffer.from(chunk).toString("utf8");
        else yield String(chunk);
    }
}

export async function* parseSSE(src: Source): AsyncGenerator<SSEEvent> {
    let buf = "";
    let event: string | undefined;
    let dataLines: string[] = [];
    let id: string | undefined;

    const flush = (): SSEEvent | null => {
        if (dataLines.length === 0 && !event) return null;
        const ev: SSEEvent = { data: dataLines.join("\n") };
        if (event) ev.event = event;
        if (id) ev.id = id;
        event = undefined;
        dataLines = [];
        id = undefined;
        return ev;
    };

    for await (const piece of toAsyncIterable(src)) {
        buf += piece;
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            // Strip a trailing \r from CRLF line endings.
            if (line.endsWith("\r")) line = line.slice(0, -1);

            if (line === "") {
                const ev = flush();
                if (ev) yield ev;
                continue;
            }
            if (line.startsWith(":")) continue; // comment
            const colon = line.indexOf(":");
            const field = colon === -1 ? line : line.slice(0, colon);
            // SSE spec: a single leading space after the colon is stripped.
            let value = colon === -1 ? "" : line.slice(colon + 1);
            if (value.startsWith(" ")) value = value.slice(1);

            if (field === "data") dataLines.push(value);
            else if (field === "event") event = value;
            else if (field === "id") id = value;
        }
    }

    // Flush any trailing event without a terminating blank line.
    const tail = flush();
    if (tail) yield tail;
}

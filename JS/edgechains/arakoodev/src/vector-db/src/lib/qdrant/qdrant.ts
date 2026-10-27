export type QdrantPointId = number | string;
export type QdrantJson =
    null | boolean | number | string | QdrantJson[] | { [key: string]: QdrantJson };
export type QdrantPayload = { [key: string]: QdrantJson };
export type QdrantVector = number[] | Record<string, number[]>;
export interface QdrantVectorConfig {
    size: number;
    distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}
export interface QdrantPoint {
    id: QdrantPointId;
    vector?: QdrantVector | null;
    payload?: QdrantPayload | null;
}
export interface QdrantScoredPoint extends QdrantPoint {
    score: number;
}
export interface QdrantUpdate {
    operation_id?: number | null;
    status: string;
}
export interface QdrantOptions {
    url: string;
    apiKey?: string;
    timeoutMs?: number;
    /** Optional transport injection for tests or compatible fetch implementations. */
    fetch?: typeof globalThis.fetch;
}
export interface QdrantQuery {
    vector: number[];
    using?: string;
    limit?: number;
    filter?: QdrantPayload;
    scoreThreshold?: number;
    withPayload?: boolean;
    withVector?: boolean;
}
export interface QdrantScrollOptions {
    limit?: number;
    offset?: QdrantPointId;
    filter?: QdrantPayload;
    withPayload?: boolean;
    withVector?: boolean;
}

export class QdrantError extends Error {
    constructor(
        message: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = "QdrantError";
    }
}

function object(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function positiveInteger(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value <= 0)
        throw new TypeError(`${name} must be a positive safe integer`);
}
function pointId(value: unknown): value is QdrantPointId {
    return (
        (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ||
        (typeof value === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    );
}
function ids(values: QdrantPointId[]): void {
    if (
        !Array.isArray(values) ||
        !values.length ||
        Array.from(values).some((value) => !pointId(value))
    ) {
        throw new TypeError(
            "Point IDs must be a nonempty array of safe nonnegative integers or UUID strings"
        );
    }
}
function denseVector(value: unknown): asserts value is number[] {
    if (!Array.isArray(value) || value.length === 0)
        throw new TypeError("A dense vector must be a nonempty array");
    for (const part of value)
        if (typeof part !== "number" || !Number.isFinite(part)) {
            throw new TypeError("Vector values must be finite numbers");
        }
}
function validateVector(value: QdrantVector): void {
    if (Array.isArray(value)) return denseVector(value);
    if (!object(value) || Object.keys(value).length === 0)
        throw new TypeError("Named vectors must not be empty");
    for (const [name, vector] of Object.entries(value)) {
        if (!name) throw new TypeError("Named vector names must not be empty");
        denseVector(vector);
    }
}
function points(value: unknown, scored = false): QdrantPoint[] {
    if (
        !Array.isArray(value) ||
        value.some(
            (p) =>
                !object(p) ||
                !pointId(p.id) ||
                (scored && (typeof p.score !== "number" || !Number.isFinite(p.score)))
        )
    ) {
        throw new QdrantError("Invalid Qdrant point response");
    }
    return value as QdrantPoint[];
}

/** REST-only dense-vector client. Uses the Query API available in Qdrant 1.10+. */
export class Qdrant {
    readonly #url: string;
    readonly #apiKey?: string;
    readonly #timeoutMs: number;
    readonly #fetch: typeof globalThis.fetch;

    constructor(options: QdrantOptions) {
        const url = new URL(options.url);
        if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
        ) {
            throw new TypeError(
                "Qdrant URL must be HTTP(S) without credentials, query or fragment"
            );
        }
        this.#url = url.href.replace(/\/+$/, "");
        this.#apiKey = options.apiKey;
        this.#timeoutMs = options.timeoutMs ?? 30000;
        positiveInteger(this.#timeoutMs, "timeoutMs");
        if (this.#timeoutMs > 2147483647) throw new TypeError("timeoutMs exceeds the timer limit");
        if (options.apiKey !== undefined && /[\r\n]/.test(options.apiKey))
            throw new TypeError("Invalid API key header");
        const fetcher = options.fetch ?? globalThis.fetch;
        if (typeof fetcher !== "function")
            throw new TypeError("Qdrant requires a fetch implementation (Node 18+)");
        this.#fetch = fetcher.bind(globalThis);
    }

    private path(collection: string, suffix = ""): string {
        if (
            typeof collection !== "string" ||
            !collection.trim() ||
            [".", ".."].includes(collection)
        ) {
            throw new TypeError("A collection name is required");
        }
        return `/collections/${encodeURIComponent(collection)}${suffix}`;
    }

    private async request(method: string, path: string, body?: unknown): Promise<unknown> {
        // Serialize before starting a timer. A failed write is never automatically replayed.
        const data =
            body === undefined
                ? undefined
                : JSON.stringify(body, (_key, value) => {
                      if (typeof value === "number" && !Number.isFinite(value))
                          throw new TypeError("JSON numbers must be finite");
                      return value;
                  });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
        try {
            const response = await this.#fetch(this.#url + path, {
                method,
                body: data,
                signal: controller.signal,
                redirect: "error",
                headers: {
                    Accept: "application/json",
                    ...(data === undefined ? {} : { "Content-Type": "application/json" }),
                    ...(this.#apiKey === undefined ? {} : { "api-key": this.#apiKey }),
                },
            });
            if (!response.ok) {
                await response.body?.cancel();
                throw new QdrantError(
                    `Qdrant request failed (HTTP ${response.status})`,
                    response.status
                );
            }
            let envelope: unknown;
            try {
                envelope = await response.json();
            } catch {
                throw new QdrantError("Qdrant returned invalid JSON");
            }
            if (!object(envelope) || envelope.status !== "ok" || !("result" in envelope)) {
                throw new QdrantError("Qdrant returned an unsuccessful or invalid response");
            }
            return envelope.result;
        } catch (error) {
            if (controller.signal.aborted)
                throw new QdrantError(
                    "Qdrant request timed out; a write may already have been applied"
                );
            if (error instanceof QdrantError) throw error;
            // Do not interpolate transport errors, URLs, keys or remote response bodies.
            throw new QdrantError("Qdrant transport failed; a write may already have been applied");
        } finally {
            clearTimeout(timeout);
        }
    }

    private async update(path: string, body: unknown): Promise<QdrantUpdate> {
        const result = await this.request("POST", path + "?wait=true", body);
        return this.updateResult(result);
    }
    private updateResult(result: unknown): QdrantUpdate {
        if (!object(result) || !["acknowledged", "completed"].includes(result.status as string))
            throw new QdrantError("Invalid or rejected Qdrant update response");
        return result as unknown as QdrantUpdate;
    }

    async createCollection(
        collection: string,
        vectors: QdrantVectorConfig | Record<string, QdrantVectorConfig>
    ): Promise<boolean> {
        const path = this.path(collection);
        const configs =
            object(vectors) && typeof vectors.size === "number"
                ? [vectors]
                : Object.values(vectors);
        if (!configs.length) throw new TypeError("At least one vector configuration is required");
        for (const config of configs) {
            if (!object(config)) throw new TypeError("Invalid vector configuration");
            positiveInteger(config.size as number, "Vector size");
            if (!["Cosine", "Euclid", "Dot", "Manhattan"].includes(config.distance as string))
                throw new TypeError("Invalid distance");
        }
        const result = await this.request("PUT", path, { vectors });
        if (typeof result !== "boolean")
            throw new QdrantError("Invalid Qdrant collection response");
        return result;
    }

    async getCollection(collection: string): Promise<Record<string, unknown>> {
        const result = await this.request("GET", this.path(collection));
        if (!object(result)) throw new QdrantError("Invalid Qdrant collection response");
        return result;
    }

    async deleteCollection(collection: string): Promise<boolean> {
        const result = await this.request("DELETE", this.path(collection));
        if (typeof result !== "boolean")
            throw new QdrantError("Invalid Qdrant collection response");
        return result;
    }

    async upsertPoints(
        collection: string,
        values: (QdrantPoint & { vector: QdrantVector })[]
    ): Promise<QdrantUpdate> {
        const path = this.path(collection, "/points?wait=true");
        if (!Array.isArray(values) || !values.length)
            throw new TypeError("Points must not be empty");
        for (const point of values) {
            if (!object(point) || !pointId(point.id)) throw new TypeError("Invalid point ID");
            validateVector(point.vector);
        }
        return this.updateResult(await this.request("PUT", path, { points: values }));
    }

    async query(collection: string, options: QdrantQuery): Promise<QdrantScoredPoint[]> {
        const path = this.path(collection, "/points/query");
        denseVector(options.vector);
        positiveInteger(options.limit ?? 10, "limit");
        if (options.scoreThreshold !== undefined && !Number.isFinite(options.scoreThreshold))
            throw new TypeError("Invalid score threshold");
        const result = await this.request("POST", path, {
            query: options.vector,
            using: options.using,
            filter: options.filter,
            limit: options.limit ?? 10,
            score_threshold: options.scoreThreshold,
            with_payload: options.withPayload ?? true,
            with_vector: options.withVector ?? false,
        });
        if (!object(result)) throw new QdrantError("Invalid Qdrant query response");
        return points(result.points, true) as QdrantScoredPoint[];
    }

    async retrievePoints(
        collection: string,
        pointIds: QdrantPointId[],
        withVector = false
    ): Promise<QdrantPoint[]> {
        const path = this.path(collection, "/points");
        ids(pointIds);
        return points(
            await this.request("POST", path, {
                ids: pointIds,
                with_payload: true,
                with_vector: withVector,
            })
        );
    }

    async scroll(
        collection: string,
        options: QdrantScrollOptions = {}
    ): Promise<{ points: QdrantPoint[]; nextPageOffset: QdrantPointId | null }> {
        const path = this.path(collection, "/points/scroll");
        positiveInteger(options.limit ?? 10, "limit");
        if (options.offset !== undefined && !pointId(options.offset))
            throw new TypeError("Invalid scroll offset");
        const result = await this.request("POST", path, {
            limit: options.limit ?? 10,
            offset: options.offset,
            filter: options.filter,
            with_payload: options.withPayload ?? true,
            with_vector: options.withVector ?? false,
        });
        if (
            !object(result) ||
            (result.next_page_offset !== null && !pointId(result.next_page_offset))
        ) {
            throw new QdrantError("Invalid Qdrant scroll response");
        }
        return {
            points: points(result.points),
            nextPageOffset: result.next_page_offset as QdrantPointId | null,
        };
    }

    async setPayload(
        collection: string,
        pointIds: QdrantPointId[],
        payload: QdrantPayload
    ): Promise<QdrantUpdate> {
        const path = this.path(collection, "/points/payload");
        ids(pointIds);
        if (!object(payload)) throw new TypeError("Payload must be an object");
        return this.update(path, { points: pointIds, payload });
    }

    async deletePoints(collection: string, pointIds: QdrantPointId[]): Promise<QdrantUpdate> {
        const path = this.path(collection, "/points/delete");
        ids(pointIds);
        return this.update(path, { points: pointIds });
    }
}

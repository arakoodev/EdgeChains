import axios from "axios";
import { ChatModel, role } from "../../types/index.js";

const openAI_url = "https://api.openai.com/v1/chat/completions";

interface Text2SqlConstructionOptions {
    apiKey?: string;
    orgId?: string;
}

interface Text2SqlMessage {
    role: role;
    content: string;
}

interface Text2SqlOptions {
    /** Natural-language question to translate into SQL. */
    question: string;
    /** Database schema as DDL (CREATE TABLE ...) or a free-form table description. */
    schema: string;
    /** Optional dialect hint, e.g. "PostgreSQL", "MySQL", "SQLite". */
    dialect?: string;
    /** Optional model override. */
    model?: ChatModel;
    /** Optional maximum tokens for the generated query. */
    max_tokens?: number;
    /** Optional temperature override (defaults low for deterministic SQL). */
    temperature?: number;
    /** Number of schema rows to limit the query to (injected as a hint). */
    rowLimit?: number;
}

interface Text2SqlResult {
    /** The raw SQL query returned by the model. */
    sql: string;
    /** The SQL query after sanitization (markdown fences stripped, trailing semicolons normalized). */
    sanitizedSql: string;
    /** True when the sanitized query passed the validation step. */
    valid: boolean;
    /** Validation warnings / errors, if any. */
    warnings: string[];
}

/**
 * Text2SqlChain
 *
 * A natural-language → SQL chain that mirrors the provider pattern used by the
 * other EdgeChains AI providers (see `lib/openai/openai.ts`). Given a user
 * question and a database schema, it asks the LLM to produce a SQL query and
 * then runs an optional sanitize/validate step to clean up the model output and
 * guard against obviously unsafe statements.
 *
 * Reference: https://arxiv.org/abs/2305.11853 (DIN-SQL / text-to-SQL)
 */
export class Text2SqlChain {
    apiKey: string;
    orgId: string;

    constructor(options: Text2SqlConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
        this.orgId = options.orgId || process.env.OPENAI_ORG_ID || "";
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid OpenAI API key. You can add it in .env file as OPENAI_API_KEY"
            );
        }
    }

    /**
     * Build the system + user prompt that instructs the model to convert a
     * natural-language question into a single SQL statement.
     */
    private buildMessages(opts: Text2SqlOptions): Text2SqlMessage[] {
        const dialect = opts.dialect || "standard SQL";
        const rowLimitHint = opts.rowLimit
            ? `\nUnless the question asks for all rows, limit results to at most ${opts.rowLimit} rows.`
            : "";

        const systemPrompt = `You are an expert text-to-SQL translator. Given a relational database schema and a natural-language question, return a single, syntactically correct ${dialect} SQL query that answers the question.
Rules:
- Output ONLY the SQL query, with no explanation, no markdown, and no surrounding prose.
- Use only the tables and columns present in the provided schema.
- Prefer explicit column lists over SELECT *.
- Quote identifiers only when required by the ${dialect} dialect.${rowLimitHint}`;

        const userPrompt = `Database schema:
-------
${opts.schema}
-------

Question:
${opts.question}

SQL query:`;

        return [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ];
    }

    /**
     * Generate a SQL query for the given question + schema.
     */
    async generateSql(opts: Text2SqlOptions): Promise<Text2SqlResult> {
        const messages = this.buildMessages(opts);

        const response = await axios
            .post(
                openAI_url,
                {
                    model: opts.model || "gpt-3.5-turbo",
                    messages,
                    max_tokens: opts.max_tokens || 512,
                    temperature: opts.temperature ?? 0,
                    frequency_penalty: 0,
                },
                {
                    headers: {
                        Authorization: "Bearer " + this.apiKey,
                        "content-type": "application/json",
                        "OpenAI-Organization": this.orgId,
                    },
                }
            )
            .then((res) => res.data.choices)
            .catch((error) => {
                if (error.response) {
                    console.log(
                        "Server responded with status code:",
                        error.response.status
                    );
                    console.log("Response data:", error.response.data);
                } else if (error.request) {
                    console.log("No response received:", error);
                } else {
                    console.log("Error creating request:", error.message);
                }
                throw error;
            });

        const rawSql: string = response?.[0]?.message?.content ?? "";
        const sanitizedSql = this.sanitize(rawSql);
        const validation = this.validate(sanitizedSql);

        return {
            sql: rawSql,
            sanitizedSql,
            valid: validation.valid,
            warnings: validation.warnings,
        };
    }

    /**
     * Sanitize the raw model output into a clean SQL string.
     * - Strips markdown code fences (```sql ... ```).
     * - Removes leading/trailing whitespace.
     * - Collapses a trailing semicolon to a single one.
     */
    sanitize(rawSql: string): string {
        if (!rawSql) return "";
        let sql = rawSql.trim();

        // Strip markdown code fences if present.
        const fenceMatch = sql.match(/```(?:sql)?\s*([\s\S]*?)```/i);
        if (fenceMatch) {
            sql = fenceMatch[1].trim();
        }

        // Remove any stray leading label like "SQL:" or "Query:".
        sql = sql.replace(/^(sql|query)\s*:\s*/i, "").trim();

        // Normalize trailing whitespace + semicolons to a single semicolon.
        sql = sql.replace(/;*\s*$/, ";");

        return sql;
    }

    /**
     * Validate a sanitized SQL query. This is a lightweight, defensive check —
     * it does not execute the query. It flags obviously destructive statements
     * and empty output.
     */
    validate(sql: string): { valid: boolean; warnings: string[] } {
        const warnings: string[] = [];
        const trimmed = sql.trim();

        if (!trimmed || trimmed === ";") {
            return { valid: false, warnings: ["Generated query is empty."] };
        }

        // Only allow statements that start with a read-only keyword.
        const allowedStarts = /^(select|with|explain)\b/i;
        if (!allowedStarts.test(trimmed)) {
            warnings.push(
                "Query does not start with a read-only keyword (SELECT/WITH/EXPLAIN)."
            );
        }

        // Block obviously destructive keywords.
        const forbidden =
            /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+table|drop\s+database|alter\s+table|truncate\s+table|create\s+table|grant\s+|revoke\s+)\b/i;
        if (forbidden.test(trimmed)) {
            warnings.push(
                "Query contains a potentially destructive/write keyword."
            );
        }

        // Detect multiple statements (a second statement after the first semicolon).
        const withoutTrailing = trimmed.replace(/;\s*$/, "");
        if (withoutTrailing.includes(";")) {
            warnings.push("Query appears to contain multiple statements.");
        }

        return { valid: warnings.length === 0, warnings };
    }
}
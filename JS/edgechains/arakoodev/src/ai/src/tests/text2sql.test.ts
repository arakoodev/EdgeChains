import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { Text2SqlChain } from "../lib/text2sql/text2sql.js";

vi.mock("axios");

const SCHEMA = `
CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    salary INTEGER
);
`;

describe("Text2SqlChain", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("generates, sanitizes and validates a SQL query from a question", async () => {
        const modelOutput = "```sql\nSELECT name FROM employees WHERE salary > 50000;\n```";
        (axios.post as any).mockResolvedValueOnce({
            data: { choices: [{ message: { content: modelOutput } }] },
        });

        const chain = new Text2SqlChain({ apiKey: "test_key" });
        const result = await chain.generateSql({
            question: "Who earns more than 50000?",
            schema: SCHEMA,
            dialect: "SQLite",
        });

        expect(result.sql).toBe(modelOutput);
        expect(result.sanitizedSql).toBe(
            "SELECT name FROM employees WHERE salary > 50000;"
        );
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);

        // Verify the request payload sent to the LLM.
        const call = (axios.post as any).mock.calls[0];
        expect(call[0]).toBe("https://api.openai.com/v1/chat/completions");
        expect(call[1].messages[0].role).toBe("system");
        expect(call[1].messages[1].content).toContain("Who earns more than 50000?");
        expect(call[1].messages[1].content).toContain("CREATE TABLE employees");
    });

    it("strips markdown fences and a leading SQL: label", () => {
        const chain = new Text2SqlChain({ apiKey: "test_key" });
        const cleaned = chain.sanitize("SQL: SELECT * FROM t");
        expect(cleaned).toBe("SELECT * FROM t;");
    });

    it("flags destructive / non read-only queries as invalid", () => {
        const chain = new Text2SqlChain({ apiKey: "test_key" });

        const dropResult = chain.validate("DROP TABLE employees;");
        expect(dropResult.valid).toBe(false);
        expect(dropResult.warnings.length).toBeGreaterThan(0);

        const deleteResult = chain.validate("DELETE FROM employees;");
        expect(deleteResult.valid).toBe(false);

        const multiResult = chain.validate("SELECT 1; SELECT 2;");
        expect(multiResult.valid).toBe(false);

        const emptyResult = chain.validate(";");
        expect(emptyResult.valid).toBe(false);
    });

    it("accepts a WITH/CTE read-only query", () => {
        const chain = new Text2SqlChain({ apiKey: "test_key" });
        const result = chain.validate(
            "WITH high AS (SELECT * FROM employees WHERE salary > 1) SELECT * FROM high;"
        );
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
    });
});
import { describe, it, expect } from "vitest";
import { CodeChunker } from "../../lib/text-splitter/codeChunker.js";

describe("CodeChunker", () => {
    it("returns an empty array for empty source", () => {
        const chunker = new CodeChunker();
        expect(chunker.split("")).toEqual([]);
        expect(chunker.split("   \n\t\n")).toEqual([]);
    });

    it("splits top-level functions into separate chunks", () => {
        const src = [
            "function alpha() {",
            "    return 1;",
            "}",
            "",
            "function beta() {",
            "    return 2;",
            "}",
        ].join("\n");

        const chunker = new CodeChunker();
        const chunks = chunker.split(src);

        const fnChunks = chunks.filter((c) => c.type === "function");
        expect(fnChunks.length).toBe(2);
        expect(fnChunks[0].content).toContain("function alpha");
        expect(fnChunks[1].content).toContain("function beta");
        // Each function chunk must be self-contained (balanced braces).
        expect(fnChunks[0].content).toContain("return 1;");
        expect(fnChunks[1].content).toContain("return 2;");
    });

    it("keeps a class body together as a single class chunk", () => {
        const src = [
            "export class Widget {",
            "    constructor() {",
            "        this.x = 1;",
            "    }",
            "    render() {",
            "        return this.x;",
            "    }",
            "}",
        ].join("\n");

        const chunker = new CodeChunker();
        const chunks = chunker.split(src);

        const classChunks = chunks.filter((c) => c.type === "class");
        expect(classChunks.length).toBe(1);
        expect(classChunks[0].content).toContain("class Widget");
        expect(classChunks[0].content).toContain("render()");
        // The whole class is one chunk (not split mid-body).
        expect(classChunks[0].endLine - classChunks[0].startLine).toBeGreaterThanOrEqual(6);
    });

    it("groups consecutive import lines into one import chunk", () => {
        const src = [
            "import a from 'a';",
            "import b from 'b';",
            "import c from 'c';",
            "",
            "const x = 1;",
        ].join("\n");

        const chunker = new CodeChunker();
        const chunks = chunker.split(src);

        const importChunks = chunks.filter((c) => c.type === "import");
        expect(importChunks.length).toBe(1);
        expect(importChunks[0].content).toContain("import a");
        expect(importChunks[0].content).toContain("import c");
    });

    it("respects maxChunkSize by splitting oversized functions on line boundaries", () => {
        // Build a function whose body is much larger than maxChunkSize.
        const body: string[] = [];
        for (let i = 0; i < 200; i++) {
            body.push(`    const value${i} = ${i};`);
        }
        const src = ["function big() {", ...body, "}"].join("\n");

        const chunker = new CodeChunker({ maxChunkSize: 200 });
        const chunks = chunker.split(src);

        // No emitted chunk should exceed maxChunkSize (allowing for single
        // overlong lines, of which there are none here).
        for (const c of chunks) {
            expect(c.content.length).toBeLessThanOrEqual(200);
        }
        // All 200 body lines must be preserved across the chunks.
        const joined = chunks.map((c) => c.content).join("\n");
        for (let i = 0; i < 200; i++) {
            expect(joined).toContain(`const value${i} = ${i};`);
        }
    });

    it("can return plain strings when withMetadata is false", () => {
        const src = ["function a() {", "    return 1;", "}"].join("\n");
        const chunker = new CodeChunker({ withMetadata: false });
        const chunks = chunker.split(src) as unknown as string[];
        expect(Array.isArray(chunks)).toBe(true);
        expect(typeof chunks[0]).toBe("string");
        expect(chunks[0]).toContain("function a");
    });

    it("reports correct 1-based line numbers", () => {
        const src = [
            "// header comment", // line 1
            "", // line 2
            "function foo() {", // line 3
            "    return 42;", // line 4
            "}", // line 5
        ].join("\n");

        const chunker = new CodeChunker();
        const chunks = chunker.split(src);
        const fn = chunks.find((c) => c.type === "function");
        expect(fn).toBeDefined();
        expect(fn!.startLine).toBe(3);
        expect(fn!.endLine).toBe(5);
    });

    it("handles brace-less (Python-style) functions via indentation", () => {
        const src = [
            "def alpha(x):",
            "    y = x + 1",
            "    return y",
            "",
            "def beta():",
            "    return 0",
        ].join("\n");

        const chunker = new CodeChunker();
        const chunks = chunker.split(src);
        const fns = chunks.filter((c) => c.type === "function");
        expect(fns.length).toBe(2);
        expect(fns[0].content).toContain("def alpha");
        expect(fns[0].content).toContain("return y");
        expect(fns[1].content).toContain("def beta");
    });

    it("ignores braces inside string literals when balancing", () => {
        const src = [
            "function tricky() {",
            '    const s = "a } not a real brace {";',
            "    return s;",
            "}",
        ].join("\n");

        const chunker = new CodeChunker();
        const chunks = chunker.split(src);
        const fn = chunks.find((c) => c.type === "function");
        expect(fn).toBeDefined();
        // The entire function is one chunk because the string brace is ignored.
        expect(fn!.content).toContain("return s;");
        expect(fn!.endLine).toBe(4);
    });

    it("throws on invalid maxChunkSize", () => {
        expect(() => new CodeChunker({ maxChunkSize: 0 })).toThrow();
        expect(() => new CodeChunker({ maxChunkSize: -5 })).toThrow();
    });

    it("preserves all non-whitespace source content across chunks", () => {
        const src = [
            "import x from 'x';",
            "",
            "// a comment",
            "const y = 10;",
            "",
            "function foo() {",
            "    return y;",
            "}",
            "",
            "class Bar {}",
        ].join("\n");

        const chunker = new CodeChunker({ maxChunkSize: 40 });
        const chunks = chunker.split(src);
        const joined = chunks.map((c) => c.content).join("\n");
        // Every meaningful token survives chunking.
        for (const token of [
            "import x from 'x';",
            "// a comment",
            "const y = 10;",
            "function foo()",
            "return y;",
            "class Bar {}",
        ]) {
            expect(joined).toContain(token);
        }
    });
});
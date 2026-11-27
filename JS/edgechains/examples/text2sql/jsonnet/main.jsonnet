// Jsonnet example for the EdgeChains Text2SqlChain (issue #135).
//
// This example wires a natural-language question + a database schema through
// the text2sql chain. The chain asks the LLM to produce a SQL query and then
// runs a sanitize/validate step before the query is handed back.
//
// Usage (from an EdgeChains jsonnet runtime):
//   jsonnet -J <vendor> \
//     --ext-str openai_api_key=sk-... \
//     --ext-str question="List each department and its total salary" \
//     text2sql.jsonnet

local openAIApiKey = std.extVar("openai_api_key");
local question = std.extVar("question");

// Database schema (DDL) the model is allowed to query against.
local schema = |||
    CREATE TABLE employees (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT,
        salary INTEGER
    );

    CREATE TABLE departments (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        manager TEXT
    );
|||;

{
    // The natural-language question we want answered with SQL.
    "question": question,

    // The schema description handed to the model.
    "schema": schema,

    // Optional dialect hint + safety knobs.
    "dialect": "SQLite",
    "rowLimit": 100,

    // Call the text2sql chain. `text2sql` is registered as a native chain by
    // the EdgeChains runtime; it returns { sql, sanitizedSql, valid, warnings }.
    "result": arakoo.native("text2sql")({
        question: question,
        schema: schema,
        dialect: "SQLite",
        openAIApiKey: openAIApiKey,
    }),
}
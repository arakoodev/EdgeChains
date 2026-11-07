local article = std.extVar("article");
local steps = std.extVar("steps");

local codPromptTemplate = |||
    Article:
    {article}

    You will generate increasingly concise, entity-dense summaries of the above article.
    Repeat the following 2 steps {steps} times.
    Step 1. Identify 1-3 informative entities (";" delimited) from the article which are missing from the previously generated summary.
    Step 2. Write a new, denser summary of identical length (~80 words) which covers every entity and detail from the previous summary plus the missing entities.

    Respond strictly with a JSON array of objects with keys "missing_entities" and "denser_summary".
|||;

{
    promptTemplate: codPromptTemplate,
    evaluatedPrompt: std.strReplace(std.strReplace(codPromptTemplate, "{article}", article), "{steps}", steps),
}

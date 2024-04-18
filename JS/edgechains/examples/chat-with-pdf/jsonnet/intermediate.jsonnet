local updateQueryPrompt(promptTemplate, query, content) =
    local updatedPrompt = std.strReplace(promptTemplate, '{}', query + "\n");
    local updatedContent = std.strReplace(updatedPrompt, '{content}', content + "\n");
    updatedContent;

local promptTemplate = std.extVar("promptTemplate");
local query = std.extVar("query");
local content = std.extVar("content");

local updatedQueryPrompt = updateQueryPrompt(promptTemplate, query, content);
{
    "prompt": updatedQueryPrompt
}

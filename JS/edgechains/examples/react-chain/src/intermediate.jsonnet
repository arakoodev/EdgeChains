local updateQueryPrompt(promptTemplate, query) =
    local updatedPrompt = std.strReplace(promptTemplate,'{}',query + "\n");
    updatedPrompt;

local promptTemplate = std.extVar("promptTemplate");
local query = std.extVar("query");
local updatedQueryPrompt = updateQueryPrompt(promptTemplate, query);
{
    "prompt": updatedQueryPrompt
}


//Replace the {} in the prompt template with the query
local updateQueryPrompt(promptTemplate, query) =
    local updatedPrompt = std.strReplace(promptTemplate, '{}', query);
    updatedPrompt;

local promptTemplate = payload.promptTemplate;
local query = payload.query;
local updatedQueryPrompt = updateQueryPrompt(promptTemplate, query);
local maxTokens = 9000;
{
    "prompt": if(std.length(updatedQueryPrompt) > maxTokens) then std.substr(updatedQueryPrompt, 0, maxTokens) else updatedQueryPrompt
}
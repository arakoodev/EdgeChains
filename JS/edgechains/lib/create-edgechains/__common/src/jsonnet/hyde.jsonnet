//Replace the {} in the prompt template with the query
local updateQueryPrompt(promptTemplate, query) =
    local updatedPrompt = std.strReplace(promptTemplate,'{}',query + "\n");
    updatedPrompt;

//To replace the time in the system prompt
local updateTimePrompt(promptTemplate, time) =
    local updatedPrompt =std.strReplace(promptTemplate,'{time}', time );
    updatedPrompt;

local promptTemplate = std.extVar("promptTemplate");
local time = std.extVar("time");
local query = std.extVar("query");
local updatedQueryPrompt = updateQueryPrompt(promptTemplate, query);
local updatedPrompt = updateTimePrompt(updatedQueryPrompt, time);
{
    "prompt": updatedPrompt
}
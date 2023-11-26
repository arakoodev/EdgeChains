//Replace the {} in the prompt template with the query
local updateTestPrompt(promptTemplate, test_class) =
    local updatedPrompt = std.strReplace(promptTemplate,'{test_class}',test_class);
    updatedPrompt;

//To replace the time in the system prompt
local updateTimePrompt(promptTemplate, test_package) =
    local updatedPrompt =std.strReplace(promptTemplate,'{test_package}',test_package);
    updatedPrompt;

local promptTemplate = std.extVar("promptTemplate");
local test_class = std.extVar("test_class");
local test_package = std.extVar("test_package");
local updatedQueryPrompt = updateTestPrompt(promptTemplate, test_class);
local updatedPrompt = updateTimePrompt(updatedQueryPrompt, test_package);
{
    "prompt": updatedPrompt
}
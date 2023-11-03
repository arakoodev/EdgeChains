
//Format the prompt template
local formatPrompt(promptTemplate, query, contextList, numChoices) =
    local updatedPrompt = std.strReplace(std.strReplace(std.strReplace(promptTemplate, '{query}', query), '{context_list}', contextList), '{num_choices}', numChoices);
    updatedPrompt;

//Extract the choice from the json returned by gpt
local extractChoice(gptResponse) =
    local jsonVal = xtr.read(gptResponse, 'application/json');
    local choiceNum = jsonVal['answers'][0].choice;
    choiceNum;

local promptTemplate = payload.promptTemplate;
local query = payload.query;
local numChoices = payload.numChoices;
local contextList =  payload.contextList;
local updatedPrompt = formatPrompt(promptTemplate, query, contextList, numChoices);
local gptResponse = payload.gptResponse;
local flag = payload.flag;
local choiceNum = if flag == "true" then extractChoice(gptResponse) else "";
{
    "formattedPrompt": updatedPrompt,
    "choiceNum": choiceNum
}
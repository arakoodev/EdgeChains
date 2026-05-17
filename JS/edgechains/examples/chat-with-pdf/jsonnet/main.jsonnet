local CUSTOM_TEMPLATE = |||
                            You are a senior software developer seeking accurate answers based on provided content. Your task is to find answers exclusively from the given content and the answer should be verbose and detailedfull. If the answer is not present within the provided content, respond with "Sorry! I don't know the answer.
                            Content:{content}
                            Question:{}
                        |||;


local updateQueryPrompt(promptTemplate, query, content) =
    local updatedPrompt = std.strReplace(promptTemplate, '{}', query + "\n");
    local updatedContent = std.strReplace(updatedPrompt, '{content}', content + "\n");
    updatedContent;


local query = std.extVar("query");
local content = std.extVar("content");

local getQueryMatch(query)= 
    local queryEmbeddings = arakoo.native("getEmbeddings")(query);
    local content = arakoo.native("getQueryMatch")(queryEmbeddings);
    content;

local updatedQueryPrompt = updateQueryPrompt(CUSTOM_TEMPLATE, query, getQueryMatch(query));

local getOpenAiResponse = arakoo.native("openAICall")(updatedQueryPrompt);

getOpenAiResponse
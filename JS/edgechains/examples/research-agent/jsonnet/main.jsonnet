
local PromptTemplate = |||
                        """{researchSummary}""" Based on the above information, generate a bibliography recommendation report for the following
                        question or topic: "{question}". The report should provide a detailed analysis of each recommended resource,
                        explaining how each source can contribute to finding answers to the research question.
                        Focus on the relevance, reliability, and significance of each source.
                        Ensure that the report is well-structured, informative, in-depth, and follows Markdown syntax.
                        Include relevant facts, figures, and numbers whenever available.
                        The report should have a minimum length of 1,200 words.
                       |||;


local generatePrompt() = 
    local query = std.extVar("query");
    local getWebSearch = std.parseJson(arakoo.native("bingWebSearch")(query));
    local data = "";
    local range = std.range(0, std.length(getWebSearch) - 1);

    local finalData = std.foldl(function(acc, i)
        local url = getWebSearch[i].url;

        if !std.endsWith(url, ".pdf") then
            local getPageContent = arakoo.native("webScraper")(url);
            acc + std.slice(getPageContent, 0, 400, 1),

     range, data);

     local updatedPromptTemplateWithQuery = std.strReplace(PromptTemplate, "{question}", query);
    local updatedPromptTemplateWithSummary = std.strReplace(updatedPromptTemplateWithQuery, "{researchSummary}", finalData);
    local openAICall = arakoo.native("openAICall")(updatedPromptTemplateWithSummary);
    openAICall;


generatePrompt()


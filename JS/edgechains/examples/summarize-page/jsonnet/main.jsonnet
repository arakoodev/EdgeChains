local promptTemplate = |||
                        You are a helpful AI assistant capable of providing detailed summaries. Your task is to summarize the given content thoroughly and in a verbose manner. 
                        
                        Content to be summarized:
                        -------
                        {content}
                        --------
                        Given answer should look like this: The Summary of the content is: [Your Summary].
                        Please remember to provide a thorough and detailed summary. Don't give incomplete summary or just a few words. Specially focus when the summary ends the end should not be abrupt.
                        
                       |||;


local pageUrl = std.extVar("pageUrl");
local getPageContent(pageUrl) = 
    local pageContent = arakoo.native("getPageContent")(pageUrl);
    local promptWithPageContent = std.strReplace(promptTemplate,'{content}', pageContent + "\n");
    promptWithPageContent;

local main(prompt) =
    local response = arakoo.native("openAICall")(prompt);
    response;

main(getPageContent(pageUrl))

local promptTemplate = |||
                        You are a helpful assistant that translate this text {text} into this language {language}.
                       |||;


local text = std.extVar("text");
local language = std.extVar("language");

local promptWithtext = std.strReplace(promptTemplate,'{text}', text + "\n");
local finalPrompt = std.strReplace(promptWithtext,'{language}', language + "\n");

local main() =
    local response = arakoo.native("openAICall")(finalPrompt);
    response;

main()
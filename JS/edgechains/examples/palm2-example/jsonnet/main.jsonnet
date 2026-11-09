local promptTemplate = |||
    You are a helpful AI assistant powered by Google PaLM 2.
    Answer the following question clearly and concisely:
    Question: {question}
|||;

local apiKey = std.extVar("palm_api_key");
local userQuestion = std.extVar("question");

local promptWithQuestion = std.strReplace(promptTemplate, "{question}", userQuestion + "\n");

local main() =
    local response = arakoo.native("palm2Call")({
        prompt: promptWithQuestion,
        palmApiKey: apiKey,
    });
    response;

main()

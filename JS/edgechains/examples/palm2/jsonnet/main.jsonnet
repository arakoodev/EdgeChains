local SYSTEM_CONTEXT = |||
    You are a knowledgeable Geography and History research assistant powered by Google PaLM 2 and EdgeChains Jsonnet.
    Provide concise, accurate answers to user questions.
|||;

local PROMPT_TEMPLATE = |||
    Context:
    {context}

    User Question:
    {question}

    Detailed Answer:
|||;

local buildPrompt(template, context, question) =
    local withContext = std.strReplace(template, '{context}', context);
    std.strReplace(withContext, '{question}', question);

local question = std.extVar("question");
local palmApiKey = std.extVar("palm_api_key");

local fullPrompt = buildPrompt(PROMPT_TEMPLATE, SYSTEM_CONTEXT, question);

local palm2Response = arakoo.native("palm2Call")({
    prompt: fullPrompt,
    context: SYSTEM_CONTEXT,
    apiKey: palmApiKey,
});

palm2Response

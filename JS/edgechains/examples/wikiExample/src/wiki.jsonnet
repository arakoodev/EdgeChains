local stringToBool(s) = 
    if s == "true" then true
    else false;

local keepMaxTokens = stringToBool(std.extVar("keepMaxTokens"));
local maxTokens = if keepMaxTokens == "true" then std.parseInt(std.extVar("maxTokens")) else 5120;

local preset = |||
                 You are a Summary Generator Bot. For any question other than summarizing the data, you should tell that you cannot answer it.
                    You should detect the language and the characters the user is writing in, and reply in the same character set and language.

                    You should follow the following template while answering the user:

                    ```
                    1. <POINT_1> - <DESCRIPTION_1>
                    2. <POINT_2> - <DESCRIPTION_2>
                    ...
                    ```
                    Now, given the data, create a 30-bullet point summary of:
               |||;
local keepContext = std.extVar("keepContext");
local context = if keepContext == "true" then std.extVar("context") else "";


local prompt = std.join("\n", [preset, context]);
{
    "maxTokens": maxTokens,
    "typeOfKeepContext": std.type(keepContext),
    "preset" : preset,
    "context": context,
    "prompt": if(std.length(prompt) > maxTokens) then std.substr(prompt, 0, maxTokens) else prompt
}
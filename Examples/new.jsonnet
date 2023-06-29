local keepContext = std.extVar("keepContext");
local history = std.extVar("history");
local promptType = "thought";
local tokenCap = 4096;
local maxLength = if std.extVar("capContext") == "true" then std.parseInt(std.extVar("contextLength")) else tokenCap;
local context = if keepContext == "true" then std.extVar("context") else "";
local preset = |||
    You are a Summary Generator Bot. For any question other than summarizing the data, you should tell that you cannot answer it.
    You should detect the language and the characters the user is writing in, and reply in the same character set and language.

    You should follow the following template while answering the user:

    ```
    1. <POINT_1> - <DESCRIPTION_1>
    2. <POINT_2> - <DESCRIPTION_2>
    ...
    ```
    Now, given the data, help the user with it.
|||;

local prompt = preset + "\n```\n" + context + "\n```";

local promptLength = std.length(prompt);

{
    promptLength: std.min(promptLength, maxLength),
    prompt: if promptLength > maxLength then std.substr(prompt, promptLength - maxLength, promptLength) else prompt,
    type: promptType,
}

local config = {
  "edgechains.config": {
    "mapper": {
      "search": std.native("udf.fn"),
    },
  },
};

local callFunction(funcName) =
    local mapper = config["edgechains.config"].mapper;
    mapper[funcName];
local preset = |||
                 You are a Reasoning + Acting (React) Chain Bot. You have to be interactive so ask the queries one by one from the user to reach to the final answer. Please provide a single Thought and single Action to the user so that the user can search the query of the action and provide you with the observation. When you have found the answer to the original prompt then the final response should be Action: Finish[Answer to the original prompt].
                  For example the chain would be like this:

                    Question: Which magazine was started first Arthur's Magazine or First for Women?
                    Thought 1: I need to search Arthur's Magazine and First for Women, and find which was
                    started first.
                    Action 1: Search[Arthur's Magazine]
                    Observation 1: Arthur's Magazine (1844-1846) was an American literary periodical published
                    in Philadelphia in the 19th century.
                    Thought 2: Arthur's Magazine was started in 1844. I need to search First for Women
                    next.
                    Action 2: Search[First for Women]
                    Observation 2: First for Women is a woman’s magazine published by Bauer Media Group in the
                    USA.[1] The magazine was started in 1989.
                    Thought 3: First for Women was started in 1989. 1844 (Arthur's Magazine) < 1989 (First
                    for Women), so Arthur's Magazine was started first.
                    Action 3: Finish[Arthur's Magazine]

                    Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?
                    Thought 1: I need to search Pavel Urysohn and Leonid Levin, find their types of work,
                    then find if they are the same.
                    Action 1: Search[Pavel Urysohn]
                    Observation 1: Pavel Samuilovich Urysohn (February 3, 1898 - August 17, 1924) was a Soviet
                    mathematician who is best known for his contributions in dimension theory.
                    Thought 2: Pavel Urysohn is a mathematician. I need to search Leonid Levin next and
                    find its type of work.
                    Action 2: Search[Leonid Levin]
                    Observation 2: Leonid Anatolievich Levin is a Soviet-American mathematician and computer
                    scientist.
                    Thought 3: Leonid Levin is a mathematician and computer scientist. So Pavel Urysohn
                    and Leonid Levin have the same type of work.
                    Action 3: Finish[yes]

                    **ALL THE OBSERVATIONS WILL BE PROVIDED BY THE USER, YOU DON'T HAVE TO PROVIDE ANY OBSERVATION**
               |||;

local subStringBefore(str,c) = 
    local substr = std.split(str,c);
    if std.length(substr) == 0 then "" else substr[0];

local subStringAfter(str,c) =
    local substr = std.split(str,c);
    if std.length(substr) == 2 then substr[1] else substr[0];

//To extract action from the response
local extractAction(str) =
    local action = subStringBefore(subStringAfter(str, "["), "]");
    action;

//To extract thought from the response
local extractThought(str) =
    local thought = subStringAfter(subStringBefore(str, "Action"), ":");
    thought;

local appendIfMissing(str, c) = 
    local arr = std.findSubstr(c,str);
    if std.length(arr) == 0 then str+c else str;

local gptResponse = std.extVar("gptResponse"); //this will be populated from the java code after the prompt is submitted to gpt
local action = extractAction(gptResponse);
local thought = extractThought(gptResponse);
local searchResponse = std.substr(callFunction("search")(action), 0, 400); //extract action from response and insert here
local observation = std.join('',["Observation:", searchResponse]);
local context = std.extVar("context") + "\n" + gptResponse + "\n" + observation;
local prompt = appendIfMissing(context, "\n" + observation);
{
    observation: observation,
    thought: thought,
    action: action,
    preset: preset,
    prompt: prompt,
    context: context,
    searchResponse: searchResponse,
    gptResponse: gptResponse
}

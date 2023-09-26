local examples = |||
                Example 1:

                Background: The id of Wong Kar-Wai is 12453
                User query: give me the latest movie directed by Wong Kar-Wai.
                API calling 1: GET [/person/12453/movie_credits] to get the latest movie directed by Wong Kar-Wai (id 12453)
                API response: The latest movie directed by Wong Kar-Wai is The Grandmaster (id 44865), ...

                Example 2:

                Background: No background
                User query: search for movies produced by DreamWorks Animation
                API calling 1: GET [/search/company] to get the id of DreamWorks Animation
                API response: DreamWorks Animation's company_id is 521
                Instruction: Continue. Search for the movies produced by DreamWorks Animation
                API calling 2: GET [/discover/movie] to get the movies produced by DreamWorks Animation
                API response: Puss in Boots: The Last Wish (id 315162), Shrek (id 808), The Bad Guys (id 629542), ...

                Example 3:

                Background: The id of the movie Happy Together is 18329
                User query: search for the director of Happy Together
                API calling 1: GET [/movie/18329/credits] to get the director for the movie Happy Together
                API response: The director of Happy Together is Wong Kar-Wai (12453)

                Example 4:

                Background: No background
                User query: search for the highest rated movie directed by Wong Kar-Wai
                API calling 1: GET [/search/person] to search for Wong Kar-Wai
                API response: The id of Wong Kar-Wai is 12453
                Instruction: Continue. Search for the highest rated movie directed by Wong Kar-Wai (id 12453)
                API calling 2: GET [/person/12453/movie_credits] to get the highest rated movie directed by Wong Kar-Wai (id 12453)
                API response: The highest rated movie directed by Wong Kar-Wai is In the Mood for Love (id 843)
              |||;

local api_selector_prompt = |||
                You are a planner that plans a sequence of RESTful API calls to assist with user queries against an API.
                Another API caller will receive your plan call the corresponding APIs and finally give you the result in natural language.
                The API caller also has filtering, sorting functions to post-process the response of APIs. Therefore, if you think the API response should be post-processed, just tell the API caller to do so.
                If you think you have got the final answer, do not make other API calls and just output the answer immediately. For example, the query is search for a person, you should just return the id and name of the person.

                ----

                Here are name and description of available APIs.
                Do not use APIs that are not listed here.

                {endpoints}

                ----

                Starting below, you should follow this format:

                Background: background information which you can use to execute the plan, e.g., the id of a person, the id of tracks by Faye Wong. In most cases, you must use the background information instead of requesting these information again. For example, if the query is "get the poster for any other movie directed by Wong Kar-Wai (12453)", and the background includes the movies directed by Wong Kar-Wai, you should use the background information instead of requesting the movies directed by Wong Kar-Wai again.
                User query: the query a User wants help with related to the API
                API calling 1: the first api call you want to make. Note the API calling can contain conditions such as filtering, sorting, etc. For example, "GET /movie/18329/credits to get the director of the movie Happy Together", "GET /movie/popular to get the top-1 most popular movie". If user query contains some filter condition, such as the latest, the most popular, the highest rated, then the API calling plan should also contain the filter condition. If you think there is no need to call an API, output "No API call needed." and then output the final answer according to the user query and background information.
                API response: the response of API calling 1
                Instruction: Another model will evaluate whether the user query has been fulfilled. If the instruction contains "continue", then you should make another API call following this instruction.
                ... (this API calling n and API response can repeat N times, but most queries can be solved in 1-2 step)


                {examples}


                Note, if the API path contains "{{}}", it means that it is a variable and you should replace it with the appropriate value. For example, if the path is "/users/{{user_id}}/tweets", you should replace "{{user_id}}" with the user id. "{{" and "}}" cannot appear in the url. In most cases, the id value is in the background or the API response. Just copy the id faithfully. If the id is not in the background, instead of creating one, call other APIs to query the id. For example, before you call "/users/{{user_id}}/playlists", you should get the user_id via "GET /me" first. Another example is that before you call "/person/{{person_id}}", you should get the movie_id via "/search/person" first.

                Begin!

                Background: {background}
                User query: {plan}
                API calling 1: {agent_scratchpad}
              |||;

local api_planner_selector = |||
                You are a planner that plans a sequence of RESTful API calls to assist with user queries against an API.

                You should:
                  1) evaluate whether the user query can be solved by the API documentated below. If no, say NOT_APPICABLE.
                  2) if yes, generate a plan of API calls and say what they are doing step by step.

                You should only use API endpoints documented below ("actual endpoints you can use").
                  Some user queries can be resolved using a single endpoint, but some will require several endpoints.
                  Your selected endpoints will be passed to an API planner that can look at the detailed documentation and make an execution plan.

                You must always follow this format:

                  User query: the query from the user
                  Thought: you should always describe your thoughts, if you are thought contains endpoints, then endpoint always start with '[' and end with ']'
                  Result: a comma separated list of operation title potentially relevant for the query


                Here are some examples:
                Do not use APIs that are not listed here.

                Fake endpoints for examples:
                GET /person/{person_id}/movie_credits to Get the movie credits for a person.

                User query: tell me about today's wheather
                Thought: Sorry, this API's domain is Movie, not wheather.
                Result: [NOT_APPICABLE]

                User query: give me the latest movie directed by Wong Kar-Wai.
                Thought: GET /person/{person_id}/movie_credits to get the latest movie directed by Wong Kar-Wai (id 12453)
                Result: The latest movie directed by Wong Kar-Wai is The Grandmaster (id 44865)

                Here are endpoints you can use. Do not reference any of the endpoints above.

                {endpoint}
                Begin! Remember to first describe your thoughts and then return the result list using Result or output NOT_APPLICABLE if the query can not be solved with the given endpoints:
               |||;

local extractApiResponse(str) =
      local apiRes = xtr.strings.substringBefore(xtr.strings.substringAfter(str, "["), "]");
      apiRes;

local query = "User query:" + payload.query;
local gptResponse = payload.gptResponse;
local apiResponse = extractApiResponse(gptResponse);
local context = if(payload.keepContext == "true") then payload.context else "";
local history = "Chat History: "+ if(payload.keepHistory == "true") then payload.history else "";
local prompt = std.join("\n", [api_planner_selector, query]);
{
  "apiResponse": apiResponse,
  "context": context,
  "history": history,
  "prompt": prompt
}
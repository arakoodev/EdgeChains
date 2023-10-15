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
                Result: operation title potentially relevant for the query


                Here are some examples:
                Do not use APIs that are not listed here.

                Fake endpoints for examples:
                - getProducts (GET): to get all products list
                - getProduct (GET): to get a single product
                - getCategories (GET): to get all categories
                - getInCategory (GET): to get products in a specific category
                - deleteProduct (DELETE): to delete a specific product by it's id.

                User query: tell me about today's wheather
                Thought: Sorry, this API's domain is Shopping, not wheather.
                Result: [NOT_APPLICABLE]

                User query: Can you get me all the products.
                Thought: getProducts can be used to get all products.
                Result: getProducts[products]

                User query: get me the product with id 1
                Thought: getProduct can be used to get product by Id.
                Result: getProduct[products/1]

                User query: get me the all product categories
                Thought: getCategories can be used to get all product categories
                Result: getProduct[products/categories]

                User query: get me all product in electronics category
                Thought: getInCategory can be used to get all product in a specific category.
                Result: getInCategory[products/category/electronics]

                User query: Can you delete this product which id is 4.
                Thought: deleteProduct can be used to delete a product with id.
                Result: deleteProduct[products/4]

                Here are endpoints you can use. Do not reference any of the endpoints above.

                {endpoints}
                Begin! Remember to first describe your thoughts and then return the result list using Result or output NOT_APPLICABLE if the query can not be solved with the given endpoints:

                Context: {context}
                User query: {query}
                Chat History: {chat_history}
               |||;

local extractResult(str) =
      local result = xtr.strings.substringBefore(xtr.strings.substringAfter(str, "["), "]");
      result;

local query = "User query:" + payload.query;
local gptResponse = payload.gptResponse;
local getResult = extractResult(gptResponse);
local context = if(payload.keepContext == "true") then payload.context else "";
local history = "Chat History: " + if(payload.keepHistory == "true") then payload.history else "";
local prompt = std.join("\n", [query , api_planner_selector, context, history]);
{
  "result": getResult,
  "api_planner_selector": api_planner_selector,
  "context": context,
  "history": history,
  "prompt": prompt
}
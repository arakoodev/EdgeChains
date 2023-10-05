local LLAMA_USER_PROMPT = |||
                            Write an answer for the question below,\n
                            Question: {}
                        |||;
local DATE_EXTRACTION = |||
                            Extract the date of the document from the given chunk in the following format Month DD, YYYY. If it is in some other format convert it to Month DD, YYYY format.
                            Also, if there are any spelling errors in the month's name, correct them.
                            Your output should only be the date, without any additional sentences or punctuation. Here's the chunk you need to work with:
                            {}
                        |||;
local TITLE_EXTRACTION = |||
                            Extract the title of the document from the given chunk:
                            {}
                        |||;
local LLAMA2_SYSTEM_PROMPT = |||
                                <<SYS>>\n\n
                                You answer questions truthfully based on provided context.\n
                                Your answers are friendly, clear, and conversational.\n
                                For each context check whether it is related to the question.\n
                                Only use context that are related to the question to answer it.\n
                                Ignore context that are not related to the question.\n\n
                                If the answer exists in several context, summarize them.\n
                                Only answer based on the context provided. Don't make things up.\n
                                Context (with relevance score): \n
                                {}
                                <</SYS>>
                           |||;

{
    "llama_user_prompt": LLAMA_USER_PROMPT,
    "date_extraction": DATE_EXTRACTION,
    "title_extraction": TITLE_EXTRACTION,
    "llama2_system_prompt": LLAMA2_SYSTEM_PROMPT,
}

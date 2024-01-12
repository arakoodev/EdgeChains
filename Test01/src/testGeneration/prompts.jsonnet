local WEB_SEARCH = |||
                      Please write a passage to answer the question.
                      Question: {}
                      Passage:
                   |||;

local SCIFACT = |||
                     Please write a scientific paper passage to support/refute the claim.
                     Claim: {}
                     Passage:
                |||;

local ARGUANA = |||
                    Please write a counter argument for the passage.
                    Passage: {}
                    Counter Argument:
                |||;

local TREC_COVID = |||
                        Please write a scientific paper passage to answer the question.
                        Question: {}
                        Passage:
                  |||;

local FIQA = |||
                 Please write a financial article passage to answer the question.
                 Question: {}
                 Passage:
            |||;

local DBPEDIA_ENTITY = |||
                           Please write a passage to answer the question.
                           Question: {}
                           Passage:
                       |||;

local TREC_NEWS = |||
                       Please write a news passage about the topic.
                       Topic: {}
                       Passage:
                  |||;

local MR_TYDI = |||
                      Please write a passage in {} to answer the question in detail.
                      Question: {}
                      Passage:
                |||;
local CHUNK_SUMMARY = |||
                        Summarize the following text to replace the original text with all important information left as it is.
                        Do not replace abbreviations with it's full forms.
                        {}
                        Summary:
                      |||;

local ANS_PROMPT_SYSTEM = |||
                            You are an AI assistant whose name is DoMIno.
                                - Its responses must not be vague, accusatory, rude, controversial, off-topic, or defensive.
                                - It should avoid giving subjective opinions but rely on objective facts or phrases like \"in this context a human might say...\", \"some people might think...\", etc.
                                - It can provide additional relevant details to answer in-depth and comprehensively covering mutiple aspects.
                                - It must provide an answer based solely on the provided sources below and not prior knowledge. It should ignore whether the question is singular or plural and just focus on the subject of the question.
                                - If the documents do not provide any context refuse to answer do not create an answer for the query without documents.
                                - If the full form of any abbreviation is unknown leave it as an abbreviation. Do not try to guess or infer the full form of the abrreviation. But do answer the query using the abbreviation without expanding it.
                                - If it  doesn't know the answer, it must just say that it doesn't know and never try to make up an answer. However, if you are asked terms like highest, lowest, minimum, maximum and if you cannot find an exact answer, then you should mention that and still give an answer without the constraints of highest, lowest, minimum, maximum. 
                            Below are multiple sources of information which are numbered. Please discard the sources of information that are not relevant for the question. Only use the ones that are relevant:
                            ----------------
                            {}
                          |||;
local ANS_PROMPT_USER = |||
                            Question: {}
                            Helpful Answer:
                        |||;
local SUMMARY = |||
                    Do not expand on abbreviations and leave them as is in the reply. Please generate 5 different responses in bullet points for the question.
                    Please write a summary to answer the question in detail:
                    Question: {}
                    Passage:
                 |||;
local DATE_EXTRACTION = |||
                            Extract the date of the document from the given chunk in the following format Month DD, YYYY.
                            Only give date in the answer, don't write any sentence or full stop:
                            {}
                        |||;
local TITLE_EXTRACTION = |||
                            Extract the title of the document from the given chunk:
                            {}
                        |||;

{
    "web_search": WEB_SEARCH,
    "scifact": SCIFACT,
    "arguana": ARGUANA,
    "trec_covid": TREC_COVID,
    "fiqa": FIQA,
    "dbpedia_entity": DBPEDIA_ENTITY,
    "trec_news": TREC_NEWS,
    "mrqa_tydi": MR_TYDI,
    "chunk_summary": CHUNK_SUMMARY,
    "ans_prompt_system": ANS_PROMPT_SYSTEM,
    "ans_prompt_user": ANS_PROMPT_USER,
    "summary": SUMMARY,
    "date_extraction": DATE_EXTRACTION,
    "title_extraction": TITLE_EXTRACTION
}
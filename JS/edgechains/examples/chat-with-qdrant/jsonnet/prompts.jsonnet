local SUMMARY = |||
                    Please write a short passage that would answer the question.
                    Question: {}
                    Passage:
                |||;

local ANS_PROMPT_SYSTEM = |||
                            You are an AI assistant.
                            Answer only from the retrieved sources below. If the sources are not enough, say you do not know.
                            ----------------
                            {}
                          |||;

local ANS_PROMPT_USER = |||
                            Question: {}
                            Helpful Answer:
                        |||;

{
    "summary": SUMMARY,
    "ans_prompt_system": ANS_PROMPT_SYSTEM,
    "ans_prompt_user": ANS_PROMPT_USER
}

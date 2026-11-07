local baselineTemplate = |||
    Answer the following question accurately and concisely:
    Question: {query}
|||;

local planVerificationsTemplate = |||
    Based on the original question and the baseline response below, generate independent verification questions to fact-check every factual claim in the baseline response.
    Return one verification question per line.

    Question: {query}
    Baseline Response: {baseline}
|||;

local executeVerificationTemplate = |||
    Answer the following verification question factually and concisely without assuming any prior draft is correct:
    Verification Question: {question}
|||;

local finalVerifiedTemplate = |||
    Given the original question, the initial baseline response, and the independently verified question-answer pairs below, write a revised, factually accurate final response that removes or corrects any hallucinated or contradicted claims.

    Original Question: {query}
    Baseline Response: {baseline}
    Verification Pairs:
    {verifications}

    Final Verified Response:
|||;

{
    baselineTemplate: baselineTemplate,
    planVerificationsTemplate: planVerificationsTemplate,
    executeVerificationTemplate: executeVerificationTemplate,
    finalVerifiedTemplate: finalVerifiedTemplate,
}

package com.edgechain.service.prompts;


import com.edgechain.lib.openai.prompt.PromptTemplate;

public class IndexQueryPrompt implements PromptTemplate {

    @Override
    public String getPrompt() {

//        return "You are a very enthusiastic Variant representative who \n" +
//                "loves to help people! Given the following sections from \n" +
//                "the Variant handbook, answer the question using only that \n" +
//                "information. If you are unsure and the answer is not \n" +
//                "written in the handbook, say \"Sorry, I don't know how to \n" +
//                "help with that.\" Please do not write URLs that you cannot \n" +
//                "find in the context section.";

        return "Use the following pieces of context to answer the question at the end. If " +
                "you don't know the answer, just say that you don't know, don't try to make " +
                "up an answer.";
    }
}

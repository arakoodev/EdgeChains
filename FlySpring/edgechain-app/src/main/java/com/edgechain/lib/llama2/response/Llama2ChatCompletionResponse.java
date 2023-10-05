package com.edgechain.lib.llama2.response;

import java.util.List;

public class Llama2ChatCompletionResponse {
    private GeneratedText responses;

    public GeneratedText getResponses() {
        return responses;
    }

    public void setResponses(GeneratedText responses) {
        this.responses = responses;
    }
}

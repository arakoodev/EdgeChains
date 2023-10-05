package com.edgechain.lib.llama2.response;

import java.util.List;

public class Llama2ChatCompletionResponse {
    private List<GeneratedText> responses;

    public List<GeneratedText> getResponses() {
        return responses;
    }

    public void setResponses(List<GeneratedText> responses) {
        this.responses = responses;
    }
}

package com.edgechain.lib.llama2.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public class GeneratedText {
    @JsonProperty("generated_text")
    private String generatedText;

    public String getGeneratedText() {
        return generatedText;
    }

    public void setGeneratedText(String generatedText) {
        this.generatedText = generatedText;
    }
}

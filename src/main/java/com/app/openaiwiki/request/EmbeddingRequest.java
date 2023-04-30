package com.app.openaiwiki.request;

public class EmbeddingRequest {

    private String input;
    private final String model;

    public EmbeddingRequest(String input) {
        this.input = input;
        this.model = "text-embedding-ada-002";
    }

    public String getModel() {
        return model;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }
}

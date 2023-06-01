package com.edgechain.app.request;

import com.edgechain.lib.openai.endpoint.Endpoint;

public class OpenAiEmbeddingsRequest {

    private Endpoint endpoint;
    private String input;

    public OpenAiEmbeddingsRequest(Endpoint endpoint, String input) {
        this.endpoint = endpoint;
        this.input = input;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }

    public Endpoint getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(Endpoint endpoint) {
        this.endpoint = endpoint;
    }

    @Override
    public String toString() {
        final StringBuilder sb = new StringBuilder("OpenAiEmbeddingsRequest{");
        sb.append("endpoint=").append(endpoint);
        sb.append(", input='").append(input).append('\'');
        sb.append('}');
        return sb.toString();
    }
}

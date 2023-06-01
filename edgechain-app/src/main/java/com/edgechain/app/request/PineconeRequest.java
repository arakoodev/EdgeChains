package com.edgechain.app.request;

import com.edgechain.lib.openai.endpoint.Endpoint;

public class PineconeRequest {
    private Endpoint endpoint;
    private String input;
    private int topK;
    private String namespace = "";

    public PineconeRequest() {
    }

    public PineconeRequest(Endpoint endpoint) {
        this.endpoint = endpoint;
    }

    public PineconeRequest(Endpoint endpoint, String input) {
        this.endpoint = endpoint;
        this.input = input;
    }

    public PineconeRequest(Endpoint endpoint, String input, int topK) {
        this.endpoint = endpoint;
        this.input = input;
        this.topK = topK;
    }

    public PineconeRequest(Endpoint endpoint, String input, int topK, String namespace) {
        this.endpoint = endpoint;
        this.input = input;
        this.topK = topK;
        this.namespace = namespace;
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

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public int getTopK() {
        return topK;
    }
}

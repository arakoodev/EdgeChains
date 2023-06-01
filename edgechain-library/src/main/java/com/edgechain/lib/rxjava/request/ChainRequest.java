package com.edgechain.lib.rxjava.request;

public class ChainRequest {

    private String input;

    public ChainRequest() {
    }

    public ChainRequest(String input) {
        this.input = input;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }
}

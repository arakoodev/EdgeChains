package com.edgechain.lib.jsonFormat.dto;

public class UserPromptRequest {

    public String prompt;
    public String format;

    public UserPromptRequest(String prompt, String format) {
        this.prompt = prompt;
        this.format = format;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }

}

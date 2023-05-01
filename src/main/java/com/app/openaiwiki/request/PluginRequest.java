package com.app.openaiwiki.request;

public class PluginRequest {

    private static final String DEFAULT_MODEL = "text-davinci-003";
    private static final Integer DEFAULT_MAX_TOKENS = 2048;
    private static final Double DEFAULT_TEMPERATURE = 0.3;

    private String model = DEFAULT_MODEL;
    private String prompt;
    private Integer max_tokens = DEFAULT_MAX_TOKENS;
    private Double temperature = DEFAULT_TEMPERATURE;

    public PluginRequest(String prompt) {
        this.prompt = prompt;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public Integer getMax_tokens() {
        return max_tokens;
    }

    public void setMax_tokens(Integer max_tokens) {
        this.max_tokens = max_tokens;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }
}

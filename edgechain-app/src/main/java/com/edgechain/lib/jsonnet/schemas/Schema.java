package com.edgechain.lib.jsonnet.schemas;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.HashSet;
import java.util.Set;

public class Schema {

    @NotNull
    private Integer maxTokens;

    @NotBlank
    private String preset;


    @NotBlank
    private String context;

    @NotBlank
    private String prompt;

    @NotNull
    private Set<String> services = new HashSet<>();

    public Integer getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }

    public String getPreset() {
        return preset;
    }

    public void setPreset(String preset) {
        this.preset = preset;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public Set<String> getServices() {
        return services;
    }

    public void setServices(Set<String> services) {
        this.services = services;
    }

    @Override
    public String toString() {
        final StringBuilder sb = new StringBuilder("JsonnetSchema{");
        sb.append("maxTokens=").append(maxTokens);
        sb.append(", preset='").append(preset).append('\'');
        sb.append(", context='").append(context).append('\'');
        sb.append(", prompt='").append(prompt).append('\'');
        sb.append(", services=").append(services);
        sb.append('}');
        return sb.toString();
    }
}

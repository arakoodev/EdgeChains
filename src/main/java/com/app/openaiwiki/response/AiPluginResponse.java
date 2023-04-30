package com.app.openaiwiki.response;

import com.app.openaiwiki.plugins.PluginTool;

import java.util.StringJoiner;

public class AiPluginResponse {

    private PluginTool plugin;
    private String openApiSpec;

    public AiPluginResponse() {}

    public AiPluginResponse(PluginTool plugin, String openApiSpec) {
        this.plugin = plugin;
        this.openApiSpec = openApiSpec;
    }

    public PluginTool getPlugin() {
        return plugin;
    }

    public String getOpenApiSpec() {
        return openApiSpec;
    }

    public void setOpenApiSpec(String openApiSpec) {
        this.openApiSpec = openApiSpec;
    }

    @Override
    public String toString() {
        return new StringJoiner(", ", AiPluginResponse.class.getSimpleName() + "[", "]")
                .add("plugin=" + plugin)
                .add("openApiSpec='" + openApiSpec + "'")
                .toString();
    }
}

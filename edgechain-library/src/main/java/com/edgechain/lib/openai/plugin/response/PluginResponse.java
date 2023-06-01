package com.edgechain.lib.openai.plugin.response;

import com.edgechain.lib.openai.plugin.tool.PluginTool;

import java.util.StringJoiner;

public class PluginResponse {

    private PluginTool plugin;
    private String openApiSpec;

    public PluginResponse() {}

    public PluginResponse(PluginTool plugin, String openApiSpec) {
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
        return new StringJoiner(", ", PluginResponse.class.getSimpleName() + "[", "]")
                .add("plugin=" + plugin)
                .add("openApiSpec='" + openApiSpec + "'")
                .toString();
    }
}

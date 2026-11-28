package com.app.openai.plugin.parser;

public class PluginJSONParser {

  private String pluginJSON;
  private String apiConfigJson;
  private String specAPIJson;

  public PluginJSONParser(String pluginJSON, String specAPIJson) {
    this.pluginJSON = pluginJSON;
    this.specAPIJson = specAPIJson;
  }

  public PluginJSONParser(String pluginJSON, String apiConfigJson, String specAPIJson) {
    this.pluginJSON = pluginJSON;
    this.apiConfigJson = apiConfigJson;
    this.specAPIJson = specAPIJson;
  }

  public String getPluginJSON() {
    return pluginJSON;
  }

  public void setPluginJSON(String pluginJSON) {
    this.pluginJSON = pluginJSON;
  }

  public String getApiConfigJson() {
    return apiConfigJson;
  }

  public void setApiConfigJson(String apiConfigJson) {
    this.apiConfigJson = apiConfigJson;
  }

  public String getSpecAPIJson() {
    return specAPIJson;
  }

  public void setSpecAPIJson(String specAPIJson) {
    this.specAPIJson = specAPIJson;
  }
}

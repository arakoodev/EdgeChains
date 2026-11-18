package com.edgechain.lib.openai.plugin.parser;

import java.io.Serializable;

public class PluginJSONParser implements Serializable {

  private static final long serialVersionUID = -5128420085721258857L;
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

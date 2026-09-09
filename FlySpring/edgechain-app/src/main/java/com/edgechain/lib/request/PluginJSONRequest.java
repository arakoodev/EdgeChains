package com.edgechain.lib.request;

import com.edgechain.lib.endpoint.Endpoint;

public class PluginJSONRequest {

  private Endpoint endpoint;
  private String input;

  private String pluginJSON;
  private String apiConfigJSON;
  private String specAPIJSON;

  public PluginJSONRequest() {}

  public Endpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  public String getPluginJSON() {
    return pluginJSON;
  }

  public void setPluginJSON(String pluginJSON) {
    this.pluginJSON = pluginJSON;
  }

  public String getApiConfigJSON() {
    return apiConfigJSON;
  }

  public void setApiConfigJSON(String apiConfigJSON) {
    this.apiConfigJSON = apiConfigJSON;
  }

  public String getSpecAPIJSON() {
    return specAPIJSON;
  }

  public void setSpecAPIJSON(String specAPIJSON) {
    this.specAPIJSON = specAPIJSON;
  }
}

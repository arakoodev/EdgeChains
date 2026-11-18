package com.edgechain.lib.request;

import com.edgechain.lib.endpoint.Endpoint;

public class PluginAPIRequest {

  private Endpoint endpoint;
  private Endpoint pluginEndpoint;
  private Endpoint specEndpoint;
  private String input;

  public PluginAPIRequest() {}

  public PluginAPIRequest(
      Endpoint endpoint, Endpoint pluginEndpoint, Endpoint specEndpoint, String input) {
    this.endpoint = endpoint;
    this.pluginEndpoint = pluginEndpoint;
    this.specEndpoint = specEndpoint;
    this.input = input;
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

  public Endpoint getPluginEndpoint() {
    return pluginEndpoint;
  }

  public void setPluginEndpoint(Endpoint pluginEndpoint) {
    this.pluginEndpoint = pluginEndpoint;
  }

  public Endpoint getSpecEndpoint() {
    return specEndpoint;
  }

  public void setSpecEndpoint(Endpoint specEndpoint) {
    this.specEndpoint = specEndpoint;
  }
}

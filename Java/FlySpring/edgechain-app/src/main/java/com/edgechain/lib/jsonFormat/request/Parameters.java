package com.edgechain.lib.jsonFormat.request;

public class Parameters {

  private String type;
  private Object properties;

  public Parameters() {}

  public Parameters(String type, Object properties) {
    this.type = type;
    this.properties = properties;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public Object getProperties() {
    return properties;
  }

  public void setProperties(Object properties) {
    this.properties = properties;
  }
}

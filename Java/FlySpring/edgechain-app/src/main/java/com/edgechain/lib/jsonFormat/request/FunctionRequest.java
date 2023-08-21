package com.edgechain.lib.jsonFormat.request;

public class FunctionRequest {

  private String name;
  private String description;
  private Object parameters;

  public FunctionRequest() {}

  public FunctionRequest(String name, String description, Object parameters) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Object getParameters() {
    return parameters;
  }

  public void setParameters(Parameters parameters) {
    this.parameters = parameters;
  }

  @Override
  public String toString() {
    return "FunctionRequest [name="
        + name
        + ", description="
        + description
        + ", parameters="
        + parameters
        + "]";
  }
}

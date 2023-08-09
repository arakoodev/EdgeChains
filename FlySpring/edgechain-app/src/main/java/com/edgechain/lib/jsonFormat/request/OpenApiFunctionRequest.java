package com.edgechain.lib.jsonFormat.request;

import java.util.List;

public class OpenApiFunctionRequest {

  private String model;
  private List<Message> messages;
  private double temperature;
  private List<FunctionRequest> functions;
  private String function_call;

  public OpenApiFunctionRequest(
      String model, List<Message> messages, List<FunctionRequest> functions) {
    this.model = model;
    this.messages = messages;
    this.functions = functions;
  }

  public OpenApiFunctionRequest(
      String model,
      List<Message> messages,
      double temperature,
      List<FunctionRequest> functions,
      String function_call) {
    this.model = model;
    this.messages = messages;
    this.temperature = temperature;
    this.functions = functions;
    this.function_call = function_call;
  }

  public OpenApiFunctionRequest() {}

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public List<Message> getMessages() {
    return messages;
  }

  public void setMessages(List<Message> messages) {
    this.messages = messages;
  }

  public double getTemperature() {
    return temperature;
  }

  public void setTemperature(double temperature) {
    this.temperature = temperature;
  }

  public List<FunctionRequest> getFunctions() {
    return functions;
  }

  public void setFunctions(List<FunctionRequest> functions) {
    this.functions = functions;
  }

  public String getFunction_call() {
    return function_call;
  }

  public void setFunction_call(String function_call) {
    this.function_call = function_call;
  }

  @Override
  public String toString() {
    return "OpenApiFunctionRequest [model="
        + model
        + ", messages="
        + messages
        + ", temperature="
        + temperature
        + ", functions="
        + functions
        + ", function_call="
        + function_call
        + "]";
  }
}

package com.edgechain.lib.jsonFormat.response;

import java.util.List;

public class FunctionResponse {

  private List<Choice> choices;

  public FunctionResponse(List<Choice> choices) {
    this.choices = choices;
  }

  public FunctionResponse() {}

  public List<Choice> getChoices() {
    return choices;
  }

  public void setChoices(List<Choice> choices) {
    this.choices = choices;
  }

  public static class Choice {

    private int index;
    private FunctionMessage message;

    public Choice(int index, FunctionMessage message) {
      this.index = index;
      this.message = message;
    }

    public Choice() {}

    public int getIndex() {
      return index;
    }

    public void setIndex(int index) {
      this.index = index;
    }

    public FunctionMessage getMessage() {
      return message;
    }

    public void setMessage(FunctionMessage message) {
      this.message = message;
    }
  }
}

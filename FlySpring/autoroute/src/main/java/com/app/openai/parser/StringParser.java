package com.app.openai.parser;

public class StringParser {

  private String output;
  private String[] thoughts;
  private String[] actions;
  private String[] observations;
  private String finalAnswer;

  public StringParser(String output) {
    this.output = output;
    splitOutput();
  }

  private void splitOutput() {
    String[] blocks = output.split("(?<=\\D)(?=Thought \\d+:)");

    actions = new String[blocks.length];
    thoughts = new String[blocks.length];
    observations = new String[blocks.length];

    for (int i = 0; i < blocks.length; i++) {
      String[] parts = blocks[i].split("(?<=\\D)(?=Action \\d+:)");
      if (parts.length == 2) {
        thoughts[i] = parts[0].trim();
        actions[i] = parts[1].trim();
      }
      parts = actions[i].split("(?<=\\D)(?=Observation \\d+:)");
      if (parts.length == 2) {
        actions[i] = parts[0].trim();
        observations[i] = parts[1].trim();
      }
    }

    String finalAnswerPattern = "Action \\d+: Finish\\[";
    int finalAnswerIndex = output.lastIndexOf(finalAnswerPattern);
    if (finalAnswerIndex >= 0) {
      finalAnswer = output.substring(finalAnswerIndex + finalAnswerPattern.length()).trim();
      int endIndex = finalAnswer.indexOf("]");
      if (endIndex >= 0) {
        finalAnswer = finalAnswer.substring(0, endIndex);
      }

      // Remove final answer from the last action
      actions[actions.length - 1] =
          actions[actions.length - 1].replace("Finish[" + finalAnswer + "]", "").trim();
    }
  }

  public String[] getThoughts() {
    return thoughts;
  }

  public String[] getActions() {
    return actions;
  }

  public String[] getObservations() {
    return observations;
  }

  public String getFinalAnswer() {
    return finalAnswer;
  }
}

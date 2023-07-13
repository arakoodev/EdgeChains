package com.edgechain.lib.openai.response;

public class CompletionChoice {

  String text;
  Integer index;

  LogProbResult logprobs;

  String finish_reason;

  public String getText() {
    return text;
  }

  public void setText(String text) {
    this.text = text;
  }

  public Integer getIndex() {
    return index;
  }

  public void setIndex(Integer index) {
    this.index = index;
  }

  public LogProbResult getLogprobs() {
    return logprobs;
  }

  public void setLogprobs(LogProbResult logprobs) {
    this.logprobs = logprobs;
  }

  public String getFinish_reason() {
    return finish_reason;
  }

  public void setFinish_reason(String finish_reason) {
    this.finish_reason = finish_reason;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("CompletionChoice{");
    sb.append("text='").append(text).append('\'');
    sb.append(", index=").append(index);
    sb.append(", logprobs=").append(logprobs);
    sb.append(", finish_reason='").append(finish_reason).append('\'');
    sb.append('}');
    return sb.toString();
  }
}

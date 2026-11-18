package com.app.openai.request;

public class ChatMessage {
  String role;
  String content;

  public ChatMessage(String role, String content) {
    this.role = role;
    this.content = content;
  }

  public String getRole() {
    return role;
  }

  public String getContent() {
    return content;
  }

  @Override
  public String toString() {
    return "ChatMessage{" + "role='" + role + '\'' + ", content='" + content + '\'' + '}';
  }
}

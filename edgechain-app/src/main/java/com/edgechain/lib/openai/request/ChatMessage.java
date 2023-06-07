package com.edgechain.lib.openai.request;

public class ChatMessage {
  String role;
  String content;

  public ChatMessage(String role, String content) {
    this.role = role;
    this.content = content;
  }

  public ChatMessage() {
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

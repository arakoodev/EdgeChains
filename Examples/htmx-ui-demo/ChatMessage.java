package com.edgechain;

public class ChatMessage {
  String role;
  String content;

  public ChatMessage(String role, String content) {
    this.role = role;
    this.content = content;
  }

  public ChatMessage() {}

  public String getRole() {
    return role;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  @Override
  public String toString() {
    return "ChatMessage{" + "role='" + role + '\'' + ", content='" + content + '\'' + '}';
  }
}

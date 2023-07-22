package com.edgechain;

// SOURCES ./MessageItem.java

import java.util.List;

public class Chat {
  public String heading;
  public List<MessageItem> chatHistory;

  public Chat(String heading, List<MessageItem> chatHistory) {
    this.heading = heading;
    this.chatHistory = chatHistory;
  }

  public Chat() {}
}

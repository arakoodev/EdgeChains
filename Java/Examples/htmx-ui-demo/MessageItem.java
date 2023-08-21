package com.edgechain;

public class MessageItem {
  private String message;
  private boolean isReceived;

  public MessageItem(String message, boolean isReceived) {
    this.message = message;
    this.isReceived = isReceived;
  }

  public MessageItem() {}

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public boolean isReceived() {
    return isReceived;
  }

  public void setReceived(boolean received) {
    isReceived = received;
  }

  @Override
  public String toString() {
    return "MessageItem{" + "message='" + message + '\'' + ", isReceived=" + isReceived + '}';
  }
}

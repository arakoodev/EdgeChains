package com.edgechain.lib.response;

import java.io.Serializable;

public class StringResponse implements Serializable {

  private static final long serialVersionUID = 9123288168138857565L;
  private String response;

  public StringResponse() {}

  public StringResponse(String response) {
    this.response = response;
  }

  public String getResponse() {
    return response;
  }

  public void setResponse(String response) {
    this.response = response;
  }
}

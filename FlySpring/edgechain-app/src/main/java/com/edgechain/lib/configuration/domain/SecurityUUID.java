package com.edgechain.lib.configuration.domain;

public class SecurityUUID {

  private String authKey;

  public SecurityUUID(String authKey) {
    this.authKey = authKey;
  }

  public String getAuthKey() {
    return authKey;
  }

  public void setAuthKey(String authKey) {
    this.authKey = authKey;
  }
}

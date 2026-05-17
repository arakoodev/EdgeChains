package com.edgechain.lib.configuration.domain;

import java.util.ArrayList;
import java.util.List;

public class MethodAuthentication {

  private List<String> requests = new ArrayList<>();
  private String[] authorities;

  public MethodAuthentication(List<String> requests, String... authorities) {
    this.requests = requests;
    this.authorities = authorities;
  }

  public void setRequests(List<String> requests) {
    this.requests = requests;
  }

  public void setAuthorities(String[] authorities) {
    this.authorities = authorities;
  }

  public String[] getRequests() {
    return requests.toArray(String[]::new);
  }

  public String[] getAuthorities() {
    return authorities;
  }
}

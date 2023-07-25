package com.edgechain.lib.configuration.domain;

import java.util.ArrayList;
import java.util.List;

public class ExcludeMappingFilter {

  private List<String> requestGet = new ArrayList<>();
  private List<String> requestPost = new ArrayList<>();

  private List<String> requestPut = new ArrayList<>();

  private List<String> requestPatch = new ArrayList<>();

  private List<String> requestDelete = new ArrayList<>();

  public String[] getRequestGet() {
    return requestGet.toArray(String[]::new);
  }

  public void setRequestGet(List<String> requestGet) {
    this.requestGet = requestGet;
  }

  public String[] getRequestPost() {
    return requestPost.toArray(String[]::new);
  }

  public void setRequestPost(List<String> requestPost) {
    this.requestPost = requestPost;
  }

  public String[] getRequestPut() {
    return requestPut.toArray(String[]::new);
  }

  public void setRequestPut(List<String> requestPut) {
    this.requestPut = requestPut;
  }

  public String[] getRequestPatch() {
    return requestPatch.toArray(String[]::new);
  }

  public void setRequestPatch(List<String> requestPatch) {
    this.requestPatch = requestPatch;
  }

  public String[] getRequestDelete() {
    return requestDelete.toArray(String[]::new);
  }

  public void setRequestDelete(List<String> requestDelete) {
    this.requestDelete = requestDelete;
  }
}

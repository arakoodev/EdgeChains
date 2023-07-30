package com.edgechain.lib.configuration.domain;

public class AuthFilter {

  private MethodAuthentication requestGet;
  private MethodAuthentication requestPost;
  private MethodAuthentication requestPut;
  private MethodAuthentication requestDelete;
  private MethodAuthentication requestPatch;

  public MethodAuthentication getRequestPost() {
    return requestPost;
  }

  public void setRequestPost(MethodAuthentication requestPost) {
    this.requestPost = requestPost;
  }

  public MethodAuthentication getRequestGet() {
    return requestGet;
  }

  public void setRequestGet(MethodAuthentication requestGet) {
    this.requestGet = requestGet;
  }

  public MethodAuthentication getRequestPut() {
    return requestPut;
  }

  public void setRequestPut(MethodAuthentication requestPut) {
    this.requestPut = requestPut;
  }

  public MethodAuthentication getRequestDelete() {
    return requestDelete;
  }

  public void setRequestDelete(MethodAuthentication requestDelete) {
    this.requestDelete = requestDelete;
  }

  public MethodAuthentication getRequestPatch() {
    return requestPatch;
  }

  public void setRequestPatch(MethodAuthentication requestPatch) {
    this.requestPatch = requestPatch;
  }
}

package com.edgechain.lib.flyfly.commands.jbang;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class JbangSource {
  public String originalResource;
  public String backingResource;

  public String getOriginalResource() {
    return originalResource;
  }

  public void setOriginalResource(String originalResource) {
    this.originalResource = originalResource;
  }

  public String getBackingResource() {
    return backingResource;
  }

  public void setBackingResource(String backingResource) {
    this.backingResource = backingResource;
  }
}

package com.edgechain.lib.configuration.domain;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CorsEnableOrigins {

  List<String> origins;

  public List<String> getOrigins() {
    return origins;
  }

  public void setOrigins(List<String> origins) {
    this.origins = origins;
  }
}

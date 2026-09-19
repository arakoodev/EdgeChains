package com.flyspring.autoroute;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flyspring.auth")
public class AuthProperties {
  String type;
  String issuer;
  String audience;

  public String getType() {
    return this.type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public String getIssuer() {
    return this.issuer;
  }

  public void setIssuer(String issuer) {
    this.issuer = issuer;
  }

  public String getAudience() {
    return this.audience;
  }

  public void setAudience(String audience) {
    this.audience = audience;
  }
}

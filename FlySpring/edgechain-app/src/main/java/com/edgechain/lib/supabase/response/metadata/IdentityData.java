package com.edgechain.lib.supabase.response.metadata;

public class IdentityData {
  private String email;
  private String sub;

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getSub() {
    return sub;
  }

  public void setSub(String sub) {
    this.sub = sub;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("IdentityData{");
    sb.append("email='").append(email).append('\'');
    sb.append(", sub='").append(sub).append('\'');
    sb.append('}');
    return sb.toString();
  }
}

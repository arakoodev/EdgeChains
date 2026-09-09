package com.edgechain.lib.supabase.request;

import javax.validation.constraints.NotBlank;
import java.io.Serializable;

public class Credential implements Serializable {

  private static final long serialVersionUID = -5683437072462410726L;

  @NotBlank private String email;

  @NotBlank private String password;

  public Credential() {}

  public Credential(String email, String password) {
    this.email = email;
    this.password = password;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }
}

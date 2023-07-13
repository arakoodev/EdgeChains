package com.app.supabase.configuration;

public class SupabaseEnv {

  private String url;
  private String annonKey;

  private String jwtSecret;

  private String dbHost;

  private String dbUsername;

  private String dbPassword;

  public String getUrl() {
    return url;
  }

  public void setUrl(String url) {
    this.url = url;
  }

  public String getAnnonKey() {
    return annonKey;
  }

  public void setAnnonKey(String annonKey) {
    this.annonKey = annonKey;
  }

  public String getDbHost() {
    return dbHost;
  }

  public void setDbHost(String dbHost) {
    this.dbHost = dbHost;
  }

  public String getDbUsername() {
    return dbUsername;
  }

  public void setDbUsername(String dbUsername) {
    this.dbUsername = dbUsername;
  }

  public String getDbPassword() {
    return dbPassword;
  }

  public void setDbPassword(String dbPassword) {
    this.dbPassword = dbPassword;
  }

  public String getJwtSecret() {
    return jwtSecret;
  }

  public void setJwtSecret(String jwtSecret) {
    this.jwtSecret = jwtSecret;
  }
}

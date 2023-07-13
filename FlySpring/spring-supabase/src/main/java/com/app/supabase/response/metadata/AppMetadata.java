package com.app.supabase.response.metadata;

import java.util.ArrayList;
import java.util.List;

public class AppMetadata {

  private String provider;
  private List<String> providers = new ArrayList<>();

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public List<String> getProviders() {
    return providers;
  }

  public void setProviders(List<String> providers) {
    this.providers = providers;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("AppMetadata{");
    sb.append("provider='").append(provider).append('\'');
    sb.append(", providers=").append(providers);
    sb.append('}');
    return sb.toString();
  }
}

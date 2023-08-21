package com.edgechain.lib.supabase.response.metadata;

import java.time.LocalDateTime;

public class Identity {
  private String id;
  private String user_id;
  private IdentityData identity_data;
  private String provider;
  private LocalDateTime last_sign_in_at;
  private LocalDateTime created_at;
  private LocalDateTime updated_at;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getUser_id() {
    return user_id;
  }

  public void setUser_id(String user_id) {
    this.user_id = user_id;
  }

  public IdentityData getIdentity_data() {
    return identity_data;
  }

  public void setIdentity_data(IdentityData identity_data) {
    this.identity_data = identity_data;
  }

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public LocalDateTime getLast_sign_in_at() {
    return last_sign_in_at;
  }

  public void setLast_sign_in_at(LocalDateTime last_sign_in_at) {
    this.last_sign_in_at = last_sign_in_at;
  }

  public LocalDateTime getCreated_at() {
    return created_at;
  }

  public void setCreated_at(LocalDateTime created_at) {
    this.created_at = created_at;
  }

  public LocalDateTime getUpdated_at() {
    return updated_at;
  }

  public void setUpdated_at(LocalDateTime updated_at) {
    this.updated_at = updated_at;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("Identity{");
    sb.append("id='").append(id).append('\'');
    sb.append(", user_id='").append(user_id).append('\'');
    sb.append(", identity_data=").append(identity_data);
    sb.append(", provider='").append(provider).append('\'');
    sb.append(", last_sign_in_at=").append(last_sign_in_at);
    sb.append(", created_at=").append(created_at);
    sb.append(", updated_at=").append(updated_at);
    sb.append('}');
    return sb.toString();
  }
}

package com.edgechain.lib.supabase.response;

import com.edgechain.lib.supabase.response.metadata.AppMetadata;
import com.edgechain.lib.supabase.response.metadata.Identity;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class SupabaseUser implements Serializable {

  private static final long serialVersionUID = 642686832515951642L;
  private UUID id;
  private String aud;
  private String role;
  private String email;
  private LocalDateTime email_confirmed_at;
  private String phone;

  private LocalDateTime confirmation_sent_at;

  private LocalDateTime confirmed_at;

  private LocalDateTime last_sign_in_at;

  private AppMetadata app_metadata;
  private Map<String, Object> user_metadata;
  private List<Identity> identities = new ArrayList<>();

  private LocalDateTime created_at;

  private LocalDateTime updated_at;

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public String getAud() {
    return aud;
  }

  public void setAud(String aud) {
    this.aud = aud;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String role) {
    this.role = role;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public LocalDateTime getEmail_confirmed_at() {
    return email_confirmed_at;
  }

  public void setEmail_confirmed_at(LocalDateTime email_confirmed_at) {
    this.email_confirmed_at = email_confirmed_at;
  }

  public String getPhone() {
    return phone;
  }

  public void setPhone(String phone) {
    this.phone = phone;
  }

  public LocalDateTime getConfirmation_sent_at() {
    return confirmation_sent_at;
  }

  public void setConfirmation_sent_at(LocalDateTime confirmation_sent_at) {
    this.confirmation_sent_at = confirmation_sent_at;
  }

  public LocalDateTime getConfirmed_at() {
    return confirmed_at;
  }

  public void setConfirmed_at(LocalDateTime confirmed_at) {
    this.confirmed_at = confirmed_at;
  }

  public LocalDateTime getLast_sign_in_at() {
    return last_sign_in_at;
  }

  public void setLast_sign_in_at(LocalDateTime last_sign_in_at) {
    this.last_sign_in_at = last_sign_in_at;
  }

  public AppMetadata getApp_metadata() {
    return app_metadata;
  }

  public void setApp_metadata(AppMetadata app_metadata) {
    this.app_metadata = app_metadata;
  }

  public Map<String, Object> getUser_metadata() {
    return user_metadata;
  }

  public void setUser_metadata(Map<String, Object> user_metadata) {
    this.user_metadata = user_metadata;
  }

  public List<Identity> getIdentities() {
    return identities;
  }

  public void setIdentities(List<Identity> identities) {
    this.identities = identities;
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
    final StringBuilder sb = new StringBuilder("SupabaseUser{");
    sb.append("id=").append(id);
    sb.append(", aud='").append(aud).append('\'');
    sb.append(", role='").append(role).append('\'');
    sb.append(", email='").append(email).append('\'');
    sb.append(", email_confirmed_at=").append(email_confirmed_at);
    sb.append(", phone='").append(phone).append('\'');
    sb.append(", confirmation_sent_at=").append(confirmation_sent_at);
    sb.append(", confirmed_at=").append(confirmed_at);
    sb.append(", last_sign_in_at='").append(last_sign_in_at).append('\'');
    sb.append(", app_metadata=").append(app_metadata);
    sb.append(", user_metadata=").append(user_metadata);
    sb.append(", identities=").append(identities);
    sb.append(", created_at=").append(created_at);
    sb.append(", updated_at=").append(updated_at);
    sb.append('}');
    return sb.toString();
  }
}

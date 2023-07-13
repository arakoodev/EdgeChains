package com.app.supabase.response;

import com.app.supabase.response.metadata.AppMetadata;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public class SupabaseAuthUser {

  private UUID id;
  private String aud;
  private String role;
  private String email;

  private LocalDateTime confirmed_at;
  private LocalDateTime last_sign_in_at;
  private AppMetadata app_metadata;
  private Map<String, Object> user_metadata;
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

  public LocalDateTime getConfirmed_at() {
    return confirmed_at;
  }

  public void setConfirmed_at(LocalDateTime confirmed_at) {
    this.confirmed_at = confirmed_at;
  }
}

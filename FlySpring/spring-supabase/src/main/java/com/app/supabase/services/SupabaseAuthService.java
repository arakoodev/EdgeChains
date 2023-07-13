package com.app.supabase.services;

import com.app.supabase.configuration.SupabaseEnv;
import com.app.supabase.exceptions.SupabaseAuthException;
import com.app.supabase.request.Credential;
import com.app.supabase.response.AuthenticatedResponse;
import com.app.supabase.response.SupabaseUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class SupabaseAuthService {

  private static final String AUTH_MAPPING = "/auth/v1";
  @Autowired private RestTemplate restTemplate;
  @Autowired private SupabaseEnv supabaseEnv;

  public SupabaseUser signUpWithEmail(Credential credential) {
    try {
      // Set Path
      String path = setPath() + "/signup";

      // Set Authorization AccessToken;
      HttpHeaders headers = setHeaders();
      HttpEntity<Credential> requestEntity = new HttpEntity<>(credential, headers);

      ResponseEntity<SupabaseUser> response =
          restTemplate.exchange(path, HttpMethod.POST, requestEntity, SupabaseUser.class);

      return response.getBody();

    } catch (final Exception e) {
      throw new SupabaseAuthException(e.getMessage());
    }
  }

  public AuthenticatedResponse signInWithEmail(Credential credential) {
    try {
      // Set Path
      String path = setPath() + "/token?grant_type=password";

      HttpHeaders headers = setHeaders();
      HttpEntity<Credential> requestEntity = new HttpEntity<>(credential, headers);

      ResponseEntity<AuthenticatedResponse> response =
          restTemplate.exchange(path, HttpMethod.POST, requestEntity, AuthenticatedResponse.class);

      return response.getBody();

    } catch (final Exception e) {
      throw new SupabaseAuthException(e.getMessage());
    }
  }

  public AuthenticatedResponse refreshToken(String refreshToken) {

    String path = setPath() + "/token?grant_type=refresh_token";

    HttpHeaders headers = setHeaders();

    Map<String, String> body = new HashMap<>();
    body.put("refresh_token", refreshToken);

    HttpEntity<?> requestEntity = new HttpEntity<>(body, headers);

    ResponseEntity<AuthenticatedResponse> response =
        restTemplate.exchange(path, HttpMethod.POST, requestEntity, AuthenticatedResponse.class);

    return response.getBody();
  }

  public void signOut(String accessToken) {
    try {
      // Set Path
      String path = setPath() + "/logout";

      // Set Authorization AccessToken;
      HttpHeaders headers = setHeaders();
      headers.set("Authorization", "Bearer " + accessToken);
      HttpEntity<Credential> requestEntity = new HttpEntity<>(headers);

      restTemplate.postForObject(path, requestEntity, String.class);

    } catch (final Exception e) {
      throw new SupabaseAuthException(e.getMessage());
    }
  }

  public SupabaseUser getUser(String accessToken) {
    try {
      // Set Path
      String path = setPath() + "/user";

      // Set Authorization AccessToken;
      HttpHeaders headers = setHeaders();
      headers.set("Authorization", "Bearer " + accessToken);
      HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

      ResponseEntity<SupabaseUser> response =
          restTemplate.exchange(path, HttpMethod.GET, requestEntity, SupabaseUser.class);

      return response.getBody();

    } catch (final Exception e) {
      throw new SupabaseAuthException(e.getMessage());
    }
  }

  private HttpHeaders setHeaders() {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("apikey", this.supabaseEnv.getAnnonKey());
    headers.set("X-Client-Info", "supabase-java/0.0.0-automated");
    return headers;
  }

  private String setPath() {
    return this.supabaseEnv.getUrl() + AUTH_MAPPING;
  }
}

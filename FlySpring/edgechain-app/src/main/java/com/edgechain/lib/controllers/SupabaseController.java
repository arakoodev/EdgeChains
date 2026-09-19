package com.edgechain.lib.controllers;

import com.edgechain.lib.endpoint.impl.supabase.SupabaseEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import com.edgechain.lib.supabase.utils.AuthUtils;
import org.json.JSONObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping("/v1")
public class SupabaseController {

  private static SupabaseEndpoint supabaseEndpoint;

  private SupabaseEndpoint getInstance() {
    if (Objects.isNull(supabaseEndpoint)) supabaseEndpoint = new SupabaseEndpoint();
    return supabaseEndpoint;
  }

  @PostMapping(
      value = "/signup") // Confirmation email is sent to the specified address.. Click on "Confirm
  // your mail"
  public SupabaseUser signUp(ArkRequest arkRequest) {
    JSONObject json = arkRequest.getBody();
    return getInstance().signup(json.getString("email"), json.getString("password"));
  }

  @PostMapping(value = "/login")
  public AuthenticatedResponse login(ArkRequest arkRequest) {
    JSONObject json = arkRequest.getBody();
    return getInstance().login(json.getString("email"), json.getString("password"));
  }

  @PostMapping(value = "/refreshToken")
  public AuthenticatedResponse refreshToken(ArkRequest arkRequest) {
    JSONObject json = arkRequest.getBody();
    return getInstance().refreshToken(json.getString("refreshToken"));
  }

  @PostMapping(value = "/signout")
  @PreAuthorize("hasAuthority('authenticated')")
  public void signOut(ArkRequest arkRequest) {
    String accessToken = AuthUtils.extractToken(arkRequest);
    getInstance().signOut(accessToken);
  }
}

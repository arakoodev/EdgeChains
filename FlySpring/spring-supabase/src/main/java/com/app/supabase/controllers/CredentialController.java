package com.app.supabase.controllers;

import com.app.supabase.request.Credential;
import com.app.supabase.response.AuthenticatedResponse;
import com.app.supabase.response.SupabaseUser;
import com.app.supabase.security.JwtHelper;
import com.app.supabase.services.UserService;
import com.app.supabase.utils.AuthUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;

@RestController
public class CredentialController {

  @Autowired private UserService userService;

  @Autowired private JwtHelper jwtHelper;

  @PostMapping(
      "/signup") // Confirmation email is sent to the specified address.. Click on "Confirm your
  // mail"
  public SupabaseUser signup(@RequestBody Credential credential) {
    return this.userService.signup(credential);
  }

  @PostMapping("/login")
  public AuthenticatedResponse login(@RequestBody Credential credential) {
    return this.userService.login(credential);
  }

  @PreAuthorize("hasAuthority('authenticated')")
  @PostMapping("/refreshToken")
  public AuthenticatedResponse refreshToken(@RequestBody HashMap<String, String> mapper) {
    return this.userService.refreshToken(mapper.get("refreshToken"));
  }

  @PreAuthorize("hasAuthority('authenticated')")
  @PostMapping("/signout")
  public void signout(HttpServletRequest request) {
    String token = AuthUtils.extractToken(request);
    if (token != null && jwtHelper.validate(token)) {
      this.userService.signOut(token);
    }
  }

  @PreAuthorize("hasAuthority('authenticated')")
  @GetMapping("/test")
  // template for role base access ==> hasAnyRole('ROLE_CREATE_USER', 'ROLE_DELETE_USER') etc.... or
  // hasAnyAuthority()..
  public String test() {
    return "It's working;";
  }
}

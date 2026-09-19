package com.edgechain.service.controllers.supabase;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.supabase.request.Credential;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import com.edgechain.lib.supabase.security.JwtHelper;
import com.edgechain.lib.supabase.services.UserService;
import java.util.HashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController("Service SupabaseController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/supabase")
public class SupabaseController {

  @Autowired private UserService userService;

  @Autowired private JwtHelper jwtHelper;

  @PostMapping("/signup")
  public SupabaseUser signup(@RequestBody Credential credential) {
    return this.userService.signup(credential);
  }

  @PostMapping("/login")
  public AuthenticatedResponse login(@RequestBody Credential credential) {
    return this.userService.login(credential);
  }

  @PostMapping("/refreshToken")
  public AuthenticatedResponse refreshToken(@RequestBody HashMap<String, String> mapper) {
    return this.userService.refreshToken(mapper.get("refreshToken"));
  }

  @PostMapping("/signout")
  @PreAuthorize("hasAnyAuthority('authenticated')")
  public void signOut(@RequestBody HashMap<String, String> mapper) {
    String token = mapper.get("token");
    if (token != null) {
      this.userService.signOut(token);
    }
  }
}

package com.edgechain.service.controllers.supabase;

import com.edgechain.lib.supabase.request.Credential;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import com.edgechain.lib.supabase.security.JwtHelper;
import com.edgechain.lib.supabase.services.UserService;
import java.util.HashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController("Service SupabaseController")
@RequestMapping(value = "/v2/supabase")
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
  public void signOut(@RequestBody HashMap<String, String> mapper) {
    String token = mapper.get("token");
    if (token != null && jwtHelper.validate(token)) {
      this.userService.signOut(token);
    }
  }
}

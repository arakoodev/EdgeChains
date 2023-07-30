package com.edgechain;

import com.edgechain.lib.endpoint.impl.SupabaseEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import com.edgechain.lib.supabase.utils.AuthUtils;
import io.reactivex.rxjava3.core.Observable;
import org.json.JSONObject;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.Properties;

@SpringBootApplication
public class SupabaseExample {

  private static SupabaseEndpoint supabaseEndpoint;

  public static void main(String[] args) {

    System.setProperty("server.port", "8080");

    // Optional, if you are using supabase for authentication
    Properties properties = new Properties();
    properties.setProperty("supabase.url", "");
    properties.setProperty("supabase.annon.key", "");

    // For DB config
    properties.setProperty("postgres.db.host", "");
    properties.setProperty("postgres.db.username", "postgres");
    properties.setProperty("postgres.db.password", "");

    // For JWT decode
    properties.setProperty("jwt.secret", "");

    new SpringApplicationBuilder(SupabaseExample.class).properties(properties).run(args);

    supabaseEndpoint = new SupabaseEndpoint();
  }


  @RestController
  @RequestMapping("/v1")
  public class SupabaseController {

    @PostMapping(
        value =
            "/signup") // Confirmation email is sent to the specified address.. Click on "Confirm
    // your mail"
    public SupabaseUser signUp(ArkRequest arkRequest) {
      JSONObject json = arkRequest.getBody();
      return supabaseEndpoint.signup(json.getString("email"), json.getString("password"));
    }

    @PostMapping(value = "/login")
    public AuthenticatedResponse login(ArkRequest arkRequest) {
      JSONObject json = arkRequest.getBody();
      return supabaseEndpoint.login(json.getString("email"), json.getString("password"));
    }

    @PostMapping(value = "/refreshToken")
    public AuthenticatedResponse refreshToken(ArkRequest arkRequest) {

      JSONObject json = arkRequest.getBody();
      return supabaseEndpoint.refreshToken(json.getString("refreshToken"));
    }

    @PostMapping(value = "/signout")
    @PreAuthorize("hasAuthority('authenticated')")
    public void signOut(ArkRequest arkRequest) {
      String accessToken = AuthUtils.extractToken(arkRequest);
      supabaseEndpoint.signOut(accessToken);
    }

    @GetMapping("/test")
    @PreAuthorize("hasAuthority('authenticated')")
    public Observable<String> get() throws IOException {
      return Observable.just("Hello World");
    }
  }
}

package com.edgechain;

import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import com.edgechain.lib.configuration.domain.SupabaseEnv;
import com.edgechain.lib.endpoint.impl.SupabaseEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import com.edgechain.lib.supabase.utils.AuthUtils;
import io.reactivex.rxjava3.core.Observable;
import org.json.JSONObject;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;

@SpringBootApplication
public class SupabaseExample {

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(SupabaseExample.class, args);
  }

  /* Optional (if you are not using Supabase or PostgreSQL),always create bean with @Primary annotation */
  // If you want to use PostgreSQL only; then just provide dbHost, dbUsername & dbPassword
  @Bean
  @Primary
  public SupabaseEnv supabaseEnv() {
    SupabaseEnv env = new SupabaseEnv();
    env.setUrl(""); // SupabaseURL
    env.setAnnonKey(""); // Supabase AnnonKey
    env.setJwtSecret(""); // Supabase JWTSecret
    env.setDbHost(""); // jdbc:postgresql://${SUPABASE_DB_URK}/postgres
    env.setDbUsername("postgres");
    env.setDbPassword("");
    return env;
  }

  /**
   * Optional, Create it to exclude api calls from filtering; otherwise API calls will filter via
   * ROLE_BASE access *
   */
  @Bean
  @Primary
  public ExcludeMappingFilter mappingFilter() {
    ExcludeMappingFilter mappingFilter = new ExcludeMappingFilter();
    mappingFilter.setRequestPost(List.of("/v1/signup", "/v1/login", "/v1/refreshToken"));
    return mappingFilter;
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
      SupabaseEndpoint endpoint = new SupabaseEndpoint();

      return endpoint.signup(json.getString("email"), json.getString("password"));
    }

    @PostMapping(value = "/login")
    public AuthenticatedResponse login(ArkRequest arkRequest) {

      JSONObject json = arkRequest.getBody();
      SupabaseEndpoint endpoint = new SupabaseEndpoint();

      return endpoint.login(json.getString("email"), json.getString("password"));
    }

    @PostMapping(value = "/refreshToken")
    public AuthenticatedResponse refreshToken(ArkRequest arkRequest) {

      JSONObject json = arkRequest.getBody();
      SupabaseEndpoint endpoint = new SupabaseEndpoint();

      return endpoint.refreshToken(json.getString("refreshToken"));
    }

    @PostMapping(value = "/signout")
    @PreAuthorize("hasAuthority('authenticated')")
    public void signOut(ArkRequest arkRequest) {
      String accessToken = AuthUtils.extractToken(arkRequest);
      SupabaseEndpoint endpoint = new SupabaseEndpoint();
      endpoint.signOut(accessToken);
    }

    @GetMapping("/test")
    @PreAuthorize("hasAuthority('authenticated')")
    public Observable<String> get() throws IOException {
      return Observable.just("Hello World");
    }
  }
}

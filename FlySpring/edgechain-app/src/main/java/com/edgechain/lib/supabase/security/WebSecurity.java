package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.domain.AuthFilter;
import java.util.Arrays;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@EnableWebSecurity
@EnableMethodSecurity
@Configuration
public class WebSecurity {

  @Autowired private Environment env;
  @Autowired private AuthFilter authFilter;
  @Autowired private JwtFilter jwtFilter;

  @Bean
  AuthenticationManager authenticationManager(AuthenticationConfiguration config)
      throws Exception {
    return config.getAuthenticationManager();
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

    http.cors(cors -> cors.configurationSource(corsConfiguration()))
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> buildAuth(auth))
        .httpBasic(Customizer.withDefaults())
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .sessionManagement(
            management -> management.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(Customizer.withDefaults())
        .securityContext(c -> c.requireExplicitSave(false))
        .formLogin(login -> login.disable());
    return http.build();
  }

  private AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry buildAuth(
      AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry auth) {    
    AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry reg = auth
        .requestMatchers("" + WebConfiguration.CONTEXT_PATH + "/**")
        .permitAll();
    
    reg = reg
        .requestMatchers(HttpMethod.POST, authFilter.getRequestPost().getRequests())
        .hasAnyAuthority(authFilter.getRequestPost().getAuthorities());
    
    reg = reg
        .requestMatchers(HttpMethod.GET, authFilter.getRequestGet().getRequests())
        .hasAnyAuthority(authFilter.getRequestGet().getAuthorities());
        
    reg = reg
        .requestMatchers(HttpMethod.DELETE, authFilter.getRequestDelete().getRequests())
        .hasAnyAuthority(authFilter.getRequestDelete().getAuthorities());
        
    reg = reg
        .requestMatchers(HttpMethod.PUT, authFilter.getRequestPut().getRequests())
        .hasAnyAuthority(authFilter.getRequestPut().getAuthorities());
        
    reg = reg
        .requestMatchers(HttpMethod.PATCH, authFilter.getRequestPatch().getRequests())
        .hasAnyAuthority(authFilter.getRequestPatch().getAuthorities());
        
    reg = reg
        .anyRequest()
        .permitAll();
    return reg;
  }

  @Bean
  CorsConfigurationSource corsConfiguration() {

    CorsConfiguration configuration = new CorsConfiguration();

    String cors = env.getProperty("cors.origins");

    if (Objects.nonNull(cors) && !cors.isEmpty()) {
      configuration.setAllowedOrigins(Arrays.stream(cors.split(",")).toList());
    }

    configuration.setAllowCredentials(true);
    configuration.setAllowedMethods(
        Arrays.asList("GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE", "HEAD"));
    configuration.setAllowedHeaders(
        Arrays.asList(
            "Origin",
            "Content-Type",
            "Accept",
            "Access-Control-Allow-Headers",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers",
            "X-Requested-With",
            "Authorization",
            "Stream"));
    configuration.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);

    return source;
  }

  @Bean
  FilterRegistrationBean<CorsFilter> corsFilter() {
    FilterRegistrationBean<CorsFilter> bean =
        new FilterRegistrationBean<>(new CorsFilter(corsConfiguration()));
    bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return bean;
  }

  @Bean
  FilterRegistrationBean<JwtFilter> jwtFilterFilterRegistrationBean(JwtFilter jwtFilter) {
    FilterRegistrationBean<JwtFilter> registrationBean = new FilterRegistrationBean<>(jwtFilter);
    registrationBean.setEnabled(false);
    return registrationBean;
  }
}

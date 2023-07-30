package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.domain.AuthFilter;
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
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.Objects;

@EnableWebSecurity
@EnableMethodSecurity
@Configuration
public class WebSecurity {


  @Autowired private Environment env;
  @Autowired private AuthFilter authFilter;
  @Autowired private JwtFilter jwtFilter;


  @Bean
  public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
      throws Exception {
    return config.getAuthenticationManager();
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {



    return http.cors()
        .configurationSource(corsConfiguration())
        .and()
        .csrf()
        .disable()
        .authorizeHttpRequests(
            (auth) -> {
              try {
                auth.requestMatchers(""+ WebConfiguration.CONTEXT_PATH+"/**").permitAll()

                        .requestMatchers(HttpMethod.POST, authFilter.getRequestPost().getRequests())
                        .hasAnyAuthority(authFilter.getRequestPost().getAuthorities())
//
                        .requestMatchers(HttpMethod.GET, authFilter.getRequestGet().getRequests())
                        .hasAnyAuthority(authFilter.getRequestGet().getAuthorities())

                        .requestMatchers(HttpMethod.DELETE, authFilter.getRequestDelete().getRequests())
                        .hasAnyAuthority(authFilter.getRequestDelete().getAuthorities())

                        .requestMatchers(HttpMethod.PUT, authFilter.getRequestPut().getRequests())
                        .hasAnyAuthority(authFilter.getRequestPut().getAuthorities())

                        .requestMatchers(HttpMethod.PATCH, authFilter.getRequestPatch().getRequests())
                        .hasAnyAuthority(authFilter.getRequestPatch().getAuthorities())

                        .anyRequest().permitAll();

              } catch (Exception e) {
                throw new RuntimeException(e);
              }
            })
        .httpBasic(Customizer.withDefaults())
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .sessionManagement()
        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        .and()
        .exceptionHandling()
        .and()
        .securityContext(c -> c.requireExplicitSave(false))
        .formLogin()
        .disable()
        .build();
  }

  @Bean
  public CorsConfigurationSource corsConfiguration() {


    CorsConfiguration configuration = new CorsConfiguration();

    String cors = env.getProperty("cors.origins");

    if(Objects.nonNull(cors) && !cors.isEmpty()) {
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
  public FilterRegistrationBean<CorsFilter> corsFilter() {
    FilterRegistrationBean<CorsFilter> bean =
        new FilterRegistrationBean<>(new CorsFilter(corsConfiguration()));
    bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return bean;
  }

  @Bean
  public FilterRegistrationBean<JwtFilter> jwtFilterFilterRegistrationBean(JwtFilter jwtFilter) {
    FilterRegistrationBean<JwtFilter> registrationBean = new FilterRegistrationBean<>(jwtFilter);
    registrationBean.setEnabled(false);
    return registrationBean;
  }
}

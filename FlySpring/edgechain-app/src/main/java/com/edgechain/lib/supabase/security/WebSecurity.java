package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

@EnableWebSecurity
@EnableMethodSecurity
@Configuration
public class WebSecurity {

  @Autowired private ExcludeMappingFilter mappingFilter;
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
        .and()
        .csrf()
        .disable()
        .authorizeHttpRequests(
            (auth) -> {
              try {
                auth.requestMatchers("/v2/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, mappingFilter.getRequestPost())
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, mappingFilter.getRequestGet())
                    .permitAll()
                    .requestMatchers(HttpMethod.DELETE, mappingFilter.getRequestDelete())
                    .permitAll()
                    .requestMatchers(HttpMethod.PUT, mappingFilter.getRequestPut())
                    .permitAll()
                    .requestMatchers(HttpMethod.PATCH, mappingFilter.getRequestPatch())
                    .permitAll()
                    .anyRequest()
                    .authenticated();
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
  public FilterRegistrationBean<JwtFilter> jwtFilterFilterRegistrationBean(JwtFilter jwtFilter) {
    FilterRegistrationBean<JwtFilter> registrationBean = new FilterRegistrationBean<>(jwtFilter);
    registrationBean.setEnabled(false);
    return registrationBean;
  }
}

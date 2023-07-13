package com.app.supabase.security;

import org.springframework.beans.factory.annotation.Autowired;
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

  @Autowired private JwtFilter jwtFilter;

  @Autowired private JwtAuthenticationEntryPoint entryPoint;

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

    http.cors()
        .and()
        .csrf()
        .disable()
        .authorizeHttpRequests(
            (auth) -> {
              try {
                auth.requestMatchers(HttpMethod.POST, "/signup", "/login")
                    .permitAll()
                    .anyRequest()
                    .authenticated()
                    .and()
                    .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                    .sessionManagement()
                    .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                    .and()
                    .exceptionHandling()
                    .authenticationEntryPoint(entryPoint);
              } catch (Exception e) {
                throw new RuntimeException(e);
              }
            })
        .httpBasic(Customizer.withDefaults());
    return http.build();
  }

  //    @Bean
  //    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  //
  //
  //
  //
  //        http
  //                .cors().and().csrf().disable() // Customize Cors w.r.t your requirements...
  //                .authorizeHttpRequests((auth) -> {
  //                    try {
  //                        auth.requestMatchers(HttpMethod.POST, ).permitAll()
  //                                .requestMatchers(HttpMethod.GET,
  // "/test").hasAuthority("ROLE_ADMIN")
  //                                .anyRequest().authenticated()
  //                                .and()
  //                                .authenticationProvider(authenticationProvider())
  //                                .addFilterBefore(jwtFilter,
  // UsernamePasswordAuthenticationFilter.class)
  //
  // .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
  //                    } catch (final Exception e) {
  //                        throw new RuntimeException(e.getMessage());
  //                    }
  //                });
  //
  //        return http.build();
  //    }

}

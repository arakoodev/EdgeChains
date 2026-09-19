package com.flyspring.autoroute;

import java.util.*;
import java.util.stream.Collectors;

import org.reflections.Reflections;
import org.reflections.scanners.SubTypesScanner;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.*;
import org.springframework.security.config.web.server.ServerHttpSecurity.AuthorizeExchangeSpec;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.*;

import reactor.core.publisher.Mono;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
@EnableWebFluxSecurity
public class AuthConfig {

  @Autowired private AuthProperties authProperties;

  @Bean
  public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
    if (authProperties.type == null || authProperties.type.isEmpty())
      return http.authorizeExchange().anyExchange().permitAll().and().cors().and().build();

    AuthorizeExchangeSpec spec = http.authorizeExchange();
    requireRoles(spec);
    spec.pathMatchers("/route/secured/**").authenticated();
    spec.pathMatchers("/**").permitAll();
    http.cors()
        .and()
        .oauth2ResourceServer()
        .jwt()
        .jwtAuthenticationConverter(grantedAuthoritiesExtractor());
    return http.build();
  }

  private void requireRoles(AuthorizeExchangeSpec spec) {
    String requestPrefix = "/route/secured/role/";
    String rootPackage = "com.application.project.myapi.secured.role";
    Reflections reflections = new Reflections(rootPackage, new SubTypesScanner(false));
    Set<String> roles = new HashSet<>();
    reflections.getSubTypesOf(Object.class).stream()
        .forEach(
            clazz -> {
              String name = clazz.getPackage().getName();
              if (name.equals(rootPackage)) return;
              name = name.replace(rootPackage + ".", "");
              if (name.contains(".")) return;
              roles.add(name);
            });
    for (String role : roles) {
      spec.pathMatchers(requestPrefix + role + "/**").hasRole(role.toUpperCase());
    }
  }

  @Bean
  @ConditionalOnProperty(prefix = "flyspring.auth", name = "type", havingValue = "auth0")
  ReactiveJwtDecoder jwtDecoder() {
    NimbusReactiveJwtDecoder jwtDecoder =
        (NimbusReactiveJwtDecoder)
            ReactiveJwtDecoders.fromOidcIssuerLocation(authProperties.issuer);

    OAuth2TokenValidator<Jwt> audienceValidator = new AudienceValidator(authProperties.audience);
    OAuth2TokenValidator<Jwt> withIssuer =
        JwtValidators.createDefaultWithIssuer(authProperties.issuer);
    OAuth2TokenValidator<Jwt> withAudience =
        new DelegatingOAuth2TokenValidator<>(
            withIssuer, audienceValidator, new JwtTimestampValidator());

    jwtDecoder.setJwtValidator(withAudience);

    return jwtDecoder;
  }

  Converter<Jwt, Mono<AbstractAuthenticationToken>> grantedAuthoritiesExtractor() {
    GrantedAuthoritiesExtractor extractor =
        new GrantedAuthoritiesExtractor(authProperties.audience);
    return new ReactiveJwtAuthenticationConverterAdapter(extractor);
  }

  static class GrantedAuthoritiesExtractor extends JwtAuthenticationConverter {
    private String audience;

    public GrantedAuthoritiesExtractor(String audience) {
      super();
      this.audience = audience;
    }

    protected Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
      Collection<String> authorities =
          (Collection<String>) jwt.getClaims().get(audience + "/roles");
      if (authorities == null) authorities = new LinkedList<String>();
      return authorities.stream()
          .map(role -> "ROLE_" + role)
          .map(SimpleGrantedAuthority::new)
          .collect(Collectors.toList());
    }
  }
}

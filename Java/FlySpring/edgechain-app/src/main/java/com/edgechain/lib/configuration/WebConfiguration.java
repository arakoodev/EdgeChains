package com.edgechain.lib.configuration;

import com.edgechain.lib.configuration.domain.AuthFilter;
import com.edgechain.lib.configuration.domain.MethodAuthentication;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import java.util.List;
import java.util.UUID;
import org.modelmapper.ModelMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestTemplate;

@Configuration("WebConfiguration")
@Import(EdgeChainAutoConfiguration.class)
public class WebConfiguration {

  public static final String CONTEXT_PATH = "/edgechains";

  @Bean
  ModelMapper modelMapper() {
    return new ModelMapper();
  }

  @Bean
  RestTemplate restTemplate() {
    return new RestTemplate();
  }

  @Bean
  @Primary
  SecurityUUID securityUUID() {
    return new SecurityUUID(UUID.randomUUID().toString());
  }

  @Bean
  AuthFilter authFilter() {
    AuthFilter filter = new AuthFilter();
    filter.setRequestPost(new MethodAuthentication(List.of("**"), ""));
    filter.setRequestGet(new MethodAuthentication(List.of("**"), ""));
    filter.setRequestDelete(new MethodAuthentication(List.of("**"), ""));
    filter.setRequestPatch(new MethodAuthentication(List.of("**"), ""));
    filter.setRequestPut(new MethodAuthentication(List.of("**"), ""));

    return filter;
  }
}

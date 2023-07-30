package com.edgechain.lib.configuration;

import com.edgechain.lib.configuration.domain.AuthFilter;
import com.edgechain.lib.configuration.domain.MethodAuthentication;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import org.modelmapper.ModelMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.UUID;

@Configuration("WebConfiguration")
@Import(EdgeChainAutoConfiguration.class)
public class WebConfiguration {

  public static final String CONTEXT_PATH = "/v2";

  @Bean
  public ModelMapper modelMapper() {
    return new ModelMapper();
  }

  @Bean
  public RestTemplate restTemplate() {
    return new RestTemplate();
  }

  @Bean
  @Primary
  public SecurityUUID securityUUID()
  {

    String uuid = UUID.randomUUID().toString();
    System.out.println(uuid);

    return new SecurityUUID(uuid);
  }

  @Bean
  public AuthFilter authFilter() {
    AuthFilter filter = new AuthFilter();
    filter.setRequestPost(new MethodAuthentication(List.of(""), ""));
    filter.setRequestGet(new MethodAuthentication(List.of(""), ""));
    filter.setRequestDelete(new MethodAuthentication(List.of(""), ""));
    filter.setRequestPatch(new MethodAuthentication(List.of(""), ""));
    filter.setRequestPut(new MethodAuthentication(List.of(""), ""));

    return filter;
  }


}

package com.edgechain.lib.configuration;

import com.edgechain.lib.configuration.domain.*;
import org.modelmapper.ModelMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

@Configuration("WebConfiguration")
@Import(EdgeChainAutoConfiguration.class)
public class WebConfiguration {

  @Bean
  public ModelMapper modelMapper() {
    return new ModelMapper();
  }

  @Bean
  public RestTemplate restTemplate() {
    return new RestTemplate();
  }

  @Bean
  public SupabaseEnv supabaseEnv() {
    return new SupabaseEnv();
  }

  @Bean
  public RedisEnv redisEnv() {
    return new RedisEnv();
  }

  @Bean
  public ExcludeMappingFilter mappingFilter() {
    return new ExcludeMappingFilter();
  }

  @Bean
  public SecurityUUID securityUUID() {
    return new SecurityUUID(UUID.randomUUID().toString());
  }

  @Bean
  public CorsEnableOrigins corsEnableOrigins() {
    return new CorsEnableOrigins();
  }
}

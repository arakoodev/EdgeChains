package com.edgechain.lib.configuration;

import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import com.edgechain.lib.configuration.domain.RedisEnv;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.configuration.domain.SupabaseEnv;
import org.modelmapper.ModelMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
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
}

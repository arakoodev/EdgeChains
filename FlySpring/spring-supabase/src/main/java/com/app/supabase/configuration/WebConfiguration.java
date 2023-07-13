package com.app.supabase.configuration;

import org.modelmapper.ModelMapper;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class WebConfiguration {

  @Bean
  public RestTemplate restTemplate() {
    return new RestTemplate();
  }

  @Bean
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

  @Bean
  public ModelMapper modelMapper() {
    return new ModelMapper();
  }
}

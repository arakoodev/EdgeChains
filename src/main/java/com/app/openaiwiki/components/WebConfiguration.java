package com.app.openaiwiki.components;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
;
import org.springframework.web.client.RestTemplate;

@Configuration
public class WebConfiguration {

  @Bean
  public RestTemplate restTemplate() {
    return new RestTemplate();
  }
}

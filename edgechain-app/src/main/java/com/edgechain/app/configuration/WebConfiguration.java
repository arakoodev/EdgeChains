package com.edgechain.app.configuration;

import feign.codec.Decoder;
import feign.codec.Encoder;
import feign.jackson.JacksonDecoder;
import feign.jackson.JacksonEncoder;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

@Order(Ordered.HIGHEST_PRECEDENCE)
@Configuration
@EnableFeignClients(basePackages = {"com.edgechain.app"})
public class WebConfiguration {

  @Bean
  public Decoder decoder() {
    return new JacksonDecoder();
  }

  @Bean
  public Encoder encoder() {
    return new JacksonEncoder();
  }
}

package com.edgechain;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.handler.HandlerMappingIntrospector;

@SpringBootApplication
public class EdgeChainApplication  {


  public static void main(String[] args) {

    SpringApplication springApplication =
            new SpringApplicationBuilder()
                    .sources(EdgeChainApplication.class).web(WebApplicationType.NONE)
                    .build();

    springApplication.run(args);
  }

  @Bean(name = "mvcHandlerMappingIntrospector")
  public HandlerMappingIntrospector mvcHandlerMappingIntrospector() {
    return new HandlerMappingIntrospector();
  }
}

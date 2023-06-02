// usr/bin/env jbang "$0" "$@" ; exit $?
// DEPS org.springframework.boot:spring-boot-starter-webflux:2.6.2

package com.edgechain.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app"})
@ImportAutoConfiguration({FeignAutoConfiguration.class})
public class EdgeChainApplication {

  public static void main(String[] args) {
    System.setProperty("spring.application.name", "edgechain-app");
    System.setProperty("server.port", "8002");
    SpringApplication.run(EdgeChainApplication.class, args);
  }

  @RestController
  public class ExampleController {

    @GetMapping("/v1/example")
    public Mono<String> example() {
      return Mono.just("It's working perfectly...");
    }
  }
}

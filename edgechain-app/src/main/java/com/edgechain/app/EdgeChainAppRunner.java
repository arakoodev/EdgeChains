package com.edgechain.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app"})
@ImportAutoConfiguration({FeignAutoConfiguration.class})
public class EdgeChainAppRunner {

  public static void main(String[] args) {
    System.setProperty("spring.application.name", "edgechain-app");
    System.setProperty("server.port", "8002");
    SpringApplication.run(EdgeChainAppRunner.class, args);
  }
}

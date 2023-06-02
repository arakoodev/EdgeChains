package com.edgechain.service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"com.edgechain.service"})
public class EdgeChainServiceRunner {

  public static void main(String[] args) {
    System.setProperty("spring.application.name", "edgechain-service");
    System.setProperty("server.port", "8001");
    SpringApplication.run(EdgeChainServiceRunner.class, args);
  }
}

package com.flyspring.flyfly;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class FlyflyApplication {

  public static void main(String[] args) {
    System.exit(SpringApplication.exit(SpringApplication.run(FlyflyApplication.class, args)));
  }
}

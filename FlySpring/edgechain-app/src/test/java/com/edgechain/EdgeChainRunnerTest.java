package com.edgechain;

import com.edgechain.lib.configuration.domain.RedisEnv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;


@SpringBootApplication
public class EdgeChainRunnerTest {

  public static void main(String[] args) {
    SpringApplication.run(EdgeChainRunnerTest.class, args);
  }
}

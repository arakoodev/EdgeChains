package com.edgechain.app;

import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app"})
@ImportAutoConfiguration({FeignAutoConfiguration.class})
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainAppRunner {


  public static void main(String[] args) {
    System.setProperty("spring.application.name", "edgechain-app");
    System.setProperty("server.port", "8003");

    System.setProperty("spring.data.redis.host","");
    System.setProperty("spring.data.redis.port","");
    System.setProperty("spring.data.redis.username","");
    System.setProperty("spring.data.redis.password", "");

    SpringApplication.run(EdgeChainAppRunner.class, args);


  }


}

package com.edgechain.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;

@SpringBootApplication
@ImportAutoConfiguration({FeignAutoConfiguration.class})
public class EdgeChainAppRunner {
    
    public static void main(String[] args) {
        SpringApplication.run(EdgeChainAppRunner.class, args);
    }



}

package com.app.openaiwiki;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.app.openaiwiki", "com.app.rxjava", "com.app.openai"})
public class OpenaiWikiApplication implements CommandLineRunner {

    public static void main(String[] args) {
        SpringApplication.run(OpenaiWikiApplication.class, args);
    }

    @Override
    public void run(String... args) throws Exception {

    }




}

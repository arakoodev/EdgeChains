package com.app.openaiwiki;

import com.app.openai.plugin.response.PluginResponse;
import com.app.openai.plugin.tool.ApiConfig;
import com.app.openai.plugin.tool.PluginTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;


@SpringBootApplication
@ComponentScan(basePackages = {"com.app.openaiwiki", "com.app.rxjava"})
public class OpenaiWikiApplication implements CommandLineRunner {

    public static void main(String[] args) {
        SpringApplication.run(OpenaiWikiApplication.class, args);
    }

    @Override
    public void run(String... args) throws Exception {

    }




}

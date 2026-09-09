package com.edgechain;

import java.net.URL;
import java.nio.file.Paths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.handler.HandlerMappingIntrospector;

@SpringBootApplication
public class EdgeChainApplication {

  private static final Logger logger = LoggerFactory.getLogger(EdgeChainApplication.class);

  public static void main(String[] args) {

    logger.info("Please avoid special symbols such as space in naming the directory.");
    String jarFileName = getJarFileName(EdgeChainApplication.class);
    System.setProperty("jar.name", jarFileName);
    logger.info("Executed jar file: {}", jarFileName);

    SpringApplication springApplication =
        new SpringApplicationBuilder()
            .sources(EdgeChainApplication.class)
            .web(WebApplicationType.NONE)
            .build();

    springApplication.run(args);
  }

  @Bean(name = "mvcHandlerMappingIntrospector")
  HandlerMappingIntrospector mvcHandlerMappingIntrospector() {
    return new HandlerMappingIntrospector();
  }

  private static String getJarFileName(Class<?> clazz) {
    URL classResource = clazz.getResource(clazz.getSimpleName() + ".class");
    if (classResource == null) {
      throw new RuntimeException("class resource is null");
    }

    String url = classResource.toString();
    logger.info("class url: {}", url);
    if (url.startsWith("jar:file:")) {
      String path = url.replaceAll("^jar:(file:.*[.]jar)!/.*", "$1");
      try {
        return Paths.get(new URL(path).toURI()).toString();
      } catch (Exception e) {
        throw new RuntimeException("Invalid jar file", e);
      }
    }
    throw new RuntimeException("Invalid jar file");
  }
}

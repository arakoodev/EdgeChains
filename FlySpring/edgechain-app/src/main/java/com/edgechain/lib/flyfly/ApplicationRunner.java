package com.edgechain.lib.flyfly;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import picocli.CommandLine;
import java.util.Map;

@Component
public class ApplicationRunner implements CommandLineRunner {

  @Autowired private FlyflyCommand runCommand;
  @Autowired private CommandLine.IFactory factory;
  @Autowired private ApplicationContext context;

  @Override
  public void run(String... args) throws Exception {
    if (getBootLoaderClass().contains("com.edgechain.EdgeChainApplication")) {
      new CommandLine(runCommand, factory).execute(args);
    }
  }

  public String getBootLoaderClass() {
    Map<String, Object> annotatedBeans =
        context.getBeansWithAnnotation(SpringBootApplication.class);
    return annotatedBeans.isEmpty()
        ? null
        : annotatedBeans.values().toArray()[0].getClass().getName();
  }
}

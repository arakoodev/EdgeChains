package com.edgechain.lib.flyfly;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.ExitCodeGenerator;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import picocli.CommandLine;

import java.util.Map;

@Component
public class CustomApplicationRunner implements CommandLineRunner, ExitCodeGenerator {

  @Autowired private FlyflyCommand runCommand;
  @Autowired private CommandLine.IFactory factory; // auto-configured to inject PicocliSpringFactory

  @Autowired private ApplicationContext context;

  private int exitCode;

  @Override
  public void run(String... args) throws Exception {
    if (getBootLoaderClass().contains("com.edgechain.EdgeChainApplication")) {
      exitCode = new CommandLine(runCommand, factory).execute(args);
    }
  }

  public String getBootLoaderClass() {
    Map<String, Object> annotatedBeans =
        context.getBeansWithAnnotation(SpringBootApplication.class);
    return annotatedBeans.isEmpty()
        ? null
        : annotatedBeans.values().toArray()[0].getClass().getName();
  }

  @Override
  public int getExitCode() {
    return exitCode;
  }
}

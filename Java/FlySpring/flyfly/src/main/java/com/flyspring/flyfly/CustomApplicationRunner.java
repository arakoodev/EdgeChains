package com.flyspring.flyfly;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.*;
import org.springframework.stereotype.Component;

import picocli.CommandLine;
import picocli.CommandLine.IFactory;

@Component
public class CustomApplicationRunner implements CommandLineRunner, ExitCodeGenerator {
  @Autowired private FlyflyCommand runCommand;
  @Autowired private IFactory factory; // auto-configured to inject PicocliSpringFactory

  private int exitCode;

  @Override
  public void run(String... args) throws Exception {
    exitCode = new CommandLine(runCommand, factory).execute(args);
  }

  @Override
  public int getExitCode() {
    return exitCode;
  }
}

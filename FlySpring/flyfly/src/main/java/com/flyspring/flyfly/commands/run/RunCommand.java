package com.flyspring.flyfly.commands.run;

import java.io.File;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.flyspring.flyfly.utils.ProjectTypeChecker;

import lombok.extern.slf4j.Slf4j;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

@Component
@Command(name = "run", description = "Run a JAR or Gradle Spring Boot Application")
@Slf4j
public class RunCommand implements Runnable {

  @Parameters(hidden = true)
  File[] files;

  @Autowired ProjectRunner projectRunner;
  @Autowired ProjectTypeChecker projectTypeChecker;
  @Autowired JarRunner jarRunner;

  @Override
  public void run() {
    if (files != null && files.length > 0) jarRunner.run(files[0]);
    else if (projectTypeChecker.isGradleProject()) projectRunner.run();
    else {
      log.error("Couldn't find build.gradle");
      log.error("Please try again inside the project directory");
    }
  }
}

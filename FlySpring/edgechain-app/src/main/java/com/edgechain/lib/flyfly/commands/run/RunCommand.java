package com.edgechain.lib.flyfly.commands.run;

import java.io.File;

import com.edgechain.lib.flyfly.utils.ProjectTypeChecker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

@Component
@Command(
    name = "run",
    description =
        "Run a JAR or Gradle Spring Boot Application. Ignore if your application is executed.",
    hidden = true)
public class RunCommand implements Runnable {

  private final Logger log = LoggerFactory.getLogger(this.getClass());

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

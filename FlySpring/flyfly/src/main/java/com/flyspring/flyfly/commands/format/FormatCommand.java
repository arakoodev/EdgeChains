package com.flyspring.flyfly.commands.format;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.flyspring.flyfly.utils.ProjectTypeChecker;

import lombok.extern.slf4j.Slf4j;
import picocli.CommandLine.Command;

@Component
@Command(name = "format", description = "Format code with Spotless")
@Slf4j
public class FormatCommand implements Runnable {
  @Autowired Formatter formatter;
  @Autowired ProjectTypeChecker projectTypeChecker;

  @Override
  public void run() {
    if (projectTypeChecker.isGradleProject()) formatter.format();
    else {
      log.error("Couldn't find build.gradle");
      log.error("Please try again inside the project directory");
    }
  }
}

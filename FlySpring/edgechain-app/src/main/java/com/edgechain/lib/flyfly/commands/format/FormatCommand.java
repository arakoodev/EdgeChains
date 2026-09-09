package com.edgechain.lib.flyfly.commands.format;

import com.edgechain.lib.flyfly.utils.ProjectTypeChecker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import picocli.CommandLine.Command;

@Component
@Command(name = "format", description = "Format code with Spotless", hidden = true)
public class FormatCommand implements Runnable {

  private final Logger log = LoggerFactory.getLogger(this.getClass());

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

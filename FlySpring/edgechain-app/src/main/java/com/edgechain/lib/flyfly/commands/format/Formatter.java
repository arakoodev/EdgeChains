package com.edgechain.lib.flyfly.commands.format;

import com.edgechain.lib.flyfly.utils.ProjectSetup;
import org.apache.commons.lang3.SystemUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class Formatter {
  @Autowired ProjectSetup projectSetup;

  private final Logger log = LoggerFactory.getLogger(this.getClass());

  void format() {
    try {
      log.info("Checking formatting configuration");
      if (!projectSetup.formatScriptExists()) {
        log.info("Configuring Spotless");
        projectSetup.addFormatScript();
      }
      log.info("Running Spotless");
      String[] command;
      if (SystemUtils.IS_OS_WINDOWS)
        command = new String[] {"cmd", "/c", "gradlew.bat -I .flyfly/format.gradle spotlessApply"};
      else
        command = new String[] {"bash", "-c", "./gradlew -I .flyfly/format.gradle spotlessApply"};

      ProcessBuilder pb = new ProcessBuilder(command);
      pb.inheritIO();
      pb.start().waitFor();
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
}

package com.flyspring.flyfly.commands.format;

import org.apache.commons.lang3.SystemUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.flyspring.flyfly.utils.ProjectSetup;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class Formatter {
  @Autowired ProjectSetup projectSetup;

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

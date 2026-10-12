package com.flyspring.flyfly.commands.run;

import java.io.File;
import java.io.IOException;

import org.apache.commons.lang3.SystemUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.flyspring.flyfly.utils.FileTools;
import com.flyspring.flyfly.utils.ProjectSetup;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class JarRunner {
  @Autowired ProjectSetup projectSetup;
  @Autowired FileTools fileTools;

  public void run(File jarFile) {
    try {
      log.info("Checking if glowroot agent exists");
      if (!projectSetup.glowrootAgentExists()) {
        log.info("Agent doesn't exist");
        log.info("Adding glowroot agent");
        projectSetup.addGlowrootAgent();
      }
      log.info("Runnng the jar");
      String agentPath = projectSetup.getGlowrootAgentPath();
      String jarPath = jarFile.getAbsolutePath();
      String[] command;
      if (SystemUtils.IS_OS_WINDOWS)
        command = new String[] {"cmd", "/c", "java -javaagent:" + agentPath + " -jar " + jarPath};
      else
        command = new String[] {"bash", "-c", "java -javaagent:" + agentPath + " -jar " + jarPath};

      ProcessBuilder pb = new ProcessBuilder(command);
      pb.inheritIO();
      pb.start().waitFor();
    } catch (IOException | InterruptedException e) {
      e.printStackTrace();
    }
  }
}

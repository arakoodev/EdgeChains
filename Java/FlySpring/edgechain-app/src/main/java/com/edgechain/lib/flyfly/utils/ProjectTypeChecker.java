package com.edgechain.lib.flyfly.utils;

import java.io.File;
import org.springframework.stereotype.Component;

@Component
public class ProjectTypeChecker {

  public boolean isMavenProject() {
    File dir = new File(System.getProperty("user.dir"));
    for (File file : dir.listFiles()) if (file.getName().equals("pom.xml")) return true;
    return false;
  }

  public boolean isGradleProject() {
    File dir = new File(System.getProperty("user.dir"));
    for (File file : dir.listFiles()) if (file.getName().equals("build.gradle")) return true;
    return false;
  }
}

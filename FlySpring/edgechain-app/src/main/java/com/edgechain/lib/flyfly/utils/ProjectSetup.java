package com.edgechain.lib.flyfly.utils;

import java.io.File;
import java.io.IOException;
import java.nio.file.FileSystems;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ProjectSetup {

  private final Logger log = LoggerFactory.getLogger(this.getClass());

  @Autowired FileTools fileTools;

  private String userHome = System.getProperty("user.home");
  private String separator = FileSystems.getDefault().getSeparator();
  private String initscriptDir =
      userHome + separator + ".gradle" + separator + "init.d" + separator + "flyfly.gradle";
  private String flyflyDir = System.getProperty("user.dir") + separator + ".flyfly";
  private String formatScriptDir = flyflyDir + separator + "format.gradle";
  private String autorouteDir = flyflyDir + separator + "autoroute.jar";
  private String glowrootDir = flyflyDir + separator + "glowroot";

  public boolean initscriptExists() {
    log.debug("Checking if flyfly.gradle exists in {}", initscriptDir);
    return new File(initscriptDir).exists();
  }

  public void addInitscript() throws IOException {
    File initDir = new File(userHome + separator + ".gradle" + separator + "init.d");
    if (!initDir.exists()) initDir.mkdirs();
    fileTools.exportFileTo("flyfly.gradle", initscriptDir);
  }

  public void addAutorouteJar() throws IOException {
    File flyflyFolder = new File(flyflyDir);
    if (!flyflyFolder.exists()) flyflyFolder.mkdirs();
    File autorouteFile = new File(autorouteDir);
    if (!autorouteFile.exists() || (autorouteFile.exists() && autorouteFile.delete()))
      fileTools.exportFileTo("autoroute.jar", autorouteDir);
  }

  public boolean formatScriptExists() {
    log.debug("Checking if format.gradle exists in {}", formatScriptDir);
    return new File(formatScriptDir).exists();
  }

  public void addFormatScript() throws IOException {
    File flyflyFolder = new File(flyflyDir);
    if (!flyflyFolder.exists()) flyflyFolder.mkdirs();
    fileTools.exportFileTo("format.gradle", formatScriptDir);
  }

  public boolean glowrootAgentExists() {
    log.debug("Checking if glowroot folder exists in {}", glowrootDir);
    return new File(glowrootDir).exists();
  }

  public void addGlowrootAgent() throws IOException {
    File flyflyFolder = new File(flyflyDir);
    if (!flyflyFolder.exists()) flyflyFolder.mkdirs();
    String zipDir = flyflyDir + separator + "glowroot.zip";
    fileTools.exportFileTo("glowroot.zip", zipDir);
    fileTools.unzip(zipDir, flyflyDir);
    new File(zipDir).delete();
  }

  public String getGlowrootAgentPath() {
    return flyflyDir + separator + "glowroot" + separator + "glowroot.jar";
  }
}

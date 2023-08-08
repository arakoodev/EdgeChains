package com.edgechain.lib.flyfly.commands.jbang;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class JbangResponse {

  private String originalResource;
  private String backingResource;
  private String applicationJar;
  private String mainClass;
  private List<String> dependencies;
  private List<String> resolvedDependencies;
  private String availableJdkPath;
  private List<String> compileOptions;
  private List<JbangFile> jbangFiles;
  private List<JbangSource> sources;

  public String getOriginalResource() {
    return originalResource;
  }

  public void setOriginalResource(String originalResource) {
    this.originalResource = originalResource;
  }

  public String getBackingResource() {
    return backingResource;
  }

  public void setBackingResource(String backingResource) {
    this.backingResource = backingResource;
  }

  public String getApplicationJar() {
    return applicationJar;
  }

  public void setApplicationJar(String applicationJar) {
    this.applicationJar = applicationJar;
  }

  public String getMainClass() {
    return mainClass;
  }

  public void setMainClass(String mainClass) {
    this.mainClass = mainClass;
  }

  public List<String> getDependencies() {
    return dependencies;
  }

  public void setDependencies(List<String> dependencies) {
    this.dependencies = dependencies;
  }

  public List<String> getResolvedDependencies() {
    return resolvedDependencies;
  }

  public void setResolvedDependencies(List<String> resolvedDependencies) {
    this.resolvedDependencies = resolvedDependencies;
  }

  public String getAvailableJdkPath() {
    return availableJdkPath;
  }

  public void setAvailableJdkPath(String availableJdkPath) {
    this.availableJdkPath = availableJdkPath;
  }

  public List<String> getCompileOptions() {
    return compileOptions;
  }

  public void setCompileOptions(List<String> compileOptions) {
    this.compileOptions = compileOptions;
  }

  public List<JbangFile> getJbangFiles() {
    return jbangFiles;
  }

  public void setJbangFiles(List<JbangFile> jbangFiles) {
    this.jbangFiles = jbangFiles;
  }

  public List<JbangSource> getSources() {
    return sources;
  }

  public void setSources(List<JbangSource> sources) {
    this.sources = sources;
  }
}

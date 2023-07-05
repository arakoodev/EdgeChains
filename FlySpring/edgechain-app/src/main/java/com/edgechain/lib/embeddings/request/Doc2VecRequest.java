package com.edgechain.lib.embeddings.request;

public class Doc2VecRequest {

  // Only For Training
  private String folderDirectory;
  private String fileInputStream; // For Input Stream ==> new FileInputStream(....)

  // Training & Use for Inferring Vectors;
  private String destination;
  private String modelName;

  private int epochs = 10;
  private int minWordFrequency = 5;
  private int iteration = 1;
  private int layerSize = 1526;
  private double learningRate = 0.025;
  private double minLearningRate = 1.0E-4;
  private int batchSize = 512;
  private int windowSize = 15;

  private int workers = Runtime.getRuntime().availableProcessors();
  private double sampling = 0.0;
  private boolean useAdaGrad = false;
  private boolean useHierarchicSoftmax = true;

  public Doc2VecRequest() {}

  public int getEpochs() {
    return epochs;
  }

  public void setEpochs(int epochs) {
    this.epochs = epochs;
  }

  public int getMinWordFrequency() {
    return minWordFrequency;
  }

  public void setMinWordFrequency(int minWordFrequency) {
    this.minWordFrequency = minWordFrequency;
  }

  public int getIteration() {
    return iteration;
  }

  public void setIteration(int iteration) {
    this.iteration = iteration;
  }

  public int getLayerSize() {
    return layerSize;
  }

  public void setLayerSize(int layerSize) {
    this.layerSize = layerSize;
  }

  public double getLearningRate() {
    return learningRate;
  }

  public void setLearningRate(double learningRate) {
    this.learningRate = learningRate;
  }

  public double getMinLearningRate() {
    return minLearningRate;
  }

  public void setMinLearningRate(double minLearningRate) {
    this.minLearningRate = minLearningRate;
  }

  public int getBatchSize() {
    return batchSize;
  }

  public void setBatchSize(int batchSize) {
    this.batchSize = batchSize;
  }

  public int getWindowSize() {
    return windowSize;
  }

  public void setWindowSize(int windowSize) {
    this.windowSize = windowSize;
  }

  public double getSampling() {
    return sampling;
  }

  public void setSampling(double sampling) {
    this.sampling = sampling;
  }

  public boolean isUseAdaGrad() {
    return useAdaGrad;
  }

  public void setUseAdaGrad(boolean useAdaGrad) {
    this.useAdaGrad = useAdaGrad;
  }

  public boolean isUseHierarchicSoftmax() {
    return useHierarchicSoftmax;
  }

  public void setUseHierarchicSoftmax(boolean useHierarchicSoftmax) {
    this.useHierarchicSoftmax = useHierarchicSoftmax;
  }

  public int getWorkers() {
    return workers;
  }

  public void setWorkers(int workers) {
    this.workers = workers;
  }

  public String getFolderDirectory() {
    return folderDirectory;
  }

  public void setFolderDirectory(String folderDirectory) {
    this.folderDirectory = folderDirectory;
  }

  public String getFileInputStream() {
    return fileInputStream;
  }

  public void setFileInputStream(String fileInputStream) {
    this.fileInputStream = fileInputStream;
  }

  public String getDestination() {
    return destination;
  }

  public void setDestination(String destination) {
    this.destination = destination;
  }

  public String getModelName() {
    return modelName;
  }

  public void setModelName(String modelName) {
    this.modelName = modelName;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("Doc2VecRequest{");
    sb.append("folderDirectory='").append(folderDirectory).append('\'');
    sb.append(", fileInputStream='").append(fileInputStream).append('\'');
    sb.append(", destination='").append(destination).append('\'');
    sb.append(", modelName='").append(modelName).append('\'');
    sb.append(", epochs=").append(epochs);
    sb.append(", minWordFrequency=").append(minWordFrequency);
    sb.append(", iteration=").append(iteration);
    sb.append(", layerSize=").append(layerSize);
    sb.append(", learningRate=").append(learningRate);
    sb.append(", minLearningRate=").append(minLearningRate);
    sb.append(", batchSize=").append(batchSize);
    sb.append(", windowSize=").append(windowSize);
    sb.append(", workers=").append(workers);
    sb.append(", sampling=").append(sampling);
    sb.append(", useAdaGrad=").append(useAdaGrad);
    sb.append(", useHierarchicSoftmax=").append(useHierarchicSoftmax);
    sb.append('}');
    return sb.toString();
  }
}

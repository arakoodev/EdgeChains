package com.edgechain.service;

import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import com.edgechain.service.constants.ServiceConstants;
import jakarta.annotation.PostConstruct;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

import java.io.File;
import java.io.FileInputStream;


@SpringBootApplication(scanBasePackages = {"com.edgechain.service"})
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainServiceRunner  {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @PostConstruct
  public void init() throws Exception {
    this.readEmbeddingDoc2VecModel();
  }

  public static void main(String[] args) {

    System.setProperty("server.port", "8002");

    System.setProperty("spring.data.redis.host","");
    System.setProperty("spring.data.redis.port","");
    System.setProperty("spring.data.redis.username","");
    System.setProperty("spring.data.redis.password", "");
    System.setProperty("spring.data.redis.connect-timeout","");



    SpringApplication.run(EdgeChainServiceRunner.class, args);
  }

  private void readEmbeddingDoc2VecModel() throws Exception {
    String modelPath = "Your Directory";

    File file = new File(modelPath);

    if (!file.exists())
      logger.warn("It seems like, you haven't trained the model or correctly specified Doc2Vec model path." +
              "For training Doc2Vec model, specify the directory, parameters by going to endpoint: localhost:8002/v1/doc2vec" +
              "{\n" +
              "    \"folderDirectory\": \"C:\\\\Users\\\\AnyUserName\\\\Desktop\\\\train_files\",\n" +
              "    \"modelName\": \"doc_vectors\",\n" +
              "    \"destination\": \"R:\\\\EdgeChain\\\\edgechain-app\\\\model\",\n" +
              "    \"epochs\": 5,\n" +
              "    \"minWordFrequency\": 5,\n" +
              "    \"learningRate\": 0.025,\n" +
              "    \"layerSize\": 300,\n" +
              "    \"batchSize\": 512,\n" +
              "    \"windowSize\": 15\n" +
              "}");

    else {
      logger.info("Loading...");
      ServiceConstants.embeddingDoc2VecModel = WordVectorSerializer.readParagraphVectors(new FileInputStream(modelPath));
      logger.info("Doc2Vec model is successfully loaded...");
    }
  }


}

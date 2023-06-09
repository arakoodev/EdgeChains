package com.edgechain.service;

import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import com.edgechain.service.constants.ServiceConstants;
import java.io.File;
import java.io.FileInputStream;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

@SpringBootApplication(scanBasePackages = {"com.edgechain.service"})
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainServiceRunner {

  private static final Logger logger = LoggerFactory.getLogger(EdgeChainServiceRunner.class);

  public static void main(String[] args) throws Exception {

    System.setProperty("server.port", "8002");

    System.setProperty("spring.data.redis.host", "");
    System.setProperty("spring.data.redis.port", "6379");
    System.setProperty("spring.data.redis.username", "default");
    System.setProperty("spring.data.redis.password", "");
    System.setProperty("spring.data.redis.connect-timeout", "120000");
    System.setProperty("spring.redis.ttl", "3600");

    System.setProperty("doc2vec.filepath", "R:\\doc_vector.bin");

    readDoc2Vec();

    SpringApplication.run(EdgeChainServiceRunner.class, args);
  }

  public static void readDoc2Vec() throws Exception {

    String modelPath = System.getProperty("doc2vec.filepath");

    File file = new File(modelPath);

    if (!file.exists()) {
      logger.warn(
          "It seems like, you haven't trained the model or correctly specified Doc2Vec model"
              + " path.");
    } else {
      logger.info("Loading...");
      ServiceConstants.embeddingDoc2VecModel =
          WordVectorSerializer.readParagraphVectors(new FileInputStream(modelPath));
      logger.info("Doc2Vec model is successfully loaded...");
    }
  }
}

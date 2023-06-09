package com.edgechain.app;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import com.edgechain.service.constants.ServiceConstants;
import java.io.File;
import java.io.FileInputStream;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app", "com.edgechain.service"})
@ImportAutoConfiguration({FeignAutoConfiguration.class})
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainApplication {

  private static final Logger logger = LoggerFactory.getLogger(EdgeChainApplication.class);

  public static void main(String[] args) throws Exception {

    System.setProperty("server.port", "8003");

    System.setProperty("OPENAI_AUTH_KEY", "");

    System.setProperty("PINECONE_AUTH_KEY", "");
    System.setProperty("PINECONE_QUERY_API", "");
    System.setProperty("PINECONE_UPSERT_API", "");
    System.setProperty("PINECONE_DELETE_API", "");

    System.setProperty("spring.data.redis.host", "");
    System.setProperty("spring.data.redis.port", "6379");
    System.setProperty("spring.data.redis.username", "default");
    System.setProperty("spring.data.redis.password", "");
    System.setProperty("spring.data.redis.connect-timeout", "120000");
    System.setProperty("spring.redis.ttl", "3600");

    System.setProperty("doc2vec.filepath", "R:\\doc_vector.bin");
    readDoc2Vec();
    loadSentenceModel();
    SpringApplication.run(EdgeChainApplication.class, args);
  }

  private static void loadSentenceModel() {
    WebConstants.sentenceModel = EdgeChainApplication.class.getResourceAsStream("/en-sent.zip");
  }

  private static void readDoc2Vec() throws Exception {

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

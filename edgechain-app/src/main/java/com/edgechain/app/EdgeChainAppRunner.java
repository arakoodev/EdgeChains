package com.edgechain.app;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import java.io.IOException;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app"})
@ImportAutoConfiguration({FeignAutoConfiguration.class})
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainAppRunner {

  public static final Logger logger = LoggerFactory.getLogger(EdgeChainAppRunner.class);

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

    loadSentenceModel();

    SpringApplication.run(EdgeChainAppRunner.class, args);
  }

  public static void loadSentenceModel() throws IOException {
    WebConstants.sentenceModel = EdgeChainAppRunner.class.getResourceAsStream("/en-sent.zip");
    if (Objects.isNull(WebConstants.sentenceModel)) {
      logger.error("en-sent.zip file isn't loaded from the resources.'");
    }
  }
}

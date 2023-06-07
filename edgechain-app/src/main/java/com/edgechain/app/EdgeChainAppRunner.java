package com.edgechain.app;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app"})
@ImportAutoConfiguration({FeignAutoConfiguration.class})
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainAppRunner {

  @PostConstruct
  public void init() {
    this.loadSentenceModel();
  }

  public static void main(String[] args) {

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

    SpringApplication.run(EdgeChainAppRunner.class, args);
  }

  private void loadSentenceModel() {
    WebConstants.sentenceModel = this.getClass().getResourceAsStream("/en-sent.zip");
  }
}

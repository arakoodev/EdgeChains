package com.edgechain.app;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import com.edgechain.service.constants.ServiceConstants;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Import;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app", "com.edgechain.service"})
@EnableFeignClients
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainApplication {

    public static void main(String[] args) {
        SpringApplication.run(EdgeChainApplication.class, args);
    }

    static {
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
    }

    static {
        try {
            readDoc2Vec();
            loadSentenceModel();
        } catch (IOException e) {
            System.out.println("An error occurred while initializing the models: " + e.getMessage());
        }
    }

    private static void loadSentenceModel() {
        WebConstants.sentenceModel = EdgeChainApplication.class.getResourceAsStream("/en-sent.zip");
    }

    private static void readDoc2Vec() throws IOException {
        String modelPath = System.getProperty("doc2vec.filepath");

        try (InputStream modelInputStream = new FileInputStream(modelPath)) {
            ServiceConstants.embeddingDoc2VecModel = WordVectorSerializer.readParagraphVectors(modelInputStream);
            System.out.println("Doc2Vec model is successfully loaded...");
        } catch (IOException e) {
            System.out.println("An error occurred while reading the Doc2Vec model: " + e.getMessage());
        }
    }
}

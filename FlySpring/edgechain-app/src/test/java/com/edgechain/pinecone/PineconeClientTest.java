package com.edgechain.pinecone;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class PineconeClientTest {
    Logger logger = LoggerFactory.getLogger(getClass());

    @LocalServerPort private int port;

    @BeforeEach
    void setUp() {
        System.setProperty("server.port", String.valueOf(port));
    }

    @Test
    @DisplayName("Test Pineconee namespace")
    void pineconeControllerTest_TestPineconeNamespace_ReturnedExpecctedValue(){
        PineconeEndpoint pineconeEndpoint = new PineconeEndpoint();
        pineconeEndpoint.setNamespace("machine-learning");
        String namespace = pineconeEndpoint.getNamespace();
        logger.info(namespace);

        assertNotNull(namespace);
        assertEquals("machine-learning", namespace);
    }

    @Test
    void test_pineconeEndpoint(){

        PineconeEndpoint pineconeEndpoint = new PineconeEndpoint();
        List<WordEmbeddings> wordEmbeddingsList = Collections.singletonList(new WordEmbeddings("word", String.valueOf(0.9f)));
        pineconeEndpoint.setTopK(5);
        pineconeEndpoint.setWordEmbeddings(wordEmbeddingsList.get(0));
        logger.info("pineconeEndpoint {}", pineconeEndpoint);
        String endpointUrl = pineconeEndpoint.getUrl();
        assertNull(endpointUrl);
    }
}

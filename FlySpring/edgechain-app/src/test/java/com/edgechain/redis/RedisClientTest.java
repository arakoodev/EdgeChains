package com.edgechain.redis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment= SpringBootTest.WebEnvironment.RANDOM_PORT)
public class RedisClientTest {

    @LocalServerPort
    int randomServerPort;

    private Logger logger = LoggerFactory.getLogger(this.getClass());

    @BeforeEach
    public void setup() {
        System.setProperty("server.port", ""+randomServerPort);
    }

    @Test
    @DisplayName("Test Redis Endpoint Upsert With OpenAI")
    public void testRedisEndpoint_UpsertWithOpenAiShouldAssertNoErrors() {

    }

    @Test
    @DisplayName("Test Redis Endpoint Similarity Search With OpenAI")
    public void testRedisEndpoint_SimilaritySearchWithOpenAiShouldAssertNoErrors() {

    }

    @Test
    @DisplayName("Test Redis Endpoint Delete By Pattern")
    public void testRedisEndpoint_DeleteByPatternShouldAssertNoErrors() {

    }

}

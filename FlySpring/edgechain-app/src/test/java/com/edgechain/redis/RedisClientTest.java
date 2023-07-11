package com.edgechain.redis;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.index.client.impl.RedisClient;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class RedisClientTest {

    private Logger logger = LoggerFactory.getLogger(this.getClass());

    @Mock
    RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ObjectMapper objectMapper = new ObjectMapper();


    /**
     * Step 1: Generate Emebeddings for the input using OpenAI
     * Step 2: Get the Embeddings and Pass it to the RedisClient With namespace & indexname
     * Step 3: Perform query with topK values
     * (For Redis, RedisEnv bean needs to be configured ==> Examples/EdgeChainApplication.java)
     */
    @ParameterizedTest
    @CsvSource({"What is Lexicography?,3", "What is Social Engineering?,6"})
    @DisplayName("Redis Test Query")
    public void testRedisClient_QueryUsingOpenAIEmbedding_AssertNoErrors(String input, int topK) throws InterruptedException {

        String indexName = "vector_index";
        String namespace = "machine-learning";

        RedisEndpoint redisEndpoint = new RedisEndpoint(indexName, namespace);

        OpenAiEndpoint embeddingEndpoint =
                new OpenAiEndpoint(
                        OPENAI_EMBEDDINGS_API,
                        "", // apiKey
                        "text-embedding-ada-002",
                        new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

        TestObserver<OpenAiEmbeddingResponse> openAiEmbeddingTest =
                new OpenAiClient(embeddingEndpoint).createEmbeddings(new OpenAiEmbeddingRequest(embeddingEndpoint.getModel(), input))
                .getScheduledObservable().test();

        // Await for it
        openAiEmbeddingTest.await();

        // Assert
        openAiEmbeddingTest.assertNoErrors();

        List<Float> embeddings = openAiEmbeddingTest.values().get(0).getData().get(0).getEmbedding();

        // Now Pass Those Embeddings to RedisClient

        WordEmbeddings wordEmbeddings = new WordEmbeddings();
        wordEmbeddings.setValues(embeddings);

        TestObserver<List<WordEmbeddings>> redisTest = new RedisClient(redisEndpoint, indexName, namespace).query(wordEmbeddings, topK)
                .getScheduledObservable().test();

        // Await
        redisTest.await();

        logger.info(redisTest.values().toString());

        // Assert
        redisTest.assertNoErrors();

    }


}

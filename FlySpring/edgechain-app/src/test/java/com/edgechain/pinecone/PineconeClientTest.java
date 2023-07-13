package com.edgechain.pinecone;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.index.client.impl.PineconeClient;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

@SpringBootTest
public class PineconeClientTest {

  private Logger logger = LoggerFactory.getLogger(this.getClass());

  @Mock RestTemplate restTemplate;
  private MockRestServiceServer mockServer;
  private ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  public void setup() {
    mockServer = MockRestServiceServer.createServer(restTemplate);
  }

  /** Get Embeddings from OpenAI and then upsert it to Pinecone */
  @Test
  @DisplayName("Test PineconeUpsert")
  public void upsert() throws InterruptedException {

    // Step 1: Create OpenAiEndpoint
    OpenAiEndpoint openAiEndpoint =
        new OpenAiEndpoint(
            OPENAI_EMBEDDINGS_API,
            "", // apiKey
            "text-embedding-ada-002",
            new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));
    String input = "Hey, we are building LLM using Spring and Java";
    TestObserver<OpenAiEmbeddingResponse> testEmbeddings =
        new OpenAiClient(openAiEndpoint)
            .createEmbeddings(new OpenAiEmbeddingRequest(openAiEndpoint.getModel(), input))
            .getScheduledObservable()
            .test();

    // Await
    testEmbeddings.await();

    List<Float> embeddings = testEmbeddings.values().get(0).getData().get(0).getEmbedding();

    PineconeEndpoint pineconeEndpoint =
        new PineconeEndpoint(
            OPENAI_EMBEDDINGS_API, // upsert url
            "", // apiKey
            "", // namespace
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    WordEmbeddings wordEmbeddings = new WordEmbeddings();
    wordEmbeddings.setId(input);
    wordEmbeddings.setValues(embeddings);

    TestObserver<StringResponse> pineconeTest =
        new PineconeClient(pineconeEndpoint, "")
            .upsert(wordEmbeddings)
            .getScheduledObservable()
            .test();

    pineconeTest.await();

    logger.info(pineconeTest.values().get(0).getResponse());

    // Assert
    pineconeTest.assertNoErrors();
  }

  @Test
  public void query() {}

  @Test
  public void delete() {}
}

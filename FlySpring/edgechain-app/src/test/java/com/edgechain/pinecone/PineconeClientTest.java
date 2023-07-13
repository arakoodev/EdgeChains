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

}

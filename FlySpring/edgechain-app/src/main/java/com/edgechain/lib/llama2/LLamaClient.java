package com.edgechain.lib.llama2;

import com.edgechain.lib.endpoint.impl.llm.LLamaQuickstart;
import com.edgechain.lib.llama2.request.LLamaCompletionRequest;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
public class LLamaClient {
  @Autowired private ObjectMapper objectMapper;
  private final Logger logger = LoggerFactory.getLogger(getClass());
  private final RestTemplate restTemplate = new RestTemplate();

  public EdgeChain<List<String>> createChatCompletion(
      LLamaCompletionRequest request, LLamaQuickstart endpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                logger.info("Logging ChatCompletion....");

                logger.info("==============REQUEST DATA================");
                logger.info(request.toString());

                //  Create headers
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<LLamaCompletionRequest> entity = new HttpEntity<>(request, headers);
                //
                String response =
                    restTemplate.postForObject(endpoint.getUrl(), entity, String.class);

                List<String> chatCompletionResponse =
                    objectMapper.readValue(response, new TypeReference<>() {});
                emitter.onNext(chatCompletionResponse);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }
}

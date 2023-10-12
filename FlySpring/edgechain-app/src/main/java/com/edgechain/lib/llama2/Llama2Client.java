package com.edgechain.lib.llama2;

import com.edgechain.lib.endpoint.impl.llm.Llama2Endpoint;
import com.edgechain.lib.llama2.request.Llama2ChatCompletionRequest;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
public class Llama2Client {
  @Autowired private ObjectMapper objectMapper;
  private final Logger logger = LoggerFactory.getLogger(getClass());
  private final RestTemplate restTemplate = new RestTemplate();

  public EdgeChain<List<Llama2ChatCompletionResponse>> createChatCompletion(
      Llama2ChatCompletionRequest request, Llama2Endpoint endpoint) {
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
                HttpEntity<Llama2ChatCompletionRequest> entity = new HttpEntity<>(request, headers);
                //
                String response =
                    restTemplate.postForObject(endpoint.getUrl(), entity, String.class);

                List<Llama2ChatCompletionResponse> chatCompletionResponse =
                    objectMapper.readValue(
                        response, new TypeReference<>() {
                            });
                emitter.onNext(chatCompletionResponse);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }
}

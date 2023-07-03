package com.edgechain.lib.feign;

import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.request.feign.OpenAiChatRequest;
import com.edgechain.lib.utils.JsonUtils;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.adapter.rxjava.RxJava3Adapter;

@Service
public class OpenAiStreamService  {

    private final Logger logger = LoggerFactory.getLogger(getClass());

  @Value("${feign.host}")
  private String host;

  public Observable<ChatCompletionResponse> chatCompletion(OpenAiChatRequest request) {

    logger.info("Logging Chat Completion Stream....");
    logger.info("Prompt: "+request.getInput());

    return RxJava3Adapter.fluxToObservable(
            WebClient.builder()
                .build()
                .post()
                .uri("http://"+host + ":" + System.getProperty("server.port") + "/v2" + "/openai/chat-completion-stream")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .headers(
                    httpHeaders -> {
                      httpHeaders.setContentType(MediaType.APPLICATION_JSON);
                    })
                .bodyValue(JsonUtils.convertToString(request))
                .retrieve()
                .bodyToFlux(ChatCompletionResponse.class));
  }


}

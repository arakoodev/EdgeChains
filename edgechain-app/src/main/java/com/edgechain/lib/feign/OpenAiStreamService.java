package com.edgechain.lib.feign;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.utils.JsonUtils;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Flux;

@Service
public class OpenAiStreamService {

  @Value("${feign.url}")
  private String feignUrl;

  public Observable<ChainResponse> chatCompletion(OpenAiChatRequest request) {

    System.out.println("Logging Chat Completion Stream....");
    return RxJava3Adapter.fluxToObservable(
            WebClient.builder()
                .build()
                .post()
                .uri(feignUrl + "/openai/chat-completion-stream")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .headers(
                    httpHeaders -> {
                      httpHeaders.setContentType(MediaType.APPLICATION_JSON);
                    })
                .bodyValue(JsonUtils.convertToString(request))
                .retrieve()
                .bodyToFlux(ChainResponse.class))
        .map(
            v ->
                v.getResponse() == null
                    ? new ChainResponse(WebConstants.CHAT_STREAM_EVENT_COMPLETION_MESSAGE)
                    : v);
  }

//  public Flux<ChainResponse> chatCompletionStreamFlux(OpenAiChatRequest request) {
//
//    System.out.println("Logging....");
//    return WebClient.builder()
//        .build()
//        .post()
//        .uri(feignUrl + "/openai/chat-completion-stream")
//        .accept(MediaType.TEXT_EVENT_STREAM)
//        .headers(
//            httpHeaders -> {
//              httpHeaders.setContentType(MediaType.APPLICATION_JSON);
//            })
//        .bodyValue(JsonUtils.convertToString(request))
//        .retrieve()
//        .bodyToFlux(ChainResponse.class);
//  }
}

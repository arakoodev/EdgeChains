package com.edgechain.service.controllers.openai;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.embeddings.OpenAiEmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.logger.entities.ChatCompletionLog;
import com.edgechain.lib.logger.entities.EmbeddingLog;
import com.edgechain.lib.logger.entities.JsonnetLog;
import com.edgechain.lib.logger.services.ChatCompletionLogService;
import com.edgechain.lib.logger.services.EmbeddingLogService;
import com.edgechain.lib.logger.services.JsonnetLogService;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.response.CompletionResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.rxjava.utils.AtomInteger;
import com.knuddels.jtokkit.Encodings;
import com.knuddels.jtokkit.api.Encoding;
import com.knuddels.jtokkit.api.EncodingRegistry;
import com.knuddels.jtokkit.api.EncodingType;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController("Service OpenAiController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/openai")
public class OpenAiController {

  @Autowired private ChatCompletionLogService chatCompletionLogService;
  @Autowired private EmbeddingLogService embeddingLogService;
  @Autowired private JsonnetLogService jsonnetLogService;

  @Autowired private Environment env;
  @Autowired private OpenAiClient openAiClient;

  @PostMapping(value = "/chat-completion")
  public Single<ChatCompletionResponse> chatCompletion(
      @RequestBody OpenAiChatEndpoint openAiEndpoint) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(openAiEndpoint.getModel())
            .temperature(openAiEndpoint.getTemperature())
            .messages(openAiEndpoint.getChatMessages())
            .stream(false)
            .topP(openAiEndpoint.getTopP())
            .n(openAiEndpoint.getN())
            .stop(openAiEndpoint.getStop())
            .presencePenalty(openAiEndpoint.getPresencePenalty())
            .frequencyPenalty(openAiEndpoint.getFrequencyPenalty())
            .logitBias(openAiEndpoint.getLogitBias())
            .user(openAiEndpoint.getUser())
            .build();

    EdgeChain<ChatCompletionResponse> edgeChain =
        openAiClient.createChatCompletion(chatCompletionRequest, openAiEndpoint);

    if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

      ChatCompletionLog chatLog = new ChatCompletionLog();
      chatLog.setName(openAiEndpoint.getChainName());
      chatLog.setCreatedAt(LocalDateTime.now());
      chatLog.setCallIdentifier(openAiEndpoint.getCallIdentifier());
      chatLog.setInput(StringUtils.join(chatCompletionRequest.getMessages()));
      chatLog.setModel(chatCompletionRequest.getModel());

      chatLog.setPresencePenalty(chatCompletionRequest.getPresencePenalty());
      chatLog.setFrequencyPenalty(chatCompletionRequest.getFrequencyPenalty());
      chatLog.setTopP(chatCompletionRequest.getTopP());
      chatLog.setN(chatCompletionRequest.getN());
      chatLog.setTemperature(chatCompletionRequest.getTemperature());

      return edgeChain
          .doOnNext(
              c -> {
                chatLog.setPromptTokens(c.getUsage().getPrompt_tokens());
                chatLog.setTotalTokens(c.getUsage().getTotal_tokens());
                chatLog.setContent(c.getChoices().get(0).getMessage().getContent());
                chatLog.setType(c.getObject());

                chatLog.setCompletedAt(LocalDateTime.now());

                Duration duration =
                    Duration.between(chatLog.getCreatedAt(), chatLog.getCompletedAt());
                chatLog.setLatency(duration.toMillis());

                chatCompletionLogService.saveOrUpdate(chatLog);

                if (Objects.nonNull(openAiEndpoint.getJsonnetLoader())
                    && openAiEndpoint.getJsonnetLoader().getThreshold() >= 1) {
                  JsonnetLog jsonnetLog = new JsonnetLog();
                  jsonnetLog.setMetadata(openAiEndpoint.getJsonnetLoader().getMetadata());
                  jsonnetLog.setContent(c.getChoices().get(0).getMessage().getContent());
                  jsonnetLog.setF1(openAiEndpoint.getJsonnetLoader().getF1());
                  jsonnetLog.setF2(openAiEndpoint.getJsonnetLoader().getF2());
                  jsonnetLog.setSplitSize(openAiEndpoint.getJsonnetLoader().getSplitSize());
                  jsonnetLog.setCreatedAt(LocalDateTime.now());
                  jsonnetLog.setSelectedFile(openAiEndpoint.getJsonnetLoader().getSelectedFile());
                  jsonnetLogService.saveOrUpdate(jsonnetLog);
                }
              })
          .toSingle();

    } else return edgeChain.toSingle();
  }

  @PostMapping(
      value = "/chat-completion-stream",
      consumes = {MediaType.APPLICATION_JSON_VALUE})
  public SseEmitter chatCompletionStream(@RequestBody OpenAiChatEndpoint openAiEndpoint) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(openAiEndpoint.getModel())
            .temperature(openAiEndpoint.getTemperature())
            .messages(openAiEndpoint.getChatMessages())
            .stream(true)
            .topP(openAiEndpoint.getTopP())
            .n(openAiEndpoint.getN())
            .stop(openAiEndpoint.getStop())
            .presencePenalty(openAiEndpoint.getPresencePenalty())
            .frequencyPenalty(openAiEndpoint.getFrequencyPenalty())
            .logitBias(openAiEndpoint.getLogitBias())
            .user(openAiEndpoint.getUser())
            .build();
    SseEmitter emitter = new SseEmitter();
    ExecutorService executorService = Executors.newSingleThreadExecutor();

    executorService.execute(
        () -> {
          try {
            EdgeChain<ChatCompletionResponse> edgeChain =
                openAiClient.createChatCompletionStream(chatCompletionRequest, openAiEndpoint);

            AtomInteger chunks = AtomInteger.of(0);

            if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

              ChatCompletionLog chatLog = new ChatCompletionLog();
              chatLog.setName(openAiEndpoint.getChainName());
              chatLog.setCreatedAt(LocalDateTime.now());
              chatLog.setCallIdentifier(openAiEndpoint.getCallIdentifier());
              chatLog.setInput(StringUtils.join(chatCompletionRequest.getMessages()));
              chatLog.setModel(chatCompletionRequest.getModel());

              chatLog.setPresencePenalty(chatCompletionRequest.getPresencePenalty());
              chatLog.setFrequencyPenalty(chatCompletionRequest.getFrequencyPenalty());
              chatLog.setTopP(chatCompletionRequest.getTopP());
              chatLog.setN(chatCompletionRequest.getN());
              chatLog.setTemperature(chatCompletionRequest.getTemperature());

              StringBuilder stringBuilder = new StringBuilder();
              stringBuilder.append("<|im_start|>");

              for (ChatMessage chatMessage : openAiEndpoint.getChatMessages()) {
                stringBuilder.append(chatMessage.getContent());
              }
              EncodingRegistry registry = Encodings.newDefaultEncodingRegistry();
              Encoding enc = registry.getEncoding(EncodingType.CL100K_BASE);

              chatLog.setPromptTokens((long) enc.countTokens(stringBuilder.toString()));

              StringBuilder content = new StringBuilder();

              Observable<ChatCompletionResponse> obs = edgeChain.getScheduledObservable();

              obs.subscribe(
                  res -> {
                    try {

                      emitter.send(res);

                      chunks.incrementAndGet();
                      content.append(res.getChoices().get(0).getMessage().getContent());

                      if (Objects.nonNull(res.getChoices().get(0).getFinishReason())) {

                        emitter.complete();
                        chatLog.setType(res.getObject());
                        chatLog.setContent(content.toString());
                        chatLog.setCompletedAt(LocalDateTime.now());
                        chatLog.setTotalTokens(chunks.get() + chatLog.getPromptTokens());

                        Duration duration =
                            Duration.between(chatLog.getCreatedAt(), chatLog.getCompletedAt());
                        chatLog.setLatency(duration.toMillis());

                        chatCompletionLogService.saveOrUpdate(chatLog);

                        if (Objects.nonNull(openAiEndpoint.getJsonnetLoader())
                            && openAiEndpoint.getJsonnetLoader().getThreshold() >= 1) {
                          JsonnetLog jsonnetLog = new JsonnetLog();
                          jsonnetLog.setMetadata(openAiEndpoint.getJsonnetLoader().getMetadata());
                          jsonnetLog.setContent(content.toString());
                          jsonnetLog.setF1(openAiEndpoint.getJsonnetLoader().getF1());
                          jsonnetLog.setF2(openAiEndpoint.getJsonnetLoader().getF2());
                          jsonnetLog.setSplitSize(openAiEndpoint.getJsonnetLoader().getSplitSize());
                          jsonnetLog.setCreatedAt(LocalDateTime.now());
                          jsonnetLog.setSelectedFile(
                              openAiEndpoint.getJsonnetLoader().getSelectedFile());
                          jsonnetLogService.saveOrUpdate(jsonnetLog);
                        }
                      }

                    } catch (final Exception e) {
                      emitter.completeWithError(e);
                    }
                  });
            } else {

              Observable<ChatCompletionResponse> obs = edgeChain.getScheduledObservable();
              obs.subscribe(
                  res -> {
                    try {
                      emitter.send(res);
                      if (Objects.nonNull(res.getChoices().get(0).getFinishReason())) {
                        emitter.complete();
                      }

                    } catch (final Exception e) {
                      emitter.completeWithError(e);
                    }
                  });
            }

          } catch (final Exception e) {
            emitter.completeWithError(e);
          }
        });

    executorService.shutdown();
    return emitter;
  }

  @PostMapping("/completion")
  public Single<CompletionResponse> completion(@RequestBody OpenAiChatEndpoint openAiEndpoint) {

    CompletionRequest completionRequest =
        CompletionRequest.builder()
            .prompt(openAiEndpoint.getInput())
            .model(openAiEndpoint.getModel())
            .temperature(openAiEndpoint.getTemperature())
            .build();

    EdgeChain<CompletionResponse> edgeChain =
        openAiClient.createCompletion(completionRequest, openAiEndpoint);

    return edgeChain.toSingle();
  }

  @PostMapping("/embeddings")
  public Single<OpenAiEmbeddingResponse> embeddings(
      @RequestBody OpenAiEmbeddingEndpoint openAiEndpoint) throws SQLException {

    EdgeChain<OpenAiEmbeddingResponse> edgeChain =
        openAiClient.createEmbeddings(
            new OpenAiEmbeddingRequest(openAiEndpoint.getModel(), openAiEndpoint.getRawText()),
            openAiEndpoint);

    if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

      EmbeddingLog embeddingLog = new EmbeddingLog();
      embeddingLog.setCreatedAt(LocalDateTime.now());
      embeddingLog.setCallIdentifier(openAiEndpoint.getCallIdentifier());
      embeddingLog.setModel(openAiEndpoint.getModel());

      return edgeChain
          .doOnNext(
              e -> {
                embeddingLog.setPromptTokens(e.getUsage().getPrompt_tokens());
                embeddingLog.setCompletedAt(LocalDateTime.now());
                embeddingLog.setTotalTokens(e.getUsage().getTotal_tokens());

                Duration duration =
                    Duration.between(embeddingLog.getCreatedAt(), embeddingLog.getCompletedAt());
                embeddingLog.setLatency(duration.toMillis());

                embeddingLogService.saveOrUpdate(embeddingLog);
              })
          .toSingleWithoutScheduler();
    }

    return edgeChain.toSingleWithoutScheduler();
  }
}

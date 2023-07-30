package com.edgechain.service.controllers.openai;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.logger.entities.ChatCompletionLog;
import com.edgechain.lib.logger.entities.EmbeddingLog;
import com.edgechain.lib.logger.services.ChatCompletionLogService;
import com.edgechain.lib.logger.services.EmbeddingLogService;
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
import com.zaxxer.hikari.HikariDataSource;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController("Service OpenAiController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/openai")
public class OpenAiController {

    @Autowired private ChatCompletionLogService chatCompletionLogService;
    @Autowired private EmbeddingLogService embeddingLogService;

    @Autowired private Environment env;

    @PostMapping(value = "/chat-completion")
    public Single<ChatCompletionResponse> chatCompletion(@RequestBody OpenAiEndpoint openAiEndpoint)
            throws SQLException {

        ChatCompletionRequest chatCompletionRequest =
                ChatCompletionRequest.builder()
                        .model(openAiEndpoint.getModel())
                        .temperature(openAiEndpoint.getTemperature())
                        .messages(List.of(new ChatMessage(openAiEndpoint.getRole(), openAiEndpoint.getInput())))
                        .stream(false)
                        .build();

        EdgeChain<ChatCompletionResponse> edgeChain =
                new OpenAiClient(openAiEndpoint).createChatCompletion(chatCompletionRequest);

        if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

            ChatCompletionLog chatCompletionLog = new ChatCompletionLog();
            chatCompletionLog.setName(openAiEndpoint.getChainName());
            chatCompletionLog.setCallIdentifier(openAiEndpoint.getCallIdentifier());
            chatCompletionLog.setInput(openAiEndpoint.getInput());
            chatCompletionLog.setModel(openAiEndpoint.getModel());
            chatCompletionLog.setCreatedAt(LocalDateTime.now());

            return edgeChain
                    .doOnNext(
                            c -> {
                                chatCompletionLog.setPromptTokens(c.getUsage().getPrompt_tokens());
                                chatCompletionLog.setTotalTokens(c.getUsage().getTotal_tokens());
                                chatCompletionLog.setContent(c.getChoices().get(0).getMessage().getContent());
                                chatCompletionLog.setType(c.getObject());

                                chatCompletionLog.setCompletedAt(LocalDateTime.now());

                                Duration duration =
                                        Duration.between(
                                                chatCompletionLog.getCreatedAt(), chatCompletionLog.getCompletedAt());
                                chatCompletionLog.setLatency(duration.toMillis());

                                chatCompletionLogService.saveOrUpdate(chatCompletionLog);
                            })
                    .toSingle();

        } else return edgeChain.toSingle();
    }

    @PostMapping(
            value = "/chat-completion-stream",
            consumes = {MediaType.APPLICATION_JSON_VALUE})
    public SseEmitter chatCompletionStream(@RequestBody OpenAiEndpoint openAiEndpoint) {

        ChatCompletionRequest chatCompletionRequest =
                ChatCompletionRequest.builder()
                        .model(openAiEndpoint.getModel())
                        .temperature(openAiEndpoint.getTemperature())
                        .messages(List.of(new ChatMessage(openAiEndpoint.getRole(), openAiEndpoint.getInput())))
                        .stream(true)
                        .build();

        SseEmitter emitter = new SseEmitter();
        ExecutorService executorService = Executors.newSingleThreadExecutor();

        executorService.execute(
                () -> {
                    try {
                        EdgeChain<ChatCompletionResponse> edgeChain =
                                new OpenAiClient(openAiEndpoint).createChatCompletionStream(chatCompletionRequest);

                        AtomInteger chunks = AtomInteger.of(0);

                        if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

                            ChatCompletionLog chatCompletionLog = new ChatCompletionLog();
                            chatCompletionLog.setName(openAiEndpoint.getChainName());
                            chatCompletionLog.setCallIdentifier(openAiEndpoint.getCallIdentifier());
                            chatCompletionLog.setInput(openAiEndpoint.getInput());
                            chatCompletionLog.setModel(openAiEndpoint.getModel());
                            chatCompletionLog.setCreatedAt(LocalDateTime.now());

                            String prompt =
                                    "<|im_start|>"
                                            .concat(openAiEndpoint.getRole())
                                            .concat(openAiEndpoint.getInput());
                            EncodingRegistry registry = Encodings.newDefaultEncodingRegistry();
                            Encoding enc = registry.getEncoding(EncodingType.CL100K_BASE);

                            chatCompletionLog.setPromptTokens((long) enc.countTokens(prompt));

                            StringBuilder content = new StringBuilder();

                            Observable<ChatCompletionResponse> obs = edgeChain.getScheduledObservable();

                            obs
                                    .subscribe(
                                            res -> {
                                                try {

                                                    emitter.send(res);

                                                    chunks.incrementAndGet();
                                                    content.append(res.getChoices().get(0).getMessage().getContent());

                                                    if (Objects.nonNull(res.getChoices().get(0).getFinishReason())) {

                                                        emitter.complete();

                                                        chatCompletionLog.setType(res.getObject());
                                                        chatCompletionLog.setContent(content.toString());
                                                        chatCompletionLog.setCompletedAt(LocalDateTime.now());
                                                        chatCompletionLog.setTotalTokens(
                                                                chunks.get() + chatCompletionLog.getPromptTokens());

                                                        Duration duration =
                                                                Duration.between(
                                                                        chatCompletionLog.getCreatedAt(),
                                                                        chatCompletionLog.getCompletedAt());
                                                        chatCompletionLog.setLatency(duration.toMillis());

                                                        chatCompletionLogService.saveOrUpdate(chatCompletionLog);
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
    public Single<CompletionResponse> completion(@RequestBody OpenAiEndpoint openAiEndpoint) {

        CompletionRequest completionRequest =
                CompletionRequest.builder()
                        .prompt(openAiEndpoint.getInput())
                        .model(openAiEndpoint.getModel())
                        .temperature(openAiEndpoint.getTemperature())
                        .build();

        EdgeChain<CompletionResponse> edgeChain =
                new OpenAiClient(openAiEndpoint).createCompletion(completionRequest);

        return edgeChain.toSingle();
    }

    @PostMapping("/embeddings")
    public Single<OpenAiEmbeddingResponse> embeddings(@RequestBody OpenAiEndpoint openAiEndpoint)
            throws SQLException {

        EdgeChain<OpenAiEmbeddingResponse> edgeChain =
                new OpenAiClient(openAiEndpoint)
                        .createEmbeddings(
                                new OpenAiEmbeddingRequest(openAiEndpoint.getModel(), openAiEndpoint.getInput()));

        if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

            EmbeddingLog embeddingLog = new EmbeddingLog();
            embeddingLog.setCreatedAt(LocalDateTime.now());
            embeddingLog.setCallIdentifier(openAiEndpoint.getCallIdentifier());
            embeddingLog.setModel(openAiEndpoint.getModel());

            return edgeChain
                    .doOnNext(e -> {
                        embeddingLog.setPromptTokens(e.getUsage().getPrompt_tokens());
                        embeddingLog.setCompletedAt(LocalDateTime.now());
                        embeddingLog.setTotalTokens(e.getUsage().getTotal_tokens());

                        Duration duration =
                                Duration.between(embeddingLog.getCreatedAt(), embeddingLog.getCompletedAt());
                        embeddingLog.setLatency(duration.toMillis());

                        embeddingLogService.saveOrUpdate(embeddingLog);
                    })
                   .toSingle();
        }

        return edgeChain.toSingle();
    }
}

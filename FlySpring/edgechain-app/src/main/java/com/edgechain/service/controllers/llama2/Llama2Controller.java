package com.edgechain.service.controllers.llama2;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.request.OpenAiEmbeddingRequest;
import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.llama2.Llama2Endpoint;
import com.edgechain.lib.llama2.Llama2Client;
import com.edgechain.lib.llama2.request.Llama2ChatCompletionRequest;
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
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController("Service Llama2Controller")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/llama2")
public class Llama2Controller {
    @Autowired
    private ChatCompletionLogService chatCompletionLogService;

    @Autowired private JsonnetLogService jsonnetLogService;

    @Autowired private Environment env;
    @Autowired private Llama2Client llama2Client;

    @PostMapping(value = "/chat-completion")
    public Single<ChatCompletionResponse> chatCompletion(@RequestBody Llama2Endpoint llama2Endpoint) {


        JSONObject parameters = new JSONObject();
        parameters.put("temperature", llama2Endpoint.getTemperature());
        parameters.put("top_p", llama2Endpoint.getTopP());
        parameters.put("top_k", llama2Endpoint.getTopK());
        parameters.put("do_sample", llama2Endpoint.getDoSample());
        parameters.put("repetition_penalty", llama2Endpoint.getRepetitionPenalty());
        parameters.put("max_new_tokens", llama2Endpoint.getMaxNewTokens());
        parameters.put("stop", llama2Endpoint.getStop());

        Llama2ChatCompletionRequest llama2ChatCompletionRequest = 
                Llama2ChatCompletionRequest.builder().inputs(llama2Endpoint.getInputs()).parameters(parameters).build();

        EdgeChain<ChatCompletionResponse> edgeChain =
                llama2Client.createChatCompletion(llama2ChatCompletionRequest, llama2Endpoint);

//        if (Objects.nonNull(env.getProperty("postgres.db.host"))) {
//
//            ChatCompletionLog chatLog = new ChatCompletionLog();
//            chatLog.setName(llama2Endpoint.getChainName());
//            chatLog.setCreatedAt(LocalDateTime.now());
//            chatLog.setCallIdentifier(llama2Endpoint.getCallIdentifier());
//            chatLog.setInput(StringUtils.join(llama2ChatCompletionRequest.getInputs()));
//            chatLog.setTemperature(llama2ChatCompletionRequest.getParameters());
////            chatLog.setModel(llama2ChatCompletionRequest.getModel());
////
////            chatLog.setPresencePenalty(chatCompletionRequest.getPresencePenalty());
////            chatLog.setFrequencyPenalty(chatCompletionRequest.getFrequencyPenalty());
////            chatLog.setTopP(chatCompletionRequest.getTopP());
////            chatLog.setN(chatCompletionRequest.getN());
////            chatLog.setTemperature(chatCompletionRequest.getTemperature());
//
//            return edgeChain
//                    .doOnNext(
//                            c -> {
//                                chatLog.setPromptTokens(c.getUsage().getPrompt_tokens());
//                                chatLog.setTotalTokens(c.getUsage().getTotal_tokens());
//                                chatLog.setContent(c.getChoices().get(0).getMessage().getContent());
//                                chatLog.setType(c.getObject());
//
//                                chatLog.setCompletedAt(LocalDateTime.now());
//
//                                Duration duration =
//                                        Duration.between(chatLog.getCreatedAt(), chatLog.getCompletedAt());
//                                chatLog.setLatency(duration.toMillis());
//
//                                chatCompletionLogService.saveOrUpdate(chatLog);
//
//                                if (Objects.nonNull(llama2Endpoint.getJsonnetLoader())
//                                        && llama2Endpoint.getJsonnetLoader().getThreshold() >= 1) {
//                                    JsonnetLog jsonnetLog = new JsonnetLog();
//                                    jsonnetLog.setMetadata(llama2Endpoint.getJsonnetLoader().getMetadata());
//                                    jsonnetLog.setContent(c.getChoices().get(0).getMessage().getContent());
//                                    jsonnetLog.setF1(llama2Endpoint.getJsonnetLoader().getF1());
//                                    jsonnetLog.setF2(llama2Endpoint.getJsonnetLoader().getF2());
//                                    jsonnetLog.setSplitSize(llama2Endpoint.getJsonnetLoader().getSplitSize());
//                                    jsonnetLog.setCreatedAt(LocalDateTime.now());
//                                    jsonnetLog.setSelectedFile(llama2Endpoint.getJsonnetLoader().getSelectedFile());
//                                    jsonnetLogService.saveOrUpdate(jsonnetLog);
//                                }
//                            })
//                    .toSingle();

//        } else
            return edgeChain.toSingle();
    }

//    @PostMapping(
//            value = "/chat-completion-stream",
//            consumes = {MediaType.APPLICATION_JSON_VALUE})
//    public SseEmitter chatCompletionStream(@RequestBody OpenAiEndpoint openAiEndpoint) {
//
//        ChatCompletionRequest chatCompletionRequest =
//                ChatCompletionRequest.builder()
//                        .model(openAiEndpoint.getModel())
//                        .temperature(openAiEndpoint.getTemperature())
//                        .messages(openAiEndpoint.getChatMessages())
//                        .stream(true)
//                        .topP(openAiEndpoint.getTopP())
//                        .n(openAiEndpoint.getN())
//                        .stop(openAiEndpoint.getStop())
//                        .presencePenalty(openAiEndpoint.getPresencePenalty())
//                        .frequencyPenalty(openAiEndpoint.getFrequencyPenalty())
//                        .logitBias(openAiEndpoint.getLogitBias())
//                        .user(openAiEndpoint.getUser())
//                        .build();
//        SseEmitter emitter = new SseEmitter();
//        ExecutorService executorService = Executors.newSingleThreadExecutor();
//
//        executorService.execute(
//                () -> {
//                    try {
//                        EdgeChain<ChatCompletionResponse> edgeChain =
//                                openAiClient.createChatCompletionStream(chatCompletionRequest, openAiEndpoint);
//
//                        AtomInteger chunks = AtomInteger.of(0);
//
//                        if (Objects.nonNull(env.getProperty("postgres.db.host"))) {
//
//                            ChatCompletionLog chatLog = new ChatCompletionLog();
//                            chatLog.setName(openAiEndpoint.getChainName());
//                            chatLog.setCreatedAt(LocalDateTime.now());
//                            chatLog.setCallIdentifier(openAiEndpoint.getCallIdentifier());
//                            chatLog.setInput(StringUtils.join(chatCompletionRequest.getMessages()));
//                            chatLog.setModel(chatCompletionRequest.getModel());
//
//                            chatLog.setPresencePenalty(chatCompletionRequest.getPresencePenalty());
//                            chatLog.setFrequencyPenalty(chatCompletionRequest.getFrequencyPenalty());
//                            chatLog.setTopP(chatCompletionRequest.getTopP());
//                            chatLog.setN(chatCompletionRequest.getN());
//                            chatLog.setTemperature(chatCompletionRequest.getTemperature());
//
//                            StringBuilder stringBuilder = new StringBuilder();
//                            stringBuilder.append("<|im_start|>");
//
//                            for (ChatMessage chatMessage : openAiEndpoint.getChatMessages()) {
//                                stringBuilder.append(chatMessage.getContent());
//                            }
//                            EncodingRegistry registry = Encodings.newDefaultEncodingRegistry();
//                            Encoding enc = registry.getEncoding(EncodingType.CL100K_BASE);
//
//                            chatLog.setPromptTokens((long) enc.countTokens(stringBuilder.toString()));
//
//                            StringBuilder content = new StringBuilder();
//
//                            Observable<ChatCompletionResponse> obs = edgeChain.getScheduledObservable();
//
//                            obs.subscribe(
//                                    res -> {
//                                        try {
//
//                                            emitter.send(res);
//
//                                            chunks.incrementAndGet();
//                                            content.append(res.getChoices().get(0).getMessage().getContent());
//
//                                            if (Objects.nonNull(res.getChoices().get(0).getFinishReason())) {
//
//                                                emitter.complete();
//                                                chatLog.setType(res.getObject());
//                                                chatLog.setContent(content.toString());
//                                                chatLog.setCompletedAt(LocalDateTime.now());
//                                                chatLog.setTotalTokens(chunks.get() + chatLog.getPromptTokens());
//
//                                                Duration duration =
//                                                        Duration.between(chatLog.getCreatedAt(), chatLog.getCompletedAt());
//                                                chatLog.setLatency(duration.toMillis());
//
//                                                chatCompletionLogService.saveOrUpdate(chatLog);
//
//                                                if (Objects.nonNull(openAiEndpoint.getJsonnetLoader())
//                                                        && openAiEndpoint.getJsonnetLoader().getThreshold() >= 1) {
//                                                    JsonnetLog jsonnetLog = new JsonnetLog();
//                                                    jsonnetLog.setMetadata(openAiEndpoint.getJsonnetLoader().getMetadata());
//                                                    jsonnetLog.setContent(content.toString());
//                                                    jsonnetLog.setF1(openAiEndpoint.getJsonnetLoader().getF1());
//                                                    jsonnetLog.setF2(openAiEndpoint.getJsonnetLoader().getF2());
//                                                    jsonnetLog.setSplitSize(openAiEndpoint.getJsonnetLoader().getSplitSize());
//                                                    jsonnetLog.setCreatedAt(LocalDateTime.now());
//                                                    jsonnetLog.setSelectedFile(
//                                                            openAiEndpoint.getJsonnetLoader().getSelectedFile());
//                                                    jsonnetLogService.saveOrUpdate(jsonnetLog);
//                                                }
//                                            }
//
//                                        } catch (final Exception e) {
//                                            emitter.completeWithError(e);
//                                        }
//                                    });
//                        } else {
//
//                            Observable<ChatCompletionResponse> obs = edgeChain.getScheduledObservable();
//                            obs.subscribe(
//                                    res -> {
//                                        try {
//                                            emitter.send(res);
//                                            if (Objects.nonNull(res.getChoices().get(0).getFinishReason())) {
//                                                emitter.complete();
//                                            }
//
//                                        } catch (final Exception e) {
//                                            emitter.completeWithError(e);
//                                        }
//                                    });
//                        }
//
//                    } catch (final Exception e) {
//                        emitter.completeWithError(e);
//                    }
//                });
//
//        executorService.shutdown();
//        return emitter;
//    }

//    @PostMapping("/completion")
//    public Single<CompletionResponse> completion(@RequestBody Llama2Endpoint llama2Endpoint) {
//
//        CompletionRequest completionRequest =
//                CompletionRequest.builder()
//                        .prompt(llama2Endpoint.getRawText())
//                        .model(openAiEndpoint.getModel())
//                        .temperature(openAiEndpoint.getTemperature())
//                        .build();
//
//        EdgeChain<CompletionResponse> edgeChain =
//                llama2Client.createCompletion(completionRequest, llama2Endpoint);
//
//        return edgeChain.toSingle();
//    }


}

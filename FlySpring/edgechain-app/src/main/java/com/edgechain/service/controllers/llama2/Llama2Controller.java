package com.edgechain.service.controllers.llama2;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.llm.Llama2Endpoint;
import com.edgechain.lib.llama2.Llama2Client;
import com.edgechain.lib.llama2.request.Llama2ChatCompletionRequest;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import com.edgechain.lib.logger.services.ChatCompletionLogService;
import com.edgechain.lib.logger.services.JsonnetLogService;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;

@RestController("Service Llama2Controller")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/llama2")
public class Llama2Controller {
    @Autowired
    private ChatCompletionLogService chatCompletionLogService;

    @Autowired private JsonnetLogService jsonnetLogService;

    @Autowired private Environment env;
    @Autowired private Llama2Client llama2Client;

    @PostMapping(value = "/chat-completion")
    public Single<Llama2ChatCompletionResponse> chatCompletion(@RequestBody Llama2Endpoint llama2Endpoint) {


        JSONObject parameters = new JSONObject();
        parameters.put("temperature", llama2Endpoint.getTemperature());
        parameters.put("top_p", llama2Endpoint.getTopP());
        parameters.put("top_k", llama2Endpoint.getTopK());
        parameters.put("do_sample", llama2Endpoint.getDoSample());
        parameters.put("repetition_penalty", llama2Endpoint.getRepetitionPenalty());
        parameters.put("max_new_tokens", llama2Endpoint.getMaxNewTokens());
        parameters.put("stop", llama2Endpoint.getStop() != null ? llama2Endpoint.getStop() : Collections.emptyList());

        Llama2ChatCompletionRequest llama2ChatCompletionRequest = 
                Llama2ChatCompletionRequest.builder().inputs(llama2Endpoint.getInputs()).parameters(parameters).build();

        EdgeChain<Llama2ChatCompletionResponse> edgeChain =
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
}

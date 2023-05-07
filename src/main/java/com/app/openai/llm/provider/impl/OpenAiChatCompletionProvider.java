package com.app.openai.llm.provider.impl;

import com.app.openai.client.OpenAiClient;
import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.LLMProvider;
import com.app.openai.request.ChatCompletionRequest;
import com.app.openai.request.ChatMessage;
import com.app.rxjava.transformer.observable.EdgeChain;

import java.util.List;

public class OpenAiChatCompletionProvider implements LLMProvider {

    private final Endpoint endpoint;
    private final String role;
    private final String model;


    public OpenAiChatCompletionProvider(Endpoint endpoint, String model, String role) {
        this.endpoint = endpoint;
        this.role = role;
        this.model = model;
    }

    @Override
    public EdgeChain<String> request(String prompt) {

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model(model)
                .messages(List.of(new ChatMessage(role,prompt)))
                .build();

        return new OpenAiClient().createChatCompletion(endpoint,request);
    }
}

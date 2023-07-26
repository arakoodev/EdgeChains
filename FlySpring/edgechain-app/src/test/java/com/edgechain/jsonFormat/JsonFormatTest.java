package com.edgechain.jsonFormat;


import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.SpringBootTest;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.jsonFormat.controller.JsonFormat;
import com.edgechain.lib.jsonFormat.dto.UserPromptRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionChoice;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class JsonFormatTest {

    @Mock
    private OpenAiEndpoint openAiEndpointMock;

    @InjectMocks
    private JsonFormat jsonFormat;

    @BeforeEach
    public void setup() {
        MockitoAnnotations.initMocks(this);
    }

    // @Test
    // void testExtract_ValidInput_ReturnsValidJSON() {
    //     // Given
    //     String prompt = "Let's play poker. Your name is Tommy and you are a player in a game of No-Limit Texas Hold'em Poker. You have the cards Ac, Ah. The board is []. You have $100 in your stack. The pot is $20. You need to put $3 into the pot to play. The current bet is $3, and you are in seat 9 out of 9. Your position is in the Cutoff. You can call for $5, raise between $6 and $100, or fold for $0 What is the action you would like to take out of the following: ('call', 'raise', 'fold')?";
    //     String format = "{ action: { reason: string, type: string }, amount: number }";
    //     UserPromptRequest userPromptRequest = new UserPromptRequest(prompt, format);

    //     // Mock the behavior of OpenAiEndpoint
    //     ChatCompletionChoice chatCompletionChoice = new ChatCompletionChoice();
    //     chatCompletionChoice.setIndex(0);
    //     chatCompletionChoice.setMessage(new ChatMessage("user", "content"));
    //     chatCompletionChoice.setFinishReason("stop");

    //     ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
    //     chatCompletionResponse.setChoices(Collections.singletonList(chatCompletionChoice));
    //     chatCompletionResponse.setModel("gpt-3.5-turbo");

    //     when(openAiEndpointMock.getChatCompletion(anyString()))
    //             .thenReturn(Observable.just(chatCompletionResponse));

    // }

    @Test
    void testExtract_ValidInput_ReturnsValidJSON() {
        // Given
    String prompt = "Let's play poker. Your name is Tommy and you are a player in a game of No-Limit Texas Hold'em Poker. You have the cards Ac, Ah. The board is []. You have $100 in your stack. The pot is $20. You need to put $3 into the pot to play. The current bet is $3, and you are in seat 9 out of 9. Your position is in the Cutoff. You can call for $5, raise between $6 and $100, or fold for $0 What is the action you would like to take out of the following: ('call', 'raise', 'fold')?";
    String format = "{ action: { reason: string, type: string }, amount: number }";
    UserPromptRequest userPromptRequest = new UserPromptRequest(prompt, format);

    // Mock the behavior of OpenAiEndpoint
    String gptResponse = "{ \"action\": { \"reason\": \"some_reason\", \"type\": \"some_type\" }, \"amount\": 50 }";
    ChatCompletionChoice chatCompletionChoice = new ChatCompletionChoice();
    chatCompletionChoice.setIndex(0);
    chatCompletionChoice.setMessage(new ChatMessage("user", gptResponse));
    chatCompletionChoice.setFinishReason("stop");

    ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
    chatCompletionResponse.setChoices(Collections.singletonList(chatCompletionChoice));
    chatCompletionResponse.setModel("gpt-3.5-turbo");

    OpenAiEndpoint openAiEndpointMock = mock(OpenAiEndpoint.class);
    when(openAiEndpointMock.getChatCompletion(anyString()))
            .thenReturn(Observable.just(chatCompletionResponse));

    JsonFormat jsonFormat = new JsonFormat();

    // When
    Single<String> result = jsonFormat.extract(userPromptRequest);

    // Then
    String extractedJson = result.blockingGet();
    assertNotNull(extractedJson, "Extracted JSON should not be null.");

    // Verify if the response is a valid JSON string
    ObjectMapper objectMapper = new ObjectMapper();
    try {
        JsonNode jsonNode = objectMapper.readTree(extractedJson);
        assertTrue(jsonNode.isObject(), "The response should be a valid JSON object.");
        assertEquals("some_reason", jsonNode.get("action").get("reason").asText(),
                "Incorrect reason in the extracted JSON.");
        assertEquals("some_type", jsonNode.get("action").get("type").asText(), "Incorrect type in the extracted JSON.");
        assertEquals(50, jsonNode.get("amount").asInt(), "Incorrect amount in the extracted JSON.");
    } catch (Exception e) {
        fail("Failed to parse the response JSON: " + e.getMessage());
    }
}
}
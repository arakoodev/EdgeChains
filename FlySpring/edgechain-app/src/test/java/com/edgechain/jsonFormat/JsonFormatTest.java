package com.edgechain.jsonFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import java.util.Collections;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.springframework.boot.test.context.SpringBootTest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionChoice;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
public class JsonFormatTest {

        @Test
        @DisplayName("Test if the extracted JSON is valid")
        public void testExtract_ValidInput_ReturnsValidJSON(TestInfo testInfo) {
            System.out.println("======== " + testInfo.getDisplayName() + " ========");
    
            // Valid JSON response
            String validGptResponse = "{\"action\": {\"reason\": \"some_reason\", \"type\": \"some_type\"}, \"amount\": 50}";
            testExtract(validGptResponse, true);
        }
    
        @Test
        @DisplayName("Test if the extracted JSON is invalid")
        public void testExtract_InvalidInput_ReturnsNull(TestInfo testInfo) {
            System.out.println("======== " + testInfo.getDisplayName() + " ========");
    
            // Invalid JSON response
            String invalidGptResponse = "{\"action\": {\"reason\": \"some_reason\", \"type\": \"some_type\", \"amount\": 50";
            testExtract(invalidGptResponse, false);
        }
    
        private void testExtract(String response, boolean expectValidJson) {
            ChatCompletionChoice chatCompletionChoice = new ChatCompletionChoice();
            chatCompletionChoice.setIndex(0);
            chatCompletionChoice.setMessage(new ChatMessage("user", response));
            chatCompletionChoice.setFinishReason("stop");
    
            ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
            chatCompletionResponse.setChoices(Collections.singletonList(chatCompletionChoice));
            chatCompletionResponse.setModel("gpt-3.5-turbo");
    
            String result = chatCompletionResponse.getChoices().get(0).getMessage().getContent();
    
            assertNotNull(result, "Extracted JSON should not be null.");
    
            // Verify if the response is a valid JSON string
            ObjectMapper objectMapper = new ObjectMapper();
            try {
                JsonNode jsonNode = objectMapper.readTree(result);
                if (expectValidJson) {
                    assertTrue(jsonNode.isObject(), "The response should be a valid JSON object.");
                    assertEquals("some_reason", jsonNode.get("action").get("reason").asText(), "Incorrect reason in the extracted JSON.");
                    assertEquals("some_type", jsonNode.get("action").get("type").asText(), "Incorrect type in the extracted JSON.");
                    assertEquals(50, jsonNode.get("amount").asInt(), "Incorrect amount in the extracted JSON.");
                } else {
                    fail("Expected an exception for invalid JSON, but parsing succeeded with result: " + jsonNode);
                }
            } catch (Exception e) {
                if (expectValidJson) {
                    fail("Failed to parse the response JSON: " + e.getMessage());
                } else {
                    // Successfully caught an exception for invalid JSON
                    System.out.println("Successfully caught the expected exception for invalid JSON: " + e.getMessage());
                }
            }
        }   

}
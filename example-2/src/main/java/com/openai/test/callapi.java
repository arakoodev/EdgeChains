package com.openai.test;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.Collections;

//calls openai api
public class callapi {

    public String createJsonWithContent(String inputContent) {
        ObjectMapper objectMapper = new ObjectMapper();
        ObjectNode rootNode = objectMapper.createObjectNode();

        rootNode.put("model", "gpt-3.5-turbo");

        // Create an object node for the message
        ObjectNode messageNode = objectMapper.createObjectNode();
        messageNode.put("role", "user");

        // Combine existing content and input content
        String existingContent = "Use the following pieces of context to answer the question at the end. If\n" +
                "you don't know the answer, just say that you don't know, don't try to make\n" +
                "up an answer."; // Replace with your existing content
        String combinedContent = existingContent + "\n" + inputContent;
        messageNode.put("content", combinedContent);

        // Set the messages array
        rootNode.set("messages", objectMapper.createArrayNode().add(messageNode));

        try {
            return objectMapper.writeValueAsString(rootNode);
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return null;
        }
    }

    public String makePostRequest(String inputContent, String qaString) {
        // Create headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.setBearerAuth("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");

        // Create body
        String existingContent = "Use the following pieces of context to answer the question at the end. If\n" +
                "you don't know the answer, just say that you don't know, don't try to make\n" +
                "up an answer."; // Replace with your existing content
        String combinedContent = existingContent + "\n" + inputContent + "\n" + qaString;
        String jsonBody = createJsonWithContent(combinedContent);

        // Create HttpEntity with headers and body
        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);

        // Create a RestTemplate
        RestTemplate restTemplate = new RestTemplate();

        // Send the POST request
        ResponseEntity<String> response = restTemplate.exchange("https://api.openai.com/v1/chat/completions",
                HttpMethod.POST, entity, String.class);

        // Return the output as it is
        return response.getBody();
    }
}
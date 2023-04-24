package com.openai.test;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

public class OpenAIEmbeddingCall {

    private final String baseUrl = "https://api.openai.com";

    public String generateEmbedding(String text) throws Exception {
        String url = baseUrl + "/v1/embeddings"; // Replace with the correct API endpoint for generating embeddings

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.add("Authorization", "Bearer " + "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");

        ObjectMapper objectMapper = new ObjectMapper();
        String requestBody = objectMapper.writeValueAsString(new EmbeddingRequest(text));

        HttpEntity<String> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

        String result = response.getBody();

        // Extract the embedding from the result
        // You may need to parse the result JSON and extract the required information
        return result;
    }

    private static class EmbeddingRequest {
        private String input;
        private String model;

        public EmbeddingRequest(String input) {
            this.input = input;
            this.model = "text-embedding-ada-002";
        }

        public String getInput() {
            return input;
        }

        public void setInput(String input) {
            this.input = input;
        }

        public String getModel() {
            return model;
        }

        public void setModel(String model) {
            this.model = model;
        }
    }
}
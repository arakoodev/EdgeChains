package com.openai.test;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

public class OpenAIEmbeddingCall {

    private final String baseUrl = "https://api.openai.com";
    private final String apiKey;

    public OpenAIEmbeddingCall(String apiKey) {
        this.apiKey = apiKey;
    }

    public String generateEmbedding(String text) {
        String url = baseUrl + "/v1/embeddings"; // Replace with the correct API endpoint for generating embeddings

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.add("Authorization", "Bearer " + apiKey);
        HttpEntity<String> entity = new HttpEntity<>(text, headers);

        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

        String result = response.getBody();
        // Extract the embedding from the result
        // You may need to parse the result JSON and extract the required information
        return result;
    }
}
package com.openai.test;

import java.io.File;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.databind.ObjectMapper;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class PineconeRestAPI {
    private String apiKey;
    private String indexName;
    private ObjectMapper objectMapper;

    public PineconeRestAPI(String apiKey, String indexName) {
        this.apiKey = apiKey;
        this.indexName = indexName;
        this.objectMapper = new ObjectMapper();
    }

    private Response sendPostRequest(String endpointUrl, String jsonPayload) throws IOException {
        OkHttpClient httpClient = new OkHttpClient.Builder()
                .connectTimeout(300, TimeUnit.SECONDS)
                .readTimeout(300, TimeUnit.SECONDS)
                .writeTimeout(300, TimeUnit.SECONDS)
                .build();

        RequestBody body = RequestBody.create(MediaType.parse("application/json"), jsonPayload);

        Request request = new Request.Builder()
                .url(endpointUrl)
                .header("accept", "application/json")
                .header("content-type", "application/json")
                .header("Api-Key", apiKey)
                .post(body)
                .build();

        return httpClient.newCall(request).execute();
    }

    public String upsertEmbeddings(List<Map<String, Object>> embeddings) throws IOException {
        String pineconeUrl = "https://langchain-60c1091.svc.northamerica-northeast1-gcp.pinecone.io";

        // Prepare the request payload
        Map<String, List<Map<String, Object>>> payload = new LinkedHashMap<>();
        payload.put("vectors", embeddings);

        // Convert the payload to a JSON string
        String jsonPayload = objectMapper.writeValueAsString(payload);

        // Send the request to Pinecone REST API
        String upsertEndpointUrl = pineconeUrl + "/vectors/upsert";
        Response response = sendPostRequest(upsertEndpointUrl, jsonPayload);

        return response.body().string();
    }

    public String searchEmbedding(List<Double> queryEmbedding, int topK) throws IOException {
        String pineconeUrl = "https://langchain-60c1091.svc.northamerica-northeast1-gcp.pinecone.io";

        // Prepare the request payload using a LinkedHashMap to maintain key order
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("includeValues", true);
        payload.put("includeMetadata", false);
        payload.put("vector", queryEmbedding);
        payload.put("top_k", topK);

        // Convert the payload to a JSON string
        String jsonPayload = objectMapper.writeValueAsString(payload);

        // Send the request to Pinecone REST API
        String searchEndpointUrl = pineconeUrl + "/query";
        Response response = sendPostRequest(searchEndpointUrl, jsonPayload);

        return response.body().string();
    }
}
package com.openai.test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.Collections;

public class WikiApiClient {

    private static final String WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

    public String getPageContent(String pageTitle) {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        MultiValueMap<String, String> formParams = new LinkedMultiValueMap<>();
        formParams.add("action", "query");
        formParams.add("prop", "extracts");
        formParams.add("format", "json");
        formParams.add("titles", pageTitle);
        formParams.add("explaintext", ""); // Add this line to request plain text content

        HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(formParams, headers);

        ResponseEntity<String> response = restTemplate.exchange(WIKIPEDIA_API_URL, HttpMethod.POST, requestEntity, String.class);

        String jsonResponse = response.getBody();

        // Parse the JSON response and extract the plain text content
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode rootNode = objectMapper.readTree(jsonResponse);
            JsonNode pagesNode = rootNode.path("query").path("pages");

            // Iterate through the pages and extract the first page's content
            for (JsonNode pageNode : pagesNode) {
                if (pageNode.has("extract")) {
                    return pageNode.get("extract").asText();
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }

        return null;
    }
}
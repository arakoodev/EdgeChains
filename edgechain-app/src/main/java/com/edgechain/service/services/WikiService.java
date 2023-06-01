package com.edgechain.service.services;

import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.Objects;

public class WikiService {

    private static final String WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

    public EdgeChain<ChainResponse> getPageContent(String pageTitle) {
        return new EdgeChain<>(

                Observable.create(emitter -> {
                    try {

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

                        ResponseEntity<String> response = new RestTemplate().exchange(WIKIPEDIA_API_URL, HttpMethod.POST, requestEntity, String.class);

                        String jsonResponse = response.getBody();

                        JsonNode rootNode = new ObjectMapper().readTree(jsonResponse);
                        JsonNode pagesNode = rootNode.path("query").path("pages");

                        // Iterate through the pages and extract the first page's content
                        String output = null;
                        for (JsonNode pageNode : pagesNode) {
                            if (pageNode.has("extract")) {
                                output = pageNode.get("extract").asText();

                            }
                        }

                        if(Objects.isNull(output)) throw new RuntimeException("No wiki content found..");

                        emitter.onNext(new ChainResponse(output));
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );
    }
}
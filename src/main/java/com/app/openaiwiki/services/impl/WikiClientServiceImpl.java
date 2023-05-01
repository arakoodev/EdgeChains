package com.app.openaiwiki.services.impl;

import com.app.openaiwiki.chains.WikiChain;
import com.app.openaiwiki.services.WikiClientService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.disposables.Disposable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

@Service
public class WikiClientServiceImpl implements WikiClientService {

    @Autowired private RestTemplate restTemplate;
    @Autowired private ObjectMapper objectMapper;

    private static final String WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";


    @Override
    public WikiChain getPageContent(String pageTitle) {

        return new WikiChain(

                Observable.create(emitter -> {
                    try {

                        HttpHeaders headers = new HttpHeaders();
                        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

                        System.out.println("Page Title: "+pageTitle);

                        MultiValueMap<String, String> formParams = new LinkedMultiValueMap<>();
                        formParams.add("action", "query");
                        formParams.add("prop", "extracts");
                        formParams.add("format", "json");
                        formParams.add("titles", pageTitle);
                        formParams.add("explaintext", ""); // Add this line to request plain text content

                        HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(formParams, headers);

                        ResponseEntity<String> response = restTemplate.exchange(WIKIPEDIA_API_URL, HttpMethod.POST, requestEntity, String.class);

                        String jsonResponse = response.getBody();

                        JsonNode rootNode = objectMapper.readTree(jsonResponse);
                        JsonNode pagesNode = rootNode.path("query").path("pages");

                        // Iterate through the pages and extract the first page's content
                        String output = null;
                        for (JsonNode pageNode : pagesNode) {
                            if (pageNode.has("extract")) {
                                output = pageNode.get("extract").asText();

                            }
                        }

                        emitter.onNext(Objects.requireNonNullElse(output, ""));// Observables never return null values; therefore we have used this trick
                        emitter.onComplete();

                    }catch (final Exception e){
                        emitter.onError(e);
                    }
                })
        );
    }
}

package com.edgechain.lib.wiki.client;

import com.edgechain.lib.endpoint.impl.wiki.WikiEndpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.wiki.response.WikiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import java.util.Collections;
import java.util.Objects;

import me.xuender.unidecode.Unidecode;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

public class WikiClient {

  private static final String WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

  private WikiEndpoint wikiEndpoint;

  public WikiClient() {}

  public WikiClient(WikiEndpoint wikiEndpoint) {
    this.wikiEndpoint = wikiEndpoint;
  }

  public EdgeChain<WikiResponse> getPageContent(String input) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

                MultiValueMap<String, String> formParams = new LinkedMultiValueMap<>();
                formParams.add("action", "query");
                formParams.add("prop", "extracts");
                formParams.add("format", "json");
                formParams.add("titles", input);
                formParams.add("explaintext", ""); // Add this line to request plain text content

                HttpEntity<MultiValueMap<String, String>> requestEntity =
                    new HttpEntity<>(formParams, headers);

                ResponseEntity<String> response =
                    new RestTemplate()
                        .exchange(WIKIPEDIA_API_URL, HttpMethod.POST, requestEntity, String.class);

                String jsonResponse = response.getBody();

                JsonNode rootNode = new ObjectMapper().readTree(jsonResponse);

                JsonNode pagesNode = rootNode.path("query").path("pages");

                // Iterate through the pages and extract the first page's content
                String output = null;
                String regex = "[^\\p{L}\\p{N}\\p{P}\\p{Z}]";
                for (JsonNode pageNode : pagesNode) {
                  if (pageNode.has("extract")) {
                    output =
                        Unidecode.decode(pageNode.get("extract").asText())
                            .replaceAll("[\t\n\r]+", " ");
                    output = output.replaceAll(regex, "");
                  }
                }

                if (Objects.isNull(output))
                  throw new RuntimeException("Unable to find content from Wiki.");

                emitter.onNext(new WikiResponse(output));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        wikiEndpoint);
  }
}

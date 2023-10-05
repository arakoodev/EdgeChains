package com.edgechain.lib.llama2;


import com.edgechain.lib.endpoint.impl.llm.Llama2Endpoint;
import com.edgechain.lib.llama2.request.Llama2ChatCompletionRequest;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Objects;

@Service
public class Llama2Client {
    private final Logger logger = LoggerFactory.getLogger(getClass());
    private final RestTemplate restTemplate = new RestTemplate();

    public EdgeChain<Llama2ChatCompletionResponse> createChatCompletion(
            Llama2ChatCompletionRequest request, Llama2Endpoint endpoint) {

        return new EdgeChain<>(
                Observable.create(
                        emitter -> {
                            try {

                                logger.info("Logging ChatCompletion....");

                                request.setInputs(setSys(request.getInputs()));

                                logger.info("sys prompt printing in llama client {} ", request.getInputs());
                                logger.info("parameters printing in llama client {} ", request.getParameters());

                                // Create headers
                                HttpHeaders headers = new HttpHeaders();
                                headers.setContentType(MediaType.APPLICATION_JSON);
//                                headers.setBearerAuth(endpoint.getApiKey());

//                                if (Objects.nonNull(endpoint.getOrgId()) && !endpoint.getOrgId().isEmpty()) {
//                                    headers.set("OpenAI-Organization", endpoint.getOrgId());
//                                }
                                HttpEntity<Llama2ChatCompletionRequest> entity = new HttpEntity<>(request);

                                logger.info(String.valueOf(entity.getBody()));

                                // Send the POST request
                                ResponseEntity<Llama2ChatCompletionResponse> response =
                                        restTemplate.exchange(
                                                endpoint.getUrl(), HttpMethod.POST, entity, Llama2ChatCompletionResponse.class);

                                emitter.onNext(Objects.requireNonNull(response.getBody()));
                                emitter.onComplete();

                            } catch (final Exception e) {
                                emitter.onError(e);
                            }
                        }),
                endpoint);
    }

    private String setSys(String inputs) {
        StringBuilder stringBuilder = new StringBuilder(inputs.length());

        stringBuilder.append("<<SYS>>");
        stringBuilder.append(inputs);
        stringBuilder.append("<</SYS>>");

        return stringBuilder.toString();
    }


}

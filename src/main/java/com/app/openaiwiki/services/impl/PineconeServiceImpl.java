package com.app.openaiwiki.services.impl;

import com.app.openaiwiki.chains.PineconeChain;
import com.app.openaiwiki.exceptions.UserException;
import com.app.openaiwiki.flow.PineconeFlow;
import com.app.openaiwiki.services.PineconeService;
import com.app.rxjava.endpoint.Endpoint;
import com.app.rxjava.endpoint.EndpointFlow;
import com.app.rxjava.retry.flowable.impl.FixedDelayFlow;
import com.app.rxjava.retry.observable.impl.FixedDelay;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

@Service
public class PineconeServiceImpl implements PineconeService {

    @Autowired private ObjectMapper objectMapper;

    private final String pineconeUrl = "";;
//    private final String indexName = "index";
    private final String apiKey = "";

    /**
     * Why Used Completable?? Because we aren't returning anything; although you could use Observable as well.
     */
    @Override
    public PineconeFlow upsertEmbeddings(List<Map<String, Object>> embeddings) {

        EndpointFlow endpoint = new EndpointFlow(this.pineconeUrl + "/vectors/upsert",
                new FixedDelayFlow(4,3, TimeUnit.SECONDS));

        return new PineconeFlow(

               Completable.create(emitter -> {
                    try{

                        // Prepare the request payload
                        Map<String, List<Map<String, Object>>> payload = new LinkedHashMap<>();
                        payload.put("vectors", embeddings);

                        // Convert the payload to a JSON string
                        String jsonPayload = objectMapper.writeValueAsString(payload);

                        // Send the request to Pinecone REST API
                        Response response = sendPostRequest(endpoint.getUrl(), jsonPayload);
                        System.out.println("Response: "+response.body().string()); // Only for Logging Purpose....

                        emitter.onComplete();
                    }catch (final Exception e){
                        emitter.onError(e);
                    }
                }), endpoint
        );
    }

    @Override
    public PineconeChain searchEmbeddings(List<Double> queryEmbedding, int topK) {

        Endpoint endpoint = new Endpoint(this.pineconeUrl+"/query",new FixedDelay(4,2,TimeUnit.SECONDS));

        return new PineconeChain(

                Observable.create(emitter -> {
                    try {
                        // Prepare the request payload using a LinkedHashMap to maintain key order
                        Map<String, Object> payload = new LinkedHashMap<>();
                        payload.put("includeValues", true);
                        payload.put("includeMetadata", false);
                        payload.put("vector", queryEmbedding);
                        payload.put("top_k", topK);

                        // Convert the payload to a JSON string
                        String jsonPayload = objectMapper.writeValueAsString(payload);

                        // Send the request to Pinecone REST API
                        Response response = sendPostRequest(endpoint.getUrl(), jsonPayload);

                        emitter.onNext(Objects.requireNonNullElse(response.body().string(),""));
                        emitter.onComplete(); // Complete Signal Necessary

                    }catch (final Exception e){
                        emitter.onError(e);
                    }
                }), endpoint
        );
    }

    private Response sendPostRequest(String endpointUrl, String jsonPayload) {

        Response execute;
        try{

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

            execute = httpClient.newCall(request).execute();

            return execute;

        }catch (final Exception e){
            e.printStackTrace();
        }
        throw new UserException("Endpoint: "+endpointUrl+" unexpected problem");
    }


}

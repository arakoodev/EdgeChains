package com.flyspring.autoroute;

import java.util.List;
import java.util.Map;

import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.support.ServerRequestWrapper;

import com.fasterxml.jackson.databind.JsonNode;

import reactor.core.publisher.Mono;


public class FlyRequest extends ServerRequestWrapper{

    private ServerRequest request;

    public FlyRequest(ServerRequest delegate) {
        super(delegate);
        this.request =delegate;
    }

    public String getQueryParam(String key){
        if(request.queryParams().isEmpty())
            return "";
        else
            return request.queryParams().getFirst(key); 
    }
    public List<String> getQueryParamArray(String key){
        List<String> listString = request.queryParams().get(key);
        return listString;
    }
    public MultiValueMap<String, String> getQueryParams(){
        return request.queryParams();
    }

    public Map<String, String> getPathVariables(){
        return request.pathVariables();
    }

    public String getPathVariable(String key){
        return request.pathVariables().get(key);
    }

    public Mono<JsonNode> getRequestBody(){
        return request.bodyToMono(JsonNode.class);
    }


    
}

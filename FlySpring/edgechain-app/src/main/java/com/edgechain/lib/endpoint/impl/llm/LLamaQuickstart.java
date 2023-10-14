package com.edgechain.lib.endpoint.impl.llm;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.Llama2Service;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

import java.util.List;
import java.util.Objects;

public class LLamaQuickstart extends Endpoint {
    private final Retrofit retrofit = RetrofitClientInstance.getInstance();
    private final Llama2Service llama2Service = retrofit.create(Llama2Service.class);
    private final ModelMapper modelMapper = new ModelMapper();

//    @JsonProperty("text_inputs")
//    private String textInputs;
//    @JsonProperty("return_full_text")
//    private Boolean returnFullText;
//    @JsonProperty("top_k")
//    private Integer topK;
//
//    private String chainName;
//    private String callIdentifier;

    public LLamaQuickstart() {
    }

    public LLamaQuickstart(String url, RetryPolicy retryPolicy) {
        super(url, retryPolicy);
    }
//
//    public LLamaQuickstart(String url, RetryPolicy retryPolicy, Boolean returnFullText, Integer topK) {
//        super(url, retryPolicy);
//        this.returnFullText = returnFullText;
//        this.topK = topK;
//    }


//    public Observable<List<String>> chatCompletion(ArkRequest arkRequest) {
//        return chatCompletion(arkRequest);
//    }

    private Observable<List<String>> chatCompletion(ArkRequest arkRequest) {
        return Observable.fromSingle(this.llama2Service.llamaCompletion(this, arkRequest));
    }
}

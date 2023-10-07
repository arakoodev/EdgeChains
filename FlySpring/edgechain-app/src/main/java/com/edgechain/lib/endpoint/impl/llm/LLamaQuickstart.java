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

    @JsonProperty("text_inputs")
    private String textInputs;
    @JsonProperty("return_full_text")
    private Boolean returnFullText;
    @JsonProperty("top_k")
    private Integer topK;

    private String chainName;
    private String callIdentifier;

    public LLamaQuickstart() {
    }

    public LLamaQuickstart(String url, RetryPolicy retryPolicy) {
        super(url, retryPolicy);
        this.returnFullText = false;
        this.topK = 50;
    }

    public LLamaQuickstart(String url, RetryPolicy retryPolicy, Boolean returnFullText, Integer topK) {
        super(url, retryPolicy);
        this.returnFullText = returnFullText;
        this.topK = topK;
    }

    public String getTextInputs() {
        return textInputs;
    }

    public void setTextInputs(String textInputs) {
        this.textInputs = textInputs;
    }

    public Boolean getReturnFullText() {
        return returnFullText;
    }

    public void setReturnFullText(Boolean returnFullText) {
        this.returnFullText = returnFullText;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }

    public String getChainName() {
        return chainName;
    }

    public void setChainName(String chainName) {
        this.chainName = chainName;
    }

    public String getCallIdentifier() {
        return callIdentifier;
    }

    public void setCallIdentifier(String callIdentifier) {
        this.callIdentifier = callIdentifier;
    }

    public Observable<List<String>> chatCompletion(
            String inputs, String chainName, ArkRequest arkRequest) {

        LLamaQuickstart mapper = modelMapper.map(this, LLamaQuickstart.class);
        mapper.setTextInputs(inputs);
        mapper.setChainName(chainName);
        return chatCompletion(mapper, arkRequest);
    }

    private Observable<List<String>> chatCompletion(
            LLamaQuickstart mapper, ArkRequest arkRequest) {

        if (Objects.nonNull(arkRequest)) mapper.setCallIdentifier(arkRequest.getRequestURI());
        else mapper.setCallIdentifier("URI wasn't provided");

        return Observable.fromSingle(this.llama2Service.llamaCompletion(mapper));
    }
}

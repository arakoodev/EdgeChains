package com.edgechain.lib.endpoint.impl.llama2;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.Llama2Service;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import org.json.JSONObject;
import retrofit2.Retrofit;

import java.util.List;
import java.util.Objects;

public class Llama2Endpoint extends Endpoint {
    private final Retrofit retrofit = RetrofitClientInstance.getInstance();
    private final Llama2Service llama2Service = retrofit.create(Llama2Service.class);

//      "# hyperparameters for llm\n",
//              "payload = {\n",
//              "  \"inputs\":  prompt,\n",
//              "  \"parameters\": {\n",
//              "    \"do_sample\": True,\n",
//              "    \"top_p\": 0.6,\n",
//              "    \"temperature\": 0.7,\n",
//              "    \"top_k\": 50,\n",
//              "    \"max_new_tokens\": 512,\n",
//              "    \"repetition_penalty\": 1.2,\n",
//              "    \"stop\": [\"</s>\"]\n",
//              "  }\n",

    private List<ChatMessage> inputs;
    private JSONObject parameters;
    private Double temperature;
    private Integer topK;
    private Double topP;

    private Boolean doSample;
    private Integer maxNewTokens;
    private Double repetitionPenalty;
    private List<String> stop;
    private String chainName;
    private String callIdentifier;

    public Llama2Endpoint(String url, RetryPolicy retryPolicy, List<ChatMessage> inputs, JSONObject parameters,
                          Double temperature, Integer topK, Double topP,
                          Boolean doSample, Integer maxNewTokens, Double repetitionPenalty,
                          List<String> stop, String chainName, String callIdentifier) {
        super(url, retryPolicy);
        this.inputs = inputs;
        this.parameters = parameters;
        this.temperature = temperature;
        this.topK = topK;
        this.topP = topP;
        this.doSample = doSample;
        this.maxNewTokens = maxNewTokens;
        this.repetitionPenalty = repetitionPenalty;
        this.stop = stop;
        this.chainName = chainName;
        this.callIdentifier = callIdentifier;
    }

    public List<ChatMessage> getInputs() {
        return inputs;
    }

    public void setInputs(List<ChatMessage> inputs) {
        this.inputs = inputs;
    }

    public JSONObject getParameters() {
        return parameters;
    }

    public void setParameters(JSONObject parameters) {
        this.parameters = parameters;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }

    public Double getTopP() {
        return topP;
    }

    public void setTopP(Double topP) {
        this.topP = topP;
    }

    public Boolean getDoSample() {
        return doSample;
    }

    public void setDoSample(Boolean doSample) {
        this.doSample = doSample;
    }

    public Integer getMaxNewTokens() {
        return maxNewTokens;
    }

    public void setMaxNewTokens(Integer maxNewTokens) {
        this.maxNewTokens = maxNewTokens;
    }

    public Double getRepetitionPenalty() {
        return repetitionPenalty;
    }

    public void setRepetitionPenalty(Double repetitionPenalty) {
        this.repetitionPenalty = repetitionPenalty;
    }

    public List<String> getStop() {
        return stop;
    }

    public void setStop(List<String> stop) {
        this.stop = stop;
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

    public Observable<ChatCompletionResponse> chatCompletion(
            List<ChatMessage> inputs, String chainName, ArkRequest arkRequest) {
        this.chainName = chainName;
        this.inputs = inputs;
        return chatCompletion(arkRequest);
    }
    private Observable<ChatCompletionResponse> chatCompletion(ArkRequest arkRequest) {

        if (Objects.nonNull(arkRequest)) this.callIdentifier = arkRequest.getRequestURI();
        else this.callIdentifier = "URI wasn't provided";


        return Observable.fromSingle(this.llama2Service.chatCompletion(this));
    }
}

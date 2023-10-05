package com.edgechain.lib.llama2.request;

import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.json.JSONObject;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

public class Llama2ChatCompletionRequest {
//    private static final Double DEFAULT_TEMPERATURE = 0.7;
//
//    private static final Double DEFAULT_TOP_P = 1.0;
//
//    private static final List<String> DEFAULT_STOP = Collections.emptyList();
//    private static final Double DEFAULT_REPETITION_PENALTY = 0.0;
//    private static final String DEFAULT_USER = "";

    private List<ChatMessage> inputs;
    private JSONObject parameters;


//    private Double temperature;
//    @JsonProperty("top_k")
//    private Integer topK;
//    @JsonProperty("top_p")
//    private Double topP;
//
//    @JsonProperty("do_sample")
//    private Boolean doSample;
//    @JsonProperty("max_new_tokens")
//    private Integer maxNewTokens;
//    @JsonProperty("repetition_penalty")
//    private Double repetitionPenalty;
//    private List<String> stop;

    public Llama2ChatCompletionRequest() {
    }

    public Llama2ChatCompletionRequest(List<ChatMessage> inputs, JSONObject parameters
//                                       Double temperature, Integer topK, Double topP,
//                                       Boolean doSample, Integer maxNewTokens, Double repetitionPenalty,
//                                       List<String> stop
    ) {
        this.inputs = inputs;
        this.parameters = parameters;
//        this.temperature = (temperature != null) ? temperature : DEFAULT_TEMPERATURE;
//        this.topK = topK;
//        this.topP = (topP != null) ? topP : DEFAULT_TOP_P;
//        this.doSample = doSample;
//        this.maxNewTokens = maxNewTokens;
//        this.repetitionPenalty = (repetitionPenalty != null) ? repetitionPenalty : DEFAULT_REPETITION_PENALTY;
//        this.stop = (stop != null) ? stop : DEFAULT_STOP;
    }

    @Override
    public String toString() {
        return new StringJoiner(", ", Llama2ChatCompletionRequest.class.getSimpleName() + "[", "]")
                .add("inputs=" + inputs)
//                .add("temperature=" + temperature)
//                .add("topP=" + topP)
//                .add("stop=" + stop)
//                .add("repetitionPenalty=" + repetitionPenalty)
                .toString();
    }

    public static Llama2ChatCompletionRequestBuilder builder() {
        return new Llama2ChatCompletionRequestBuilder();
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


    public static class Llama2ChatCompletionRequestBuilder {
        private List<ChatMessage> inputs;
        private JSONObject parameters;

//        private Double temperature;
//        @JsonProperty("top_k")
//        private Integer topK;
//        @JsonProperty("top_p")
//        private Double topP;
//
//        @JsonProperty("do_sample")
//        private Boolean doSample;
//        @JsonProperty("max_new_tokens")
//        private Integer maxNewTokens;
//        @JsonProperty("repetition_penalty")
//        private Double repetitionPenalty;
//        private List<String> stop;
//        private String chainName;
//        private String callIdentifier;

        private Llama2ChatCompletionRequestBuilder() {}

//        public Llama2ChatCompletionRequestBuilder temperature(Double temperature) {
//            this.temperature = temperature;
//            return this;
//        }

        public Llama2ChatCompletionRequestBuilder inputs(List<ChatMessage> inputs) {
            this.inputs = inputs;
            return this;
        }

        public Llama2ChatCompletionRequestBuilder parameters(JSONObject parameters) {
            this.parameters = parameters;
            return this;
        }

//        public Llama2ChatCompletionRequestBuilder topP(Double topP) {
//            this.topP = topP;
//            return this;
//        }
//
//        public Llama2ChatCompletionRequestBuilder stop(List<String> stop) {
//            this.stop = stop;
//            return this;
//        }
//
//        public Llama2ChatCompletionRequestBuilder repetitionPenalty(Double repetitionPenalty) {
//            this.repetitionPenalty = repetitionPenalty;
//            return this;
//        }

        public Llama2ChatCompletionRequest build() {
            return new Llama2ChatCompletionRequest(
                    inputs,
                    parameters);
        }
    }
}
package com.edgechain.lib.openai.embeddings.models.openai;

import java.util.List;

public class OpenAiEmbedding {

    private String object;
    private List<Double> embedding;
    private Integer index;

    public String getObject() {
        return object;
    }

    public void setObject(String object) {
        this.object = object;
    }

    public List<Double> getEmbedding() {
        return embedding;
    }

    public void setEmbedding(List<Double> embedding) {
        this.embedding = embedding;
    }

    public Integer getIndex() {
        return index;
    }

    public void setIndex(Integer index) {
        this.index = index;
    }

    @Override
    public String toString() {
        return "OpenAiEmbedding{" + "object='" + object + '\'' +
                ", embedding=" + embedding +
                ", index=" + index +
                '}';
    }
}

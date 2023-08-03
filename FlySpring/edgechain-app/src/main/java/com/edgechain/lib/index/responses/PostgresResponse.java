package com.edgechain.lib.index.responses;

import com.edgechain.lib.embeddings.WordEmbeddings;

public class PostgresResponse {
    private WordEmbeddings wordEmbeddings;
    private String fileName;

    public PostgresResponse() {
    }

    public PostgresResponse(WordEmbeddings wordEmbeddings, String fileName) {
        this.wordEmbeddings = wordEmbeddings;
        this.fileName = fileName;
    }

    public WordEmbeddings getWordEmbeddings() {
        return wordEmbeddings;
    }

    public void setWordEmbeddings(WordEmbeddings wordEmbeddings) {
        this.wordEmbeddings = wordEmbeddings;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }
}

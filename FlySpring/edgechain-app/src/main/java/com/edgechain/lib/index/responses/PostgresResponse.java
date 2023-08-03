package com.edgechain.lib.index.responses;

import com.edgechain.lib.embeddings.WordEmbeddings;

import java.sql.Timestamp;

public class PostgresResponse {
    private String id;
    private WordEmbeddings wordEmbeddings;
    private String fileName;
    private Integer sno;
    private Timestamp timestamp;

    public PostgresResponse() {
    }

    public PostgresResponse(String id, WordEmbeddings wordEmbeddings, String fileName, Integer sno, Timestamp timestamp) {
        this.id = id;
        this.wordEmbeddings = wordEmbeddings;
        this.fileName = fileName;
        this.sno = sno;
        this.timestamp = timestamp;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Integer getSno() {
        return sno;
    }

    public void setSno(Integer sno) {
        this.sno = sno;
    }

    public Timestamp getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Timestamp timestamp) {
        this.timestamp = timestamp;
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

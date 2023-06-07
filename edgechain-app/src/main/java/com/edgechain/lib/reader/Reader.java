package com.edgechain.lib.reader;

import org.springframework.web.multipart.MultipartFile;

import java.io.Serializable;

public abstract class Reader implements Serializable {

    private static final long serialVersionUID = 5990895695593800211L;

    public Reader() {}

    public abstract String[] readByChunkSize(MultipartFile file, int chunkSize);
    public abstract String[] readBySentence(MultipartFile file);

}

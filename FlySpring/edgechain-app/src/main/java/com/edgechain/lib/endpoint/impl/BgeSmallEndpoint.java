package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.EmbeddingEndpoint;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.BgeSmallService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import retrofit2.Retrofit;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URL;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.util.Objects;

public class BgeSmallEndpoint extends EmbeddingEndpoint {

    private Logger logger = LoggerFactory.getLogger(BgeSmallEndpoint.class);

    private final Retrofit retrofit = RetrofitClientInstance.getInstance();
    private final BgeSmallService bgeSmallService = retrofit.create(BgeSmallService.class);

    private String modelUrl;
    private String tokenizerUrl;

    private String callIdentifier;
    private final String MODEL_PATH = "./model/model.onnx";
    private final String TOKENIZER_PATH = "./model/tokenizer.json";
    private final String MODEL_FOLDER = "./model";

    public BgeSmallEndpoint() {
    }

    public BgeSmallEndpoint(String modelUrl, String tokenizerUrl) {
        this.modelUrl = modelUrl;
        this.tokenizerUrl = tokenizerUrl;

        logger.info("Downloading bge-small-en model. Please wait...");
        File modelFile = new File(MODEL_PATH);
        File tokenizerFile = new File(TOKENIZER_PATH);

        // check if the file already exists
        if (!modelFile.exists()) downloadFile(modelUrl, MODEL_PATH);
        if (!tokenizerFile.exists()) downloadFile(tokenizerUrl, TOKENIZER_PATH);
        logger.info("Model downloaded successfully!");
    }

    public String getModelUrl() {
        return modelUrl;
    }

    public String getTokenizerUrl() {
        return tokenizerUrl;
    }


    public String getCallIdentifier() {
        return callIdentifier;
    }

    public BgeSmallEndpoint(RetryPolicy retryPolicy, String modelUrl, String tokenizerUrl) {
        super(retryPolicy);
        this.modelUrl = modelUrl;
        this.tokenizerUrl = tokenizerUrl;
    }

    @Override
    public Observable<WordEmbeddings> embeddings(String input, ArkRequest arkRequest) {

        final String str = input.replaceAll("'", "");

        setRawText(str);

        if (Objects.nonNull(arkRequest)) this.callIdentifier = arkRequest.getRequestURI();
        else this.callIdentifier = "URI wasn't provided";

        return Observable.fromSingle(
                bgeSmallService
                        .embeddings(this)
                        .map(m -> new WordEmbeddings(input, m.getEmbedding()))
        );
    }

    private void downloadFile(String urlStr, String path) {

        File modelFolderFile = new File(MODEL_FOLDER);

        if (!modelFolderFile.exists()) {
            modelFolderFile.mkdir();
        }

        ReadableByteChannel rbc = null;
        FileOutputStream fos = null;
        try {
            URL url = new URL(urlStr);
            rbc = Channels.newChannel(url.openStream());
            fos = new FileOutputStream(path);
            fos.getChannel().transferFrom(rbc, 0, Long.MAX_VALUE);
        } catch (IOException e) {
            logger.info("Error downloading model");
            e.printStackTrace();
        } finally {
            assert fos != null;
            try {
                fos.close();
                rbc.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }
}

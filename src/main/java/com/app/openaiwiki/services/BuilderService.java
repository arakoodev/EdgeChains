package com.app.openaiwiki.services;

import com.app.openaiwiki.chains.BuilderChain;
import com.app.rxjava.transformer.observable.EdgeChain;
import org.springframework.web.multipart.MultipartFile;

public interface BuilderService {

    EdgeChain<String> createChatCompletion(String query);
    BuilderChain extractInformation(MultipartFile file, String query);


}


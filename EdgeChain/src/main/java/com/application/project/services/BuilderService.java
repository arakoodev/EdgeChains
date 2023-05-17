package com.application.project.services;

import com.app.rxjava.transformer.observable.AbstractEdgeChain;

public interface BuilderService {

    AbstractEdgeChain<String> openAIWithWiki(String query);


}

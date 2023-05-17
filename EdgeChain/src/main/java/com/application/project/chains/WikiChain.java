package com.application.project.chains;

import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class WikiChain extends EdgeChain<String> {

public WikiChain(Observable<String> observable) {super(observable);}
}

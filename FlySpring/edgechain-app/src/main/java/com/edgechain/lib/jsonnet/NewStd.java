package com.edgechain.lib.jsonnet;

import com.edgechain.lib.endpoint.impl.WikiEndpoint;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.core.Observable;
import scala.collection.mutable.HashMap;
import scala.runtime.BoxedUnit;
import sjsonnet.FileScope;
import sjsonnet.Path;
import sjsonnet.Position;
import sjsonnet.Val;

import java.util.LinkedHashMap;
import java.util.List;


public class NewStd extends sjsonnet.Std {
    public Val.Obj search() {
        System.out.println("\n\n\n Inside custom sjsonnet function! \n\n ");
        WikiEndpoint wikiEndpoint = new WikiEndpoint();

        Observable<WikiResponse> result = wikiEndpoint.getPageContent("Nikola Tesla");
        result.subscribe(
                wikiResponse -> System.out.println(wikiResponse.getText()),
                throwable -> System.out.println(throwable.getMessage()),
                () -> System.out.println("Completed")
        );

        return new Val.Obj(
                new Position(null, 0),
                null,
                false,
                arg -> BoxedUnit.UNIT,
                null,
                new HashMap<>(),
                new LinkedHashMap<>()
        );
    }
}

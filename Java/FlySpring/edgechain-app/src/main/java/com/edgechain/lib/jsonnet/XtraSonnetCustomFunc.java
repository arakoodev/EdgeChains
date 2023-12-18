package com.edgechain.lib.jsonnet;

import com.edgechain.lib.endpoint.impl.wiki.WikiEndpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.github.jam01.xtrasonnet.DataFormatService;
import io.github.jam01.xtrasonnet.header.Header;
import io.github.jam01.xtrasonnet.spi.Library;
import sjsonnet.Importer;
import sjsonnet.Val;

import java.util.*;

public class XtraSonnetCustomFunc extends Library {
  @Override
  public String namespace() {
    return "udf";
  }

  @Override
  public Map<String, Val.Func> functions(
      DataFormatService dataFormats, Header header, Importer importer) {
    var res = new HashMap<String, Val.Func>();
    res.put(
        "fn",
        builtin(
            new String[] {"param"},
            (vals, pos, ev) -> {
              String prompt = vals[0].asString();
              if (prompt == null || prompt.equals("")) {
                return new Val.Str(dummyPosition(), "");
              }
              WikiEndpoint wikiEndpoint = new WikiEndpoint();

              String response =
                  new EdgeChain<>(wikiEndpoint.getPageContent(prompt)).get().getText();
              return new Val.Str(dummyPosition(), response);
            }));
    return res;
  }
}

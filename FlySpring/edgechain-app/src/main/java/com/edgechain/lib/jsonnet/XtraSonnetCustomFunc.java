package com.edgechain.lib.jsonnet;

import com.edgechain.lib.endpoint.impl.WikiEndpoint;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.github.jam01.xtrasonnet.DataFormatService;
import io.github.jam01.xtrasonnet.header.Header;
import io.github.jam01.xtrasonnet.spi.Library;
import io.reactivex.rxjava3.core.Observable;
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

              Observable<WikiResponse> result = wikiEndpoint.getPageContent(prompt);
              String response = result.blockingFirst().getText();
              return new Val.Str(dummyPosition(), response);
            }));
    return res;
  }
}

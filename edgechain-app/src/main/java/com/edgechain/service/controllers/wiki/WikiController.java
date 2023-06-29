package com.edgechain.service.controllers.wiki;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import com.edgechain.lib.wiki.provider.WikiProvider;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController("Service WikiController")
@RequestMapping(value = WebConstants.SERVICE_CONTEXT_PATH + "/wiki")
public class WikiController {

    @GetMapping(
            value = "/page-content",
            consumes = {MediaType.APPLICATION_JSON_VALUE},
            produces = {MediaType.APPLICATION_JSON_VALUE})
    public Single<ChainResponse> wikiContent(@RequestParam("query") String query) {
        WikiProvider wikiProvider = new WikiProvider();
        ChainWrapper wrapper = new ChainWrapper();
        return wrapper.chains(new ChainRequest(query), wikiProvider).toSingleWithRetry();
    }
}

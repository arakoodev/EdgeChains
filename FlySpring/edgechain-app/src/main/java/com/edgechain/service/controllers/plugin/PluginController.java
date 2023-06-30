package com.edgechain.service.controllers.plugin;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.openai.plugin.providers.PluginAPIProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.request.PluginAPIRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.*;

@RestController("Service PluginController")
@RequestMapping(value = WebConstants.SERVICE_CONTEXT_PATH + "/plugins")
public class PluginController {

  @PostMapping("/with-api")
  public Single<ChainResponse> getAPI(@RequestBody PluginAPIRequest request) {
    OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());
    ChainProvider chainProvider =
        new PluginAPIProvider(provider, request.getPluginEndpoint(), request.getSpecEndpoint());
    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), chainProvider).toSingleWithRetry();
  }
}

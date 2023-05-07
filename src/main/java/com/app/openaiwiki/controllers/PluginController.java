package com.app.openaiwiki.controllers;

import com.app.openaiwiki.services.PluginOpenAiService;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/plugins")
public class PluginController {

    @Autowired private PluginOpenAiService pluginOpenAiService;

    @GetMapping(value = "/klarna", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Observable<String> getKlarna(@RequestParam("query") String query){
        return pluginOpenAiService.requestKlarna(query).getScheduledObservableWithoutRetry();
    }

    @GetMapping(value = "/shopbox", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Observable<String> getShopBox(@RequestParam("query") String query){
       return pluginOpenAiService.requestShopBox(query).getScheduledObservableWithoutRetry();
    }

    // Query = How much is 3849 x 8394 ?
    // Query = Divide 156059 / 32 ?
    // Query = Multiply 10 x 10
    @GetMapping(value = "/calculator", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Observable<String> getCalculator(@RequestParam("query") String query){
        return pluginOpenAiService.requestCalculator(query).getScheduledObservableWithoutRetry();
    }

}

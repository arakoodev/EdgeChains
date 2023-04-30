package com.app.openaiwiki.controllers;

import com.app.openaiwiki.services.PluginService;
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

    @Autowired
    private PluginService pluginService;

    @GetMapping(value = "/klarna",produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Observable<String> get(@RequestParam("query") String query){
        return pluginService.requestKlarna(query).getScheduledObservable();
    }

}

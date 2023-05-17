package com.application.project.services;

import com.application.project.chains.WikiChain;

public interface PluginService extends ToolService {

    WikiChain getPageContent(String pageTitle);
}

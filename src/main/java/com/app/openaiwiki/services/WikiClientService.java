package com.app.openaiwiki.services;

import com.app.openaiwiki.chains.WikiChain;

public interface WikiClientService {

  WikiChain getPageContent(String pageTitle);
}

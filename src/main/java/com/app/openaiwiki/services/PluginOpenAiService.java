package com.app.openaiwiki.services;

import com.app.openaiwiki.chains.CalculatorChain;
import com.app.openaiwiki.chains.KlarnaChain;
import com.app.openaiwiki.chains.ShopBoxChain;

public interface PluginOpenAiService {

    KlarnaChain requestKlarna(String query);
    ShopBoxChain requestShopBox(String query);

    CalculatorChain requestCalculator(String query);

}

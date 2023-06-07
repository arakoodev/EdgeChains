package com.edgechain.app.controllers.pinecone;

import com.edgechain.app.services.index.PineconeService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

import static com.edgechain.app.constants.WebConstants.PINECONE_AUTH_KEY;
import static com.edgechain.app.constants.WebConstants.PINECONE_DELETE_API;

@RestController("App PineconeController")
@RequestMapping("/v1/pinecone")
public class PineconeController {

  @Autowired private PineconeService pineconeService;

  @DeleteMapping("/deleteAll")
  public ChainResponse delete() {

    Endpoint pineconeEndpoint =
        new Endpoint(
            PINECONE_DELETE_API,
            PINECONE_AUTH_KEY,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    return this.pineconeService.deleteAll(new PineconeRequest(pineconeEndpoint));
  }
}

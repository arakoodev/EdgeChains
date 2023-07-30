package com.edgechain.doc2vec;

import com.edgechain.lib.endpoint.impl.Doc2VecEndpoint;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.edgechain.lib.embeddings.request.Doc2VecRequest;
import com.edgechain.lib.response.StringResponse;

import java.io.File;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class Doc2VecTest {

  @LocalServerPort int randomServerPort;

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", "" + randomServerPort);
  }

  @Test
  @DisplayName("Test Doc2Vec Model Training")
  public void doc2VecEndpoint_TrainModel_AssertNoErrors(TestInfo testInfo)
      throws InterruptedException {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    // Prepare test data
    Doc2VecRequest doc2Vec = new Doc2VecRequest();
    doc2Vec.setFolderDirectory("src/test/java/resources/train");
    doc2Vec.setEpochs(1);
    doc2Vec.setMinWordFrequency(5);
    doc2Vec.setLearningRate(0.025);
    doc2Vec.setLayerSize(333);
    doc2Vec.setBatchSize(15);
    doc2Vec.setWindowSize(3);

    doc2Vec.setDestination(new File(System.getProperty("java.io.tmpdir")).getAbsolutePath());
    doc2Vec.setModelName("doc2vec");

    Doc2VecEndpoint endpoint = new Doc2VecEndpoint();
    TestObserver<StringResponse> test = endpoint.build(doc2Vec).test();

    test.await();

    logger.info(test.values().get(0).getResponse());

    test.assertNoErrors();
  }
}

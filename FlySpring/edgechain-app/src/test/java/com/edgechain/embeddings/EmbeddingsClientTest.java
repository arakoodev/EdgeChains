package com.edgechain.embeddings;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.edgechain.lib.embeddings.request.Doc2VecRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.service.controllers.embeddings.Doc2VecController;

import io.reactivex.rxjava3.core.Single;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class EmbeddingsClientTest {

    @LocalServerPort
    int randomServerPort;

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    @BeforeEach
    public void setup() {
        System.setProperty("server.port", "" + randomServerPort);
    }

    @Autowired
    private Doc2VecController doc2VecController;

    @Test
    @DisplayName("Test Build Method Returns StringResponse")
    @Order(1)
    public void doc2VecController_TestBuildMethod_ReturnsStringResponse(TestInfo testInfo) {

        logger.info("======== " + testInfo.getDisplayName() + " ========");

        // Prepare test data
        Doc2VecRequest request = new Doc2VecRequest();
        request.setFolderDirectory("path/to/folder");

        // Call the build method
        Single<StringResponse> result = doc2VecController.build(request);

        // Verify the response
        assertNotNull(result);
        assertEquals(StringResponse.class, result.blockingGet().getClass());
    }

    @Test
    public void doc2VecController_TestBuildMethod_CallsDoc2VecBuilder(TestInfo testInfo) throws Exception {

        logger.info("======== " + testInfo.getDisplayName() + " ========");

        Doc2VecController doc2VecController = new Doc2VecController();
        Doc2VecRequest request = new Doc2VecRequest();
        request.setFolderDirectory("path/to/folder");

        Single<StringResponse> result = doc2VecController.build(request);

        assertNotNull(result);
        assertEquals(StringResponse.class, result.blockingGet().getClass());
        assertEquals("The model building has been started. For logging purpose, look into your console.",
                result.blockingGet().getResponse());

    }

}

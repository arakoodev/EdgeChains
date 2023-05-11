package com.app.openaiwiki.services;

import com.app.openaiwiki.services.impl.BuilderServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.observers.TestObserver;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.io.*;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class BuilderServiceTest {

  @Mock RestTemplate restTemplate;
  private MockRestServiceServer mockServer;
  private ObjectMapper objectMapper = new ObjectMapper();

  @Autowired BuilderService builderService = new BuilderServiceImpl();

  // Arrange
  @BeforeEach
  public void setup() {
    mockServer = MockRestServiceServer.createServer(restTemplate);
  }

  @ParameterizedTest
  @DisplayName("Openai-Wiki Service")
  @CsvSource({
    "Question: Author David Chanoff has collaborated with a U.S. Navy admiral who served as the"
        + " ambassador to the United Kingdom under which President?"
  })
  void testBuilderComponent_ProvidedEmptyString_ShouldContinueUntilActionContentIsNull(String query)
      throws InterruptedException {

    // Act
    TestObserver<String> test =
        builderService.openAIWithWiki(query).getScheduledObservableWithRetry().test();
    test.await();

    // Assert
    test.assertComplete();
  }

  //    @DisplayName("Openai-Pinecone Word2Vec")
  //    @ParameterizedTest
  //    @CsvSource(
  //            {
  //                    "..." + // Your File Path
  //                            " Question: What is the collect stage of data maturity? Helpful
  // Answer, data maturity"
  //            })
  //        // Put Your Filepath Here
  //    void testPerformQuery_ProvidedMultiPartAndQuery_ShouldReturnTheResult(String filePath,
  // String query, String textContain) throws IOException, InterruptedException {
  //
  //        // Arrange
  //        File file = new File(filePath);
  //        FileItem fileItem = new DiskFileItem("file", Files.probeContentType(file.toPath()),
  // false, file.getName(), (int) file.length(), file.getParentFile());
  //
  //        IOUtils.copy(new FileInputStream(file), fileItem.getOutputStream());
  //
  //        MultipartFile multipartFile = new CommonsMultipartFile(fileItem);
  //
  //        // Act
  //        TestObserver<String> test = builderService.extractInformation(multipartFile, query)
  //                .getObservable().test();
  //
  //        test.await();
  //
  //        // Assert
  //        test.assertComplete();
  //
  //       assertThat(test.values().get(0), CoreMatchers.containsString(textContain));
  //
  //
  //
  //    }

}

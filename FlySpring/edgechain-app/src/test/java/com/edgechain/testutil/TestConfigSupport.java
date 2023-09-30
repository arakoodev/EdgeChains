package com.edgechain.testutil;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationContext;
import org.springframework.test.util.ReflectionTestUtils;
import retrofit2.Retrofit;
import static org.mockito.Mockito.mock;

/** Two useful pairs of functions to set private static fields. */
public final class TestConfigSupport {

  private ApplicationContext prevAppContext;
  private String prevServerPort;

  /**
   * Creates and forcefully uses a mock application context. Previous value is remembered. Call this
   * once in a @BeforeEach setup method.
   *
   * @return a mock application context
   */
  public ApplicationContext setupAppContext() {
    prevAppContext = ApplicationContextHolder.getContext();

    ApplicationContext mockAppContext = mock(ApplicationContext.class);
    ReflectionTestUtils.setField(ApplicationContextHolder.class, "context", mockAppContext);

    return mockAppContext;
  }

  /**
   * Restore a previously saved application context. Call this once in an @AfterEach teardown
   * method.
   */
  public void tearDownAppContext() {
    ReflectionTestUtils.setField(ApplicationContextHolder.class, "context", prevAppContext);
  }

  /**
   * Creates and forcefully uses a mock Retrofit instance. Call this once in a @BeforeEach setup
   * method.
   *
   * @return a mock Retrofit instance
   */
  public Retrofit setupRetrofit() {
    Retrofit mockRetrofit = mock(Retrofit.class);
    ReflectionTestUtils.setField(RetrofitClientInstance.class, "retrofit", mockRetrofit);

    // Retrofit needs a valid port
    prevServerPort = System.getProperty("server.port");
    System.setProperty("server.port", "8888");

    return mockRetrofit;
  }

  private ModelMapper setupModelMapper() {
    ModelMapper mockModelMapper = mock(ModelMapper.class);
    ReflectionTestUtils.setField(ModelMapper.class, "modelMapper", mockModelMapper);
    // Retrofit needs a valid port
    prevServerPort = System.getProperty("server.port");
    System.setProperty("server.port", "8888");
    return mockModelMapper;
  }

  /**
   * Erases the current Retrofit instance so it can be recreated. Call this once in an @AfterEach
   * teardown method.
   */
  public void tearDownRetrofit() {
    ReflectionTestUtils.setField(RetrofitClientInstance.class, "retrofit", null);

    if (prevServerPort != null) {
      System.setProperty("server.port", prevServerPort);
    }
  }
}

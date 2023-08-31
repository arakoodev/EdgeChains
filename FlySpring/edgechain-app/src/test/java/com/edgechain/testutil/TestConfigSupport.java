package com.edgechain.testutil;

import java.lang.reflect.Field;
import org.springframework.context.ApplicationContext;
import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.Mockito.mock;
import retrofit2.Retrofit;

/**
 * Two useful pairs of functions to set private static fields as we need.
 */
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
    // Retrofit needs an application context which is a
    // private static field so we use reflection to set it.
    prevAppContext = ApplicationContextHolder.getContext();

    ApplicationContext mockAppContext = mock(ApplicationContext.class);
    try {
      Field field = ApplicationContextHolder.class.getDeclaredField("context");
      field.setAccessible(true);
      field.set(null, mockAppContext);
    } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
        | IllegalAccessException e) {
      fail("could not setup context for test", e);
    }

    return mockAppContext;
  }

  /**
   * Restore a previously saved application context. Call this once in an @AfterEach teardown
   * method.
   */
  public void tearDownAppContext() {
    try {
      Field field = ApplicationContextHolder.class.getDeclaredField("context");
      field.setAccessible(true);
      field.set(null, prevAppContext); // set to whatever was originally used
    } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
        | IllegalAccessException e) {
      fail("could not tear down context for test", e);
    }
  }

  /**
   * Creates and forcefully uses a mock Retrofit instance. Call this once in a @BeforeEach setup
   * method.
   * 
   * @return a mock Retrofit instance
   */
  public Retrofit setupRetrofit() {
    // use reflection to prepare a Retrofit instance
    Retrofit mockRetrofit = mock(Retrofit.class);
    try {
      Field field = RetrofitClientInstance.class.getDeclaredField("retrofit");
      field.setAccessible(true);
      field.set(null, mockRetrofit);
    } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
        | IllegalAccessException e) {
      fail("could not setup retrofit for test", e);
    }

    // Retrofit needs a valid port
    prevServerPort = System.getProperty("server.port");
    System.setProperty("server.port", "8888");

    return mockRetrofit;
  }

  /**
   * Erases the current Retrofit instance so it can be recreated. Call this once in an @AfterEach
   * teardown method.
   */
  public void tearDownRetrofit() {
    try {
      Field field = RetrofitClientInstance.class.getDeclaredField("retrofit");
      field.setAccessible(true);
      field.set(null, null); // set to null so it will be created again if needed
    } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
        | IllegalAccessException e) {
      fail("could not set retrofit for test", e);
    }

    if (prevServerPort != null) {
      System.setProperty("server.port", prevServerPort);
    }
  }

}

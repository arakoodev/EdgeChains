package com.edgechain.supabase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import com.edgechain.lib.supabase.entities.User;
import com.edgechain.lib.supabase.exceptions.SupabaseAuthException;
import com.edgechain.lib.supabase.exceptions.SupabaseUserExistException;
import com.edgechain.lib.supabase.repository.UserRepository;
import com.edgechain.lib.supabase.request.Credential;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import com.edgechain.lib.supabase.services.SupabaseAuthService;
import com.edgechain.lib.supabase.services.impl.UserServiceImpl;
import com.edgechain.service.controllers.supabase.SupabaseController;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
public class AuthControllerTest {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Mock private UserRepository userRepository;

  @InjectMocks private SupabaseController supabaseController;

  @InjectMocks @Spy private UserServiceImpl userService;

  @Mock private SupabaseAuthService supabaseAuthService;

  @Test
  @DisplayName("Test Signup with valid credential")
  public void authController_SignupWithValidCredential_ReturnSupabaseUser(TestInfo testInfo)
      throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    Credential testCredential = new Credential("test@example.com", "testPassword");

    // Set up mock behavior for userRepository.findByEmail() to return an empty
    // Optional (email doesn't exist)
    when(userRepository.findByEmail(testCredential.getEmail())).thenReturn(Optional.empty());

    // Set up mock behavior for supabaseAuthService.signUpWithEmail()
    SupabaseUser expectedSupabaseUser = new SupabaseUser();
    expectedSupabaseUser.setId(UUID.randomUUID());
    expectedSupabaseUser.setEmail(testCredential.getEmail());
    when(supabaseAuthService.signUpWithEmail(testCredential)).thenReturn(expectedSupabaseUser);

    // Call the signup method of UserServiceImpl
    SupabaseUser actualSupabaseUser = userService.signup(testCredential);

    // Verify the result
    assertNotNull(actualSupabaseUser);
    assertEquals(expectedSupabaseUser.getId(), actualSupabaseUser.getId());
    assertEquals(expectedSupabaseUser.getEmail(), actualSupabaseUser.getEmail());

    // Verify that userRepository.findByEmail() was called with the test email
    verify(userRepository, times(1)).findByEmail(testCredential.getEmail());

    // Verify that supabaseAuthService.signUpWithEmail() was called with the test
    // credential
    verify(supabaseAuthService, times(1)).signUpWithEmail(testCredential);
  }

  @Test
  @DisplayName("Test Signup with existing email")
  public void authController_SignupWithExistingEmail_ThrowSupabaseUserExistException(
      TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    Credential testCredential = new Credential("existing@example.com", "testPassword");

    // Mock the behavior of userRepository.findByEmail to return an optional
    // containing a user
    User existingUser = new User();
    existingUser.setEmail(testCredential.getEmail());
    when(userRepository.findByEmail(testCredential.getEmail()))
        .thenReturn(Optional.of(existingUser));

    // Call the signup method of UserServiceImpl
    assertThrows(
        SupabaseUserExistException.class,
        () -> {
          userService.signup(testCredential);
        });

    // Verify that userRepository.findByEmail() was called with the testCredential
    verify(userRepository, times(1)).findByEmail(testCredential.getEmail());
  }

  @Test
  @DisplayName("Test Login with valid credential")
  public void authController_LoginWithValidCredential_ReturnAuthenticatedResponse(TestInfo testInfo)
      throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    Credential testCredential = new Credential("test@example.com", "testPassword");

    // Set up mock behavior for supabaseAuthService.signInWithEmail()
    AuthenticatedResponse expectedResponse = new AuthenticatedResponse();
    expectedResponse.setAccess_token("testAccessToken");
    expectedResponse.setRefresh_token("testRefreshToken");
    expectedResponse.setToken_type("jwt");
    expectedResponse.setExpires_in(3600);

    when(supabaseAuthService.signInWithEmail(testCredential)).thenReturn(expectedResponse);

    // Call the login method directly
    AuthenticatedResponse result = userService.login(testCredential);

    // Verify the result
    assertNotNull(result);
    assertEquals(expectedResponse, result);

    // Verify that supabaseAuthService.signInWithEmail() was called with the
    // testCredential
    verify(supabaseAuthService, times(1)).signInWithEmail(testCredential);
  }

  @Test
  @DisplayName("Test Login with invalid credential")
  public void authController_LoginWithInvalidCredential_ThrowSupabaseAuthException(
      TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    Credential testCredential = new Credential("test@example.com", "wrongPassword");

    // Set up mock behavior for supabaseAuthService.signInWithEmail() to throw an
    // exception
    when(supabaseAuthService.signInWithEmail(testCredential))
        .thenThrow(new SupabaseAuthException("Invalid credentials"));

    // Call the login method directly
    try {
      userService.login(testCredential);
    } catch (SupabaseAuthException e) {
      // Verify that supabaseAuthService.signInWithEmail() was called with the
      // testCredential
      verify(supabaseAuthService, times(1)).signInWithEmail(testCredential);
      return;
    }
  }

  @Test
  @DisplayName("Test RefreshToken with valid refresh token")
  public void authController_RefreshTokenWithValidRefreshToken_ReturnAuthenticatedResponse(
      TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String refreshToken = "testRefreshToken";

    // Set up mock behavior for supabaseAuthService.refreshToken()
    AuthenticatedResponse expectedResponse = new AuthenticatedResponse();
    when(supabaseAuthService.refreshToken(refreshToken)).thenReturn(expectedResponse);

    // Call the refreshToken method of UserServiceImpl
    AuthenticatedResponse actualResponse = userService.refreshToken(refreshToken);

    // Verify the result
    assertNotNull(actualResponse);
    assertEquals(expectedResponse, actualResponse);

    // Verify that supabaseAuthService.refreshToken() was called with the test
    // refresh token
    verify(supabaseAuthService, times(1)).refreshToken(refreshToken);
  }

  @Test
  @DisplayName("Test RefreshToken with invalid refresh token")
  public void authController_RefreshTokenWithInvalidRefreshToken_ThrowSupabaseAuthException(
      TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String refreshToken = "invalidRefreshToken";

    // Set up mock behavior for supabaseAuthService.refreshToken() to throw an
    // exception
    when(supabaseAuthService.refreshToken(refreshToken))
        .thenThrow(new SupabaseAuthException("Invalid refresh token"));

    // Call the refreshToken method directly
    assertThrows(
        SupabaseAuthException.class,
        () -> {
          userService.refreshToken(refreshToken);
        });
  }
}

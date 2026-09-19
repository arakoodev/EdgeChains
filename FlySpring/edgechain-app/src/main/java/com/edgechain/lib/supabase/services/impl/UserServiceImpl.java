package com.edgechain.lib.supabase.services.impl;

import java.util.Optional;

import com.edgechain.lib.supabase.entities.User;
import com.edgechain.lib.supabase.exceptions.SupabaseUserExistException;
import com.edgechain.lib.supabase.repository.UserRepository;
import com.edgechain.lib.supabase.request.Credential;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import com.edgechain.lib.supabase.services.SupabaseAuthService;
import com.edgechain.lib.supabase.services.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Autowired private SupabaseAuthService supabaseAuthService;

  @Autowired private UserRepository userRepository;

  @Override
  public SupabaseUser getUser(String accessToken) {
    return this.supabaseAuthService.getUser(accessToken);
  }

  @Override
  public AuthenticatedResponse login(Credential credential) {
    return this.supabaseAuthService.signInWithEmail(credential);
  }

  @Override
  public AuthenticatedResponse refreshToken(String refreshToken) {
    return this.supabaseAuthService.refreshToken(refreshToken);
  }

  @Override
  public SupabaseUser signup(Credential credential) {
    Optional<User> userOptional = userRepository.findByEmail(credential.getEmail());
    if (userOptional.isPresent()) {
      logger.error("User already exists.");
      throw new SupabaseUserExistException("User already exists.");
    }

    return this.supabaseAuthService.signUpWithEmail(credential);
  }

  @Override
  public void signOut(String accessToken) {
    this.supabaseAuthService.signOut(accessToken);
  }
}

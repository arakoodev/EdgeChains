package com.app.supabase.services.impl;

import com.app.supabase.entities.User;
import com.app.supabase.exceptions.SupabaseUserExistException;
import com.app.supabase.repository.UserRepository;
import com.app.supabase.request.Credential;
import com.app.supabase.response.AuthenticatedResponse;
import com.app.supabase.response.SupabaseUser;
import com.app.supabase.services.SupabaseAuthService;
import com.app.supabase.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserServiceImpl implements UserService {

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
    if (userOptional.isPresent()) throw new SupabaseUserExistException("User already exists.");

    return this.supabaseAuthService.signUpWithEmail(credential);
  }

  @Override
  public void signOut(String accessToken) {
    this.supabaseAuthService.signOut(accessToken);
  }
}

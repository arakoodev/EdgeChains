package com.app.supabase.services;

import com.app.supabase.request.Credential;
import com.app.supabase.response.AuthenticatedResponse;
import com.app.supabase.response.SupabaseUser;

public interface UserService {

  SupabaseUser getUser(String accessToken);

  AuthenticatedResponse login(Credential credential);

  AuthenticatedResponse refreshToken(String refreshToken);

  SupabaseUser signup(Credential credential);

  void signOut(String accessToken);
}

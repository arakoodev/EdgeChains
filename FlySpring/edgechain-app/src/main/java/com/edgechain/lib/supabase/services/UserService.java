package com.edgechain.lib.supabase.services;

import com.edgechain.lib.supabase.request.Credential;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;

public interface UserService {

  SupabaseUser getUser(String accessToken);

  AuthenticatedResponse login(Credential credential);

  AuthenticatedResponse refreshToken(String refreshToken);

  SupabaseUser signup(Credential credential);

  void signOut(String accessToken);
}

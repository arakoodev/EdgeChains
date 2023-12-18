package com.edgechain.lib.endpoint.impl.supabase;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.SupabaseService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.supabase.request.Credential;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import retrofit2.Retrofit;

import java.util.HashMap;

public class SupabaseEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final SupabaseService supabaseService = retrofit.create(SupabaseService.class);

  public SupabaseEndpoint() {}

  public SupabaseUser signup(String email, String password) {
    Credential credential = new Credential(email, password);
    return this.supabaseService.signup(credential).blockingGet();
  }

  public AuthenticatedResponse login(String email, String password) {
    Credential credential = new Credential(email, password);
    return this.supabaseService.login(credential).blockingGet();
  }

  public AuthenticatedResponse refreshToken(String refreshToken) {
    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("refreshToken", refreshToken);
    return this.supabaseService.refreshToken(mapper).blockingGet();
  }

  public void signOut(String accessToken) {
    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("token", accessToken);
    this.supabaseService.signOut(mapper).blockingAwait();
  }
}

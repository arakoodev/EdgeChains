package com.edgechain.lib.retrofit;

import com.edgechain.lib.supabase.request.Credential;
import com.edgechain.lib.supabase.response.AuthenticatedResponse;
import com.edgechain.lib.supabase.response.SupabaseUser;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

import java.util.HashMap;

public interface SupabaseService {

  @POST(value = "supabase/signup")
  Single<SupabaseUser> signup(@Body Credential credential);

  @POST(value = "supabase/login")
  Single<AuthenticatedResponse> login(@Body Credential credential);

  @POST(value = "supabase/refreshToken")
  Single<AuthenticatedResponse> refreshToken(@Body HashMap<String, String> mapper);

  @POST(value = "supabase/signout")
  Completable signOut(@Body HashMap<String, String> mapper);
}

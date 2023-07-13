package com.app.supabase.security;

import com.app.supabase.configuration.SupabaseEnv;
import io.jsonwebtoken.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.security.Key;

@Component
public class JwtHelper {

  @Autowired private SupabaseEnv supabaseEnv;

  // validate
  public boolean validate(String accessToken) {
    try {
      Key hmacKey =
          new SecretKeySpec(
              this.supabaseEnv.getJwtSecret().getBytes(), SignatureAlgorithm.HS256.getJcaName());
      Jwts.parser().setSigningKey(hmacKey).parseClaimsJws(accessToken);
      return true;
    } catch (MalformedJwtException e) {
      throw new JwtException("Token Malformed");
    } catch (UnsupportedJwtException e) {
      throw new JwtException("Token Unsupported");
    } catch (ExpiredJwtException e) {
      throw new JwtException("Token Expired");
    } catch (IllegalArgumentException e) {
      throw new JwtException("Token Empty");
    } catch (SignatureException e) {
      throw new JwtException("Token Signature Failed");
    }
  }
}

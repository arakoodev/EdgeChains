package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.domain.SupabaseEnv;
import io.jsonwebtoken.*;
import java.security.Key;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class JwtHelper {

  @Autowired private SupabaseEnv supabaseEnv;

  // validate
  public boolean validate(String accessToken) {
    try {
      Key hmacKey =
          new SecretKeySpec(
              this.supabaseEnv.getJwtSecret().getBytes(), SignatureAlgorithm.HS256.getJcaName());

      //            String encoded =
      // Base64.getEncoder().encodeToString(this.supabaseEnv.getJwtSecret().getBytes());
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

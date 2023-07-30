package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.supabase.entities.User;
import com.edgechain.lib.supabase.exceptions.FilterException;
import com.edgechain.lib.supabase.utils.AuthUtils;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class JwtFilter extends OncePerRequestFilter {

  @Autowired private JwtHelper jwtHelper;

  @Autowired private UserSecurityService userSecurityService;

  @Autowired
  private SecurityUUID securityUUID;

  @Autowired
  private Environment env;

  @Override
  protected void doFilterInternal(
          HttpServletRequest request, HttpServletResponse response, FilterChain filter)
          throws ServletException, IOException {

      boolean test = env.acceptsProfiles(Profiles.of("test"));
      
      if (request.getRequestURI().startsWith(WebConfiguration.CONTEXT_PATH) && !test) {

        String authHeader = request.getHeader("Authorization");
        if (!authHeader.equals(securityUUID.getAuthKey()))
          throw new FilterException("Access Denied");
      }

      String token = AuthUtils.extractToken(request);
      if (token != null) {
        /** If you are using Supabase, then uncomment this line; * */
        //      User user = userSecurityService.loadUserByUsername(token);

        /**
         * Because, EdgeChains is a project independent of supabase; therefore, your jwt must
         * contain these two fields: a) email: "", b) role: "authenticated, user_create"
         */
        Jws<Claims> claimsJws = jwtHelper.parseToken(token);
        String email = (String) claimsJws.getBody().get("email");
        String role = (String) claimsJws.getBody().get("role");

        User user = new User();
        user.setEmail(email);
        user.setAccessToken(token);
        user.setRole(role);

        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authToken);
      }

      filter.doFilter(request, response);

  }
}

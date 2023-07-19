package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.supabase.entities.User;
import com.edgechain.lib.supabase.exceptions.FilterException;
import com.edgechain.lib.supabase.utils.AuthUtils;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class JwtFilter implements Filter {

  @Autowired private JwtHelper jwtHelper;

  @Autowired private UserSecurityService userSecurityService;

  @Override
  public void init(FilterConfig filterConfig) {}

  @Autowired private SecurityUUID securityUUID;

  @Override
  public void doFilter(
      ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filter)
      throws IOException, ServletException {

    HttpServletRequest request = (HttpServletRequest) servletRequest;

    if (request.getRequestURI().startsWith("/v2")) {
      String authHeader = request.getHeader("Authorization");
      if (Objects.isNull(authHeader) || !authHeader.equals(securityUUID.getAuthKey()))
        throw new FilterException("Access Denied");
    }

    HttpServletResponse response = (HttpServletResponse) servletResponse;

    String token = AuthUtils.extractToken(request);
    if (token != null && this.jwtHelper.validate(token)) {
      /* The other possible way is to decode access token & mapped that info to User*/
      /**
       * Here, we are getting user from Supabase API, so if user is disabled (even you can check for
       * disabled as well by requesting DB) or token is revoked then instantly the user won't be
       * able to access internal APIs unlike with prior approach, the user will be able to access
       * APIs until the token isn't expired..
       */
      User user = userSecurityService.loadUserByUsername(token);
      UsernamePasswordAuthenticationToken authToken =
          new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
      SecurityContextHolder.getContext().setAuthentication(authToken);
    }

    filter.doFilter(request, response);
  }

  @Override
  public void destroy() {}
}

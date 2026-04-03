package com.homeconnect.core.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

// JWT Authentication Filter - Kiểm tra JWT token trong mỗi request
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        try {
            String jwt = getJwtFromRequest(request);

            if (jwt != null && jwtUtil.validateToken(jwt)) {
                String email = jwtUtil.getEmailFromToken(jwt);
                Long userId = null;
                try {
                    userId = jwtUtil.extractUserId(jwt);
                } catch (Exception ignored) {
                    // Token cũ có thể chưa có userId claim.
                }

                String role = null;
                try {
                    role = jwtUtil.extractRole(jwt);
                } catch (Exception ignored) {
                    // Token cũ có thể chưa có role claim.
                }

                UserDetails userDetails;
                if (role != null && !role.isBlank()) {
                    userDetails = org.springframework.security.core.userdetails.User.builder()
                            .username(email)
                            .password("")
                            .authorities("ROLE_" + role)
                            .build();
                } else {
                    // Fallback tương thích cho token cũ.
                    userDetails = userDetailsService.loadUserByUsername(email);
                }

                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities());

                Map<String, Object> authDetails = new HashMap<>();
                authDetails.put("webDetails", new WebAuthenticationDetailsSource().buildDetails(request));
                if (userId != null) {
                    authDetails.put("userId", userId);
                }
                authentication.setDetails(authDetails);
                SecurityContextHolder.getContext().setAuthentication(authentication);

                log.debug("JWT authentication successful for user: {}", email);
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Extract JWT từ Authorization header
     */
    private String getJwtFromRequest(HttpServletRequest request) {
        // 1. Kiểm tra trong Authorization header
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        // 2. Kiểm tra trong query parameter "token" (Dùng cho SSE EventSource)
        String tokenParam = request.getParameter("token");
        if (tokenParam != null && !tokenParam.isEmpty()) {
            return tokenParam;
        }

        return null;
    }
}
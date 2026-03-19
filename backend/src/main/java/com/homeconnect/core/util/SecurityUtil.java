package com.homeconnect.core.util;

import com.homeconnect.core.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Security utility methods cho authentication và authorization
 * SMART APPROACH: Extract userId directly from JWT claims
 */
@Component
public class SecurityUtil {

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Lấy User ID từ JWT token claims - CÁCH THÔNG MINH
     * Không phụ thuộc vào principal, parse trực tiếp từ JWT
     */
    public Long getCurrentUserId(Authentication authentication) {
        try {
            String token = getJwtFromCurrentRequest();
            if (token != null) {
                return jwtUtil.extractUserId(token);
            }
            throw new RuntimeException("Không tìm thấy JWT token");
        } catch (Exception e) {
            throw new RuntimeException("Không thể extract User ID từ token: " + e.getMessage());
        }
    }

    /**
     * Extract JWT token từ Authorization header
     */
    private String getJwtFromCurrentRequest() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpServletRequest request = attrs.getRequest();
            String bearerToken = request.getHeader("Authorization");

            if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
                return bearerToken.substring(7);
            }
        } catch (Exception e) {
            // Log error nếu cần
        }
        return null;
    }

    /**
     * Lấy username (email) từ Authentication
     */
    public static String getCurrentUsername(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return null;
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        } else if (principal instanceof String) {
            return (String) principal;
        }

        return principal.toString();
    }
}
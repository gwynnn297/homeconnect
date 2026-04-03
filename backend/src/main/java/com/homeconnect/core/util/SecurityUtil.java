package com.homeconnect.core.util;

import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

/**
 * Security utility methods cho authentication và authorization
 * SMART APPROACH: Extract userId directly from JWT claims
 */
@Component
@RequiredArgsConstructor
public class SecurityUtil {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    /**
     * Lấy User ID từ JWT token claims - CÁCH THÔNG MINH
     * Không phụ thuộc vào principal, parse trực tiếp từ JWT
     */
    public Long getCurrentUserId(Authentication authentication) {
        Long userIdFromDetails = extractUserIdFromAuthDetails(authentication);
        if (userIdFromDetails != null) {
            return userIdFromDetails;
        }

        String token = getJwtFromCurrentRequest();
        if (token != null) {
            try {
                return jwtUtil.extractUserId(token);
            } catch (Exception ignore) {
                // Fallback: token cũ có thể chỉ chứa subject/email mà không có claim userId.
            }

            String email = jwtUtil.getEmailFromToken(token);
            return findUserIdByEmail(email, "token");
        }

        String username = getCurrentUsername(authentication);
        if (username != null && !"anonymousUser".equalsIgnoreCase(username)) {
            return findUserIdByEmail(username, "phiên đăng nhập");
        }

        throw new ApiException("Không tìm thấy JWT token", HttpStatus.UNAUTHORIZED);
    }

    private Long findUserIdByEmail(String email, String source) {
        return userRepository.findByEmail(email)
                .map(user -> user.getId().longValue())
                .orElseThrow(() -> new ApiException("Không tìm thấy người dùng từ " + source, HttpStatus.UNAUTHORIZED));
    }

    private Long extractUserIdFromAuthDetails(Authentication authentication) {
        if (authentication == null || authentication.getDetails() == null) {
            return null;
        }

        Object details = authentication.getDetails();
        if (details instanceof Map<?, ?> detailsMap) {
            Object userIdObj = detailsMap.get("userId");
            if (userIdObj instanceof Integer intValue) {
                return intValue.longValue();
            }
            if (userIdObj instanceof Long longValue) {
                return longValue;
            }
            if (userIdObj instanceof String stringValue && !stringValue.isBlank()) {
                try {
                    return Long.parseLong(stringValue);
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
        }

        return null;
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

            // Hỗ trợ SSE/EventSource gửi token qua query param
            String tokenParam = request.getParameter("token");
            if (tokenParam != null && !tokenParam.isBlank()) {
                return tokenParam;
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
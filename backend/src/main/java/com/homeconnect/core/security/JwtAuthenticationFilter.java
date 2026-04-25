package com.homeconnect.core.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeconnect.core.dto.response.ErrorResponse;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.repository.UserRepository;
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
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

// JWT Authentication Filter - Kiểm tra JWT token trong mỗi request
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;

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

                // Luôn tải user từ DB để áp dụng trạng thái tài khoản hiện tại (không tin claim trong token).
                User user = userRepository.findByEmail(email).orElse(null);
                if (user == null) {
                    log.warn("Không tìm thấy user trong DB: {}", email);
                    filterChain.doFilter(request, response);
                    return;
                }

                UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                if (!userDetails.isEnabled()) {
                    log.warn("Từ chối truy cập: tài khoản bị khóa hoặc vô hiệu: {}", email);
                    writeAccountBlockedResponse(request, response);
                    return;
                }
                if (user.getStatus() == UserStatus.WITHDRAW_ONLY && !isWithdrawOnlyAllowed(request)) {
                    log.warn("Từ chối truy cập: user {} ở trạng thái WITHDRAW_ONLY, path={}", email,
                            request.getRequestURI());
                    writeWithdrawOnlyRestrictedResponse(request, response);
                    return;
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

    private void writeAccountBlockedResponse(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        ErrorResponse body = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpServletResponse.SC_FORBIDDEN)
                .error("Forbidden")
                .message("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ nếu cần trợ giúp.")
                .path(request.getRequestURI())
                .code("ACCOUNT_BLOCKED")
                .build();
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private void writeWithdrawOnlyRestrictedResponse(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        ErrorResponse body = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpServletResponse.SC_FORBIDDEN)
                .error("Forbidden")
                .message("Tài khoản của bạn đang ở chế độ chỉ rút tiền. Các chức năng khác đã bị tạm khóa.")
                .path(request.getRequestURI())
                .code("ACCOUNT_WITHDRAW_ONLY")
                .build();
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private boolean isWithdrawOnlyAllowed(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String method = request.getMethod();

        // Dòng nghiệp vụ WITHDRAW_ONLY: chỉ được thao tác rút tiền và tài khoản nhận tiền.
        if ("POST".equalsIgnoreCase(method) && "/api/v1/wallets/withdraw".equals(uri)) {
            return true;
        }
        if ("GET".equalsIgnoreCase(method)
                && ("/api/v1/wallets/withdrawals".equals(uri) || uri.startsWith("/api/v1/wallets/withdrawals/"))) {
            return true;
        }
        if (uri.startsWith("/api/v1/wallets/bank-accounts")) {
            return true;
        }

        return false;
    }
}
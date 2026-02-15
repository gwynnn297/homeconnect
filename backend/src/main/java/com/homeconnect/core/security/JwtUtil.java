package com.homeconnect.core.security;

<<<<<<< Updated upstream
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
=======
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
>>>>>>> Stashed changes
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
<<<<<<< Updated upstream
import java.util.Date;
import java.util.Map;

// Tiện ích JWT cho tạo, validation và parse JWT tokens
@Component
@Slf4j
public class JwtUtil {

    // Secret key từ application.properties
    @Value("${app.jwt.secret:homeconnect-secret-key-super-secure-2026-capstone-project}")
    private String jwtSecret;

    // Thời gian hết hạn token (24 giờ)
    @Value("${app.jwt.expiration:86400000}")
    private long jwtExpirationMs;

    // Refresh token expiration (7 days)
    @Value("${app.jwt.refresh-expiration:604800000}")
    private long refreshExpirationMs;

    // Tạo JWT token từ email
    public String generateToken(String email) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .subject(email)
                .issuedAt(now)
                .expiration(expiryDate)
=======
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String username, Map<String, Object> extraClaims) {
        return Jwts.builder()
                .claims(extraClaims)
                .subject(username)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expiration))
>>>>>>> Stashed changes
                .signWith(getSigningKey())
                .compact();
    }

<<<<<<< Updated upstream
    // Tạo JWT token từ email với claims
    public String generateToken(String email, Map<String, Object> claims) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        JwtBuilder builder = Jwts.builder()
                .subject(email)
                .issuedAt(now)
                .expiration(expiryDate);

        // Thêm claims vào token
        if (claims != null) {
            claims.forEach(builder::claim);
        }

        return builder.signWith(getSigningKey())
                .compact();
    }

    // Tạo refresh token
    public String generateRefreshToken(String email) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + refreshExpirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("type", "refresh")
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    // Lấy email từ JWT token
    public String getEmailFromToken(String token) {
        Claims claims = Jwts.parser()
=======
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
>>>>>>> Stashed changes
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
<<<<<<< Updated upstream

        return claims.getSubject();
    }

    // Validate JWT token
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (SecurityException e) {
            log.error("Invalid JWT signature: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.error("Invalid JWT token: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            log.error("JWT token is expired: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.error("JWT token is unsupported: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.error("JWT claims string is empty: {}", e.getMessage());
        }
        return false;
    }

    // Kiểm tra token có hết hạn không
    public boolean isTokenExpired(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return true;
        }
    }

    // Lấy signing key từ secret
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes();
        return Keys.hmacShaKeyFor(keyBytes);
=======
    }

    public boolean isTokenValid(String token, String username) {
        final String extractedUsername = extractUsername(token);
        return (extractedUsername.equals(username) && !isTokenExpired(token));
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
>>>>>>> Stashed changes
    }
}

package com.homeconnect.core.security;

<<<<<<< Updated upstream
import lombok.RequiredArgsConstructor;
=======
>>>>>>> Stashed changes
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
<<<<<<< Updated upstream
=======
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
>>>>>>> Stashed changes
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
<<<<<<< Updated upstream
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

// Cấu hình Spring Security với JWT + CORS
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
=======

@Configuration
@EnableWebSecurity
>>>>>>> Stashed changes
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

<<<<<<< Updated upstream
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Các endpoint auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        // Các endpoint test
                        .requestMatchers("/api/v1/test/**").permitAll()
                        // Tài liệu Swagger
                        .requestMatchers(
                                "/api/docs/**",
                                "/swagger-ui/**", "/swagger-ui.html",
                                "/v3/api-docs", "/v3/api-docs/**",
                                "/api/swagger-ui/**", "/api/swagger-ui.html",
                                "/api/v3/api-docs", "/api/v3/api-docs/**"
                        ).permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-resources/**", "/webjars/**").permitAll()
                        // Health check
                        .requestMatchers("/actuator/**").permitAll()
                        // Tất cả endpoints khác cần xác thực
                        .anyRequest().authenticated())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
=======
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()
                // Swagger/OpenAPI (with/without context-path=/api depending on runtime)
                .requestMatchers(
                        "/swagger-ui/**", "/swagger-ui.html",
                        "/v3/api-docs", "/v3/api-docs/**",
                        "/api/swagger-ui/**", "/api/swagger-ui.html",
                        "/api/v3/api-docs", "/api/v3/api-docs/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
>>>>>>> Stashed changes

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
<<<<<<< Updated upstream
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    // Cấu hình CORS
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Các origin được phép
        configuration.setAllowedOriginPatterns(Arrays.asList(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://*.netlify.app",
                "https://*.vercel.app",
                "https://homeconnect.com"
        ));
        
        // Các HTTP methods được phép
        configuration.setAllowedMethods(Arrays.asList(
                "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
        ));
        
        // Các headers được phép
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type", 
                "Accept",
                "Origin",
                "X-Requested-With"
        ));
        
        // Các headers được expose
        configuration.setExposedHeaders(Arrays.asList(
                "Authorization"
        ));
        
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        
        return source;
=======
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
>>>>>>> Stashed changes
    }
}

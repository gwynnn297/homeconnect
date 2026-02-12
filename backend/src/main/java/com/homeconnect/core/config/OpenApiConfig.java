package com.homeconnect.core.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

//   Swagger/OpenAPI Configuration
@Configuration
public class OpenApiConfig {

        @Value("${server.port:8080}")
        private String serverPort;

        @Bean
        public OpenAPI customOpenAPI() {
                return new OpenAPI()
                                .info(new Info()
                                                .title(" HomeConnect API")
                                                .version("1.0.0")
                                                .description("""
                                                                ## HomeConnect Core API Documentation

                                                                **Enterprise-grade Home Services Platform**
                                                                *Capstone Project 2 - Spring 2026*

                                                                ###  Features:
                                                                - **User Management**: Registration with OTP verification
                                                                - **JWT Authentication**: Secure token-based authentication
                                                                - **Email Service**: Professional HTML email templates
                                                                - **Helper Profiles**: KYC verification system
                                                                - **Wallet System**: Digital payment management

                                                                ###  Authentication:
                                                                Use the **Authorize** button to add your JWT token.
                                                                Format: `Bearer your-jwt-token-here`
                                                                """)
                                                .contact(new Contact()
                                                                .name("HomeConnect Dev Team")
                                                                .email("dev@homeconnect.com")
                                                                .url("https://github.com/your-repo/homeconnect"))
                                                .license(new License()
                                                                .name("MIT License")
                                                                .url("https://opensource.org/licenses/MIT")))
                                .servers(List.of(
                                                new Server()
                                                                .url("http://localhost:" + serverPort)
                                                                .description("Local Development Server"),
                                                new Server()
                                                                .url("https://api.homeconnect.com")
                                                                .description("Production Server")))
                                .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
                                .components(new io.swagger.v3.oas.models.Components()
                                                .addSecuritySchemes("Bearer Authentication",
                                                                new SecurityScheme()
                                                                                .type(SecurityScheme.Type.HTTP)
                                                                                .scheme("bearer")
                                                                                .bearerFormat("JWT")
                                                                                .description("JWT token để authenticate API calls. "
                                                                                                +
                                                                                                "Lấy token từ /auth/login và thêm vào header: Authorization: Bearer {token}")));
        }
}
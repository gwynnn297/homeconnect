package com.homeconnect.core.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        RestTemplate restTemplate = builder
                .connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(10))
                .defaultHeader("User-Agent", "HomeConnect/1.0 (contact@homeconnect.com)")
                .build();

        // Đảm bảo StringHttpMessageConverter sử dụng UTF-8 làm mặc định
        restTemplate.getMessageConverters().stream()
                .filter(org.springframework.http.converter.StringHttpMessageConverter.class::isInstance)
                .map(org.springframework.http.converter.StringHttpMessageConverter.class::cast)
                .forEach(converter -> converter.setDefaultCharset(java.nio.charset.StandardCharsets.UTF_8));
                
        return restTemplate;
    }
}

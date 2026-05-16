package com.homeconnect.core.config;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Single source of truth for Gmail SMTP credentials.
 * Reads GMAIL_USERNAME + GMAIL_APP_PASSWORD from environment / .env.
 * Do not use spring.mail.username / spring.mail.password in .env — they are not read here.
 */
@Component
public class SmtpMailProperties {

    private static final String HOST = "smtp.gmail.com";
    private static final int PORT = 587;

    private final String username;
    private final String password;

    public SmtpMailProperties(Environment environment) {
        this.username = resolveUsername(environment);
        this.password = normalizePassword(resolvePassword(environment));
    }

    private static String resolveUsername(Environment environment) {
        String gmail = environment.getProperty("GMAIL_USERNAME");
        if (StringUtils.hasText(gmail)) {
            return gmail.trim();
        }
        String email = environment.getProperty("EMAIL_USERNAME");
        if (StringUtils.hasText(email)) {
            return email.trim();
        }
        return "";
    }

    private static String resolvePassword(Environment environment) {
        String gmail = environment.getProperty("GMAIL_APP_PASSWORD");
        if (StringUtils.hasText(gmail)) {
            return gmail;
        }
        return environment.getProperty("EMAIL_PASSWORD", "");
    }

    private static String normalizePassword(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replaceAll("\\s+", "");
    }

    public String getHost() {
        return HOST;
    }

    public int getPort() {
        return PORT;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(username) && StringUtils.hasText(password);
    }
}

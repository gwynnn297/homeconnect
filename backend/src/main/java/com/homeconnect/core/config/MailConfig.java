package com.homeconnect.core.config;

import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * SMTP Gmail — credentials from {@link SmtpMailProperties} (GMAIL_* env vars).
 */
@Configuration
public class MailConfig {

    private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

    @Bean
    public JavaMailSender javaMailSender(SmtpMailProperties mailProperties) {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();

        mailSender.setHost(mailProperties.getHost());
        mailSender.setPort(mailProperties.getPort());
        mailSender.setUsername(mailProperties.getUsername());
        mailSender.setPassword(mailProperties.getPassword());

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.starttls.required", "true");
        props.put("mail.smtp.ssl.enable", "false");
        props.put("mail.smtp.ssl.trust", mailProperties.getHost());
        props.put("mail.smtp.ssl.checkserveridentity", "false");
        props.put("mail.smtp.connectiontimeout", "15000");
        props.put("mail.smtp.timeout", "15000");
        props.put("mail.smtp.writetimeout", "15000");
        props.put("mail.debug", "false");

        if (mailProperties.isConfigured()) {
            log.info("SMTP mail configured for sender: {}", mailProperties.getUsername());
        } else {
            log.warn(
                    "SMTP mail NOT configured. Set GMAIL_USERNAME and GMAIL_APP_PASSWORD "
                            + "(local: backend/.env, Docker: homeconnect/.env). OTP emails will fail.");
        }

        return mailSender;
    }
}

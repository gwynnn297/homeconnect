package com.homeconnect.core.service;

import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import com.homeconnect.core.config.SmtpMailProperties;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final SmtpMailProperties mailProperties;

    private boolean mailConfigWarningLogged;

    public boolean sendOtp(String toEmail, String otpCode, String fullName) {
        return sendHtmlEmail(
                toEmail,
                "Mã xác thực HomeConnect - " + otpCode,
                buildOtpEmailTemplate(otpCode, fullName));
    }

    public boolean sendSimpleMessage(String toEmail, String subject, String content) {
        if (!mailProperties.isConfigured()) {
            logMailNotConfiguredOnce();
            return false;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(mailProperties.getUsername(), "HomeConnect Team");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(content, false);

            mailSender.send(message);
            log.info("Đã gửi email thành công đến: {} với subject: {}", toEmail, subject);
            return true;

        } catch (MessagingException e) {
            log.error("Lỗi gửi email đến {}: {}", toEmail, e.getMessage(), e);
            return false;
        } catch (Exception e) {
            log.error("Lỗi không xác định khi gửi email đến {}: {}", toEmail, e.getMessage(), e);
            return false;
        }
    }

    private boolean sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        if (!mailProperties.isConfigured()) {
            logMailNotConfiguredOnce();
            return false;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(mailProperties.getUsername(), "HomeConnect Team");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Đã gửi email OTP thành công đến: {}", toEmail);
            return true;

        } catch (MessagingException e) {
            log.error("Lỗi SMTP gửi OTP đến {} — {}: {}", toEmail, e.getClass().getSimpleName(), e.getMessage());
            if (e.getCause() != null) {
                log.error("  cause: {}", e.getCause().getMessage());
            }
            return false;
        } catch (Exception e) {
            log.error("Lỗi không xác định khi gửi OTP đến {}: {}", toEmail, e.getMessage(), e);
            return false;
        }
    }

    private void logMailNotConfiguredOnce() {
        if (mailConfigWarningLogged) {
            return;
        }
        mailConfigWarningLogged = true;
        log.error(
                "Chưa cấu hình SMTP: đặt GMAIL_USERNAME và GMAIL_APP_PASSWORD trong .env "
                        + "(Docker: homeconnect/.env, local: backend/.env).");
    }

    private String buildOtpEmailTemplate(String otpCode, String fullName) {
        String userName = fullName != null ? fullName : "Bạn";

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Xác thực HomeConnect</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">HomeConnect</h1>
                            <p style="color: #e8f2ff; margin: 5px 0 0 0; font-size: 16px;">Nền tảng dịch vụ gia đình hàng đầu</p>
                        </div>
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Xin chào """
                + userName
                + """
                        !</h2>
                            <p style="color: #666; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
                                Cảm ơn bạn đã đăng ký tài khoản HomeConnect. Mã xác thực (hiệu lực 5 phút):
                            </p>
                            <div style="text-align: center; margin: 40px 0;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                            color: white; font-size: 36px; font-weight: bold; letter-spacing: 8px;
                                            padding: 20px 40px; border-radius: 10px; display: inline-block;">
                                    """
                + otpCode
                + """
                                </div>
                            </div>
                            <p style="color: #999; margin: 0; font-size: 14px; text-align: center;">
                                Không chia sẻ mã này với bất kỳ ai.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
                """;
    }
}

package com.homeconnect.core.service.impl;

import com.homeconnect.core.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Override
    public void sendOtp(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("[HomeConnect] Mã xác thực OTP của bạn");

            String htmlContent = buildOtpHtmlTemplate(otp);
            helper.setText(htmlContent, true); // true = HTML

            mailSender.send(message);
            log.info("OTP email sent to {}", toEmail);
        } catch (MessagingException | MailException e) {
            log.error("Failed to send OTP email to {}: {}", toEmail, e.getMessage(), e);
            // Không ném exception checked để tránh làm crash luồng chính, có thể wrap thành RuntimeException nếu muốn fail cứng
        }
    }

    private String buildOtpHtmlTemplate(String otp) {
        // Template đơn giản, bạn có thể thay bằng file Thymeleaf/Freemarker nếu muốn
        return """
                <html>
                  <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                    <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                      <div style="text-align: center; margin-bottom: 16px;">
                        <h2 style="margin: 0; color: #1f2933;">HomeConnect</h2>
                        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Xác thực tài khoản của bạn</p>
                      </div>
                      <p style="font-size: 14px; color: #111827;">
                        Xin chào,<br/>
                        Đây là mã OTP để xác thực thao tác của bạn trên hệ thống HomeConnect:
                      </p>
                      <div style="text-align: center; margin: 20px 0;">
                        <span style="display: inline-block; font-size: 24px; letter-spacing: 8px; font-weight: bold; color: #111827; padding: 12px 24px; border-radius: 999px; background: #e5f0ff;">
                          %s
                        </span>
                      </div>
                      <p style="font-size: 13px; color: #6b7280;">
                        Mã OTP này có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.
                      </p>
                      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
                        Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
                      </p>
                    </div>
                  </body>
                </html>
                """.formatted(otp);
    }
}



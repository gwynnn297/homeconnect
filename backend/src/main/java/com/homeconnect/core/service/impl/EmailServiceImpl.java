package com.homeconnect.core.service.impl;

import com.homeconnect.core.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Override
    public boolean sendOtp(String toEmail, String otpCode, String fullName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, "HomeConnect Team");
            helper.setTo(toEmail);
            helper.setSubject("Mã xác thực HomeConnect - " + otpCode);

            String htmlContent = buildOtpEmailTemplate(otpCode, fullName);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Đã gửi OTP {} thành công đến: {}", otpCode, toEmail);
            return true;

        } catch (MessagingException e) {
            log.error("Lỗi gửi email OTP đến {}: {}", toEmail, e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("Lỗi không xác định khi gửi email: {}", e.getMessage());
            return false;
        }
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
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">🏠 HomeConnect</h1>
                            <p style="color: #e8f2ff; margin: 5px 0 0 0; font-size: 16px;">Nền tảng dịch vụ gia đình hàng đầu</p>
                        </div>
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Xin chào %s! 👋</h2>
                            <p style="color: #666; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
                                Cảm ơn bạn đã đăng ký tài khoản HomeConnect. Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác thực bên dưới:
                            </p>
                            <div style="text-align: center; margin: 40px 0;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                    %s
                                </div>
                            </div>
                            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                                <p style="margin: 0; color: #666; font-size: 14px;">
                                    <strong>⚠️ Lưu ý quan trọng:</strong><br>
                                    • Mã này chỉ có hiệu lực trong 5 phút<br>
                                    • Không chia sẻ mã này với bất kỳ ai<br>
                                    • Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email
                                </p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                """.formatted(userName, otpCode);
    }
}

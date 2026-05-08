package com.homeconnect.core.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

// Dịch vụ email cho gửi OTP
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    // Gửi OTP qua email
    // @param otpCode Mã OTP (6 chữ số)
    // @param fullName Tên đầy đủ người nhận
    // @return true nếu gửi thành công, false nếu lỗi
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
            log.error("Lỗi gửi email OTP đến {}", toEmail, e);
            return false;
        } catch (Exception e) {
            log.error("Lỗi không xác định khi gửi email OTP", e);
            return false;
        }
    }

    // Gửi email đơn giản với subject và content
    // @param toEmail Email người nhận
    // @param subject Tiêu đề email
    // @param content Nội dung email (có thể là HTML hoặc text)
    // @return true nếu gửi thành công, false nếu lỗi
    public boolean sendSimpleMessage(String toEmail, String subject, String content) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, "HomeConnect Team");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(content, false); // false = plain text, true = HTML

            mailSender.send(message);
            log.info("Đã gửi email thành công đến: {} với subject: {}", toEmail, subject);
            return true;

        } catch (MessagingException e) {
            log.error("Lỗi gửi email đến {}", toEmail, e);
            return false;
        } catch (Exception e) {
            log.error("Lỗi không xác định khi gửi email", e);
            return false;
        }
    }

    // Tạo template HTML cho email OTP
    private String buildOtpEmailTemplate(String otpCode, String fullName) {
        String userName = fullName != null ? fullName : "Bạn";

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Xác thức HomeConnect</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">🏠 HomeConnect</h1>
                            <p style="color: #e8f2ff; margin: 5px 0 0 0; font-size: 16px;">Nền tảng dịch vụ gia đình hàng đầu</p>
                        </div>

                        <!-- Content -->
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Xin chào """
                + userName
                + """
                        ! 👋</h2>

                                                <p style="color: #666; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
                                                    Cảm ơn bạn đã đăng ký tài khoản HomeConnect. Để hoàn tất quá trình đăng ký,
                                                    vui lòng sử dụng mã xác thực bên dưới:
                                                </p>

                                                <!-- OTP Code -->
                                                <div style="text-align: center; margin: 40px 0;">
                                                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                                                color: white;
                                                                font-size: 36px;
                                                                font-weight: bold;
                                                                letter-spacing: 8px;
                                                                padding: 20px 40px;
                                                                border-radius: 10px;
                                                                display: inline-block;
                                                                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                                        """
                + otpCode
                + """
                                        </div>
                                    </div>

                                    <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                                        <p style="margin: 0; color: #666; font-size: 14px;">
                                            <strong>Lưu ý quan trọng:</strong><br>
                                            • Mã này chỉ có hiệu lực trong <strong>5 phút</strong><br>
                                            • Không chia sẻ mã này với bất kỳ ai<br>
                                            • Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email
                                        </p>
                                    </div>

                                    <p style="color: #666; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
                                        Sau khi xác thực thành công, bạn sẽ có thể:
                                    </p>

                                    <ul style="color: #666; padding-left: 20px;">
                                        <li style="margin-bottom: 8px;"> Đặt dịch vụ gia đình chất lượng cao</li>
                                        <li style="margin-bottom: 8px;"> Tìm thợ uy tín trong khu vực</li>
                                        <li style="margin-bottom: 8px;"> Quản lý ví tiền và thanh toán an toàn</li>
                                        <li style="margin-bottom: 8px;"> Đánh giá và nhận phản hồi từ cộng đồng</li>
                                    </ul>
                                </div>

                                <!-- Footer -->
                                <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
                                    <p style="color: #999; margin: 0; font-size: 14px;">
                                        Đây là email tự động, vui lòng không trả lời.<br>
                                        © 2026 HomeConnect. Mọi quyền được bảo lưu.
                                    </p>

                                    <div style="margin-top: 20px;">
                                        <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Chính sách bảo mật</a>
                                        <span style="color: #ddd;">|</span>
                                        <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Điều khoản sử dụng</a>
                                        <span style="color: #ddd;">|</span>
                                        <a href="#" style="color: #667eea; text-decoration: none; margin: 0 10px; font-size: 12px;">Liên hệ hỗ trợ</a>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                        """;
    }
}

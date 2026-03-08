package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.GenerateQRRequest;
import com.homeconnect.core.dto.request.WebhookDepositRequest;
import com.homeconnect.core.dto.response.VietQRResponse;
import com.homeconnect.core.dto.response.WalletInfoResponse;
import com.homeconnect.core.dto.response.WalletTransactionListResponse;
import com.homeconnect.core.security.JwtUtil;
import com.homeconnect.core.service.WalletService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * WalletController - APIs quản lý ví điện tử
 * Bao gồm: Xem thông tin ví, Lịch sử giao dịch, Nạp tiền qua VietQR, Webhook
 */
@RestController
@RequestMapping("/api/v1/wallets")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Wallet Management", description = "API quản lý ví điện tử - Nạp tiền, Lịch sử giao dịch")
public class WalletController {

    private final WalletService walletService;
    private final JwtUtil jwtUtil;

    /**
     * [BE-Wallet-02] GET /api/v1/wallets/me
     * Lấy thông tin ví của user đang đăng nhập
     */
    @GetMapping("/me")
    @Operation(summary = "Lấy thông tin ví của tôi", description = "Xem số dư khả dụng, số tiền đang giữ, và trạng thái ví", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<WalletInfoResponse> getMyWallet(HttpServletRequest request) {
        Long userId = getUserIdFromToken(request);
        log.info("📊 User ID: {} đang xem thông tin ví", userId);

        WalletInfoResponse response = walletService.getWalletInfo(userId);
        return ResponseEntity.ok(response);
    }

    /**
     * [BE-Wallet-03] GET /api/v1/wallets/transactions
     * Lấy lịch sử giao dịch ví (có phân trang)
     */
    @GetMapping("/transactions")
    @Operation(summary = "Lấy lịch sử giao dịch ví", description = "Xem lịch sử nạp tiền, giữ tiền, thanh toán (có phân trang)", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<WalletTransactionListResponse> getTransactionHistory(
            HttpServletRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = getUserIdFromToken(request);
        log.info("📜 User ID: {} đang xem lịch sử giao dịch - Page: {}, Size: {}", userId, page, size);

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        WalletTransactionListResponse response = walletService.getTransactionHistory(userId, pageable);

        return ResponseEntity.ok(response);
    }

    /**
     * [BE-Wallet-04] POST /api/v1/wallets/generate-qr
     * Sinh mã VietQR để nạp tiền
     */
    @PostMapping("/generate-qr")
    @Operation(summary = "Sinh mã VietQR để nạp tiền", description = "Tạo URL ảnh QR code VietQR với nội dung chuyển khoản định dạng HOMIE{userId}", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<VietQRResponse> generateQRCode(
            HttpServletRequest request,
            @Valid @RequestBody GenerateQRRequest qrRequest) {
        Long userId = getUserIdFromToken(request);
        log.info("🔗 User ID: {} yêu cầu sinh QR Code với số tiền: {}", userId, qrRequest.getAmount());

        VietQRResponse response = walletService.generateVietQRUrl(userId, qrRequest.getAmount());
        return ResponseEntity.ok(response);
    }

    /**
     * [BE-Wallet-05] POST /api/v1/wallets/webhook
     * Webhook endpoint để nhận thông báo từ Payment Gateway (PayOS/Casso)
     * 
     * KHÔNG CẦN AUTHENTICATION - Đây là endpoint public cho webhook
     */
    @PostMapping("/webhook")
    @Operation(summary = "Webhook nạp tiền từ Payment Gateway", description = "Endpoint nhận thông báo từ PayOS/Casso khi có giao dịch nạp tiền thành công. "
            +
            "Tự động cộng tiền vào ví user dựa trên nội dung chuyển khoản.")
    public ResponseEntity<String> handleDepositWebhook(@RequestBody WebhookDepositRequest request) {
        log.info("💰 Nhận webhook deposit - TransactionID: {}, Amount: {}",
                request.getTransactionId(), request.getAmount());

        try {
            walletService.processWebhookDeposit(request);
            return ResponseEntity.ok("OK");
        } catch (Exception e) {
            log.error("❌ Lỗi xử lý webhook: {}", e.getMessage(), e);
            // Vẫn trả về 200 OK để webhook provider không retry
            return ResponseEntity.ok("ERROR");
        }
    }

    // ===== Helper Methods =====

    /**
     * Lấy userId từ JWT token trong request header
     */
    private Long getUserIdFromToken(HttpServletRequest request) {
        String token = extractTokenFromRequest(request);
        return jwtUtil.extractUserId(token);
    }

    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        throw new RuntimeException("Token không tồn tại trong request");
    }
}

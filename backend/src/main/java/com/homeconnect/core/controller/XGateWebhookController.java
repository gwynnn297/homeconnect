package com.homeconnect.core.controller;

import com.homeconnect.core.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.math.BigDecimal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
@Slf4j
public class XGateWebhookController {

    private final WalletService walletService;

    @Value("${xgate.webhook.secret}")
    private String webhookSecret;

    @PostMapping("/xgate")
    public ResponseEntity<String> handleXGateWebhook(
            @RequestHeader(value = "X-XGate-Signature", required = false) String signature,
            @RequestBody Map<String, Object> payload) {
        
        log.info("Nhận Webhook biến động số dư: {}", payload);

        // 1. Parse payload từ xGate/PayOS/Casso (Giả định format chung)
        String description = (String) payload.get("description");
        if (description == null) description = (String) payload.get("content");

        Object amountRaw = payload.get("amount");
        if (amountRaw == null) amountRaw = payload.get("transferAmount");
        
        BigDecimal amount = BigDecimal.ZERO;
        if (amountRaw != null) {
            try {
                amount = new BigDecimal(amountRaw.toString());
            } catch (Exception e) {
                log.warn("Lỗi parse số tiền từ webhook: {}", amountRaw);
            }
        }

        // 2. Phân loại giao dịch theo nội dung chuyển khoản
        // HOMIRT = rút tiền (Helper withdraw), HOMIE = nạp tiền (Customer deposit)
        if (description != null && description.toUpperCase().contains("HOMIRT")) {
            // Luồng rút tiền - xGate chuyển tiền cho Helper
            walletService.processWithdrawWebhook(description, amount.abs());

        } else if (description != null && description.toUpperCase().contains("HOMIE")) {
            // Luồng nạp tiền - Customer chuyển tiền vào tài khoản Admin
            // Lấy transaction ID từ payload (id hoặc reference)
            Object idObj = payload.get("id");
            if (idObj == null) idObj = payload.get("reference");
            if (idObj == null) idObj = payload.get("transactionId");
            String transactionId = (idObj != null) ? String.valueOf(idObj) : ("XGATE_" + System.currentTimeMillis());

            walletService.processXGateDepositWebhook(description, amount.abs(), transactionId);

        } else {
            log.warn("Webhook không khớp định dạng HOMIE/HOMIRT. Description: {}", description);
        }

        return ResponseEntity.ok("OK");
    }

    @GetMapping("/xgate")
    public ResponseEntity<String> verifyWebhook() {
        log.info("XGate Webhook Verification (GET) - Success");
        return ResponseEntity.ok("Webhook is active");
    }
}

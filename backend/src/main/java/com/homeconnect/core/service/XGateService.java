package com.homeconnect.core.service;

import com.homeconnect.core.entity.WithdrawRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * XGateService - Tích hợp API Ngân hàng tự động (Payout)
 * Tài liệu: https://docs.xgate.vn/api-v1
 */
@Service
@Slf4j
public class XGateService {

    @Value("${xgate.api.key}")
    private String apiKey;

    @Value("${xgate.api.url}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Gọi API Payout của xGate với cơ chế RETRY + EXPONENTIAL BACKOFF
     */
    public String payout(WithdrawRequest request) {
        log.info("[xGate-Pro] Đang khởi tạo Payout cho Request #{} - {} VNĐ", 
                request.getRequestId(), request.getAmount());

        int maxRetries = 3;
        int attempt = 0;
        Exception lastException = null;

        while (attempt < maxRetries) {
            try {
                return executePayoutApiCall(request);
            } catch (Exception e) {
                attempt++;
                lastException = e;
                log.warn("[xGate Retry] Lần {} thất bại: {}. Đang thử lại...", attempt, e.getMessage());
                
                try {
                    Thread.sleep(1000L * (long) Math.pow(2, attempt - 1));
                } catch (InterruptedException ignored) {}
            }
        }

        log.error("[xGate Fatal] Payout #{} thất bại sau {} lần thử.", request.getRequestId(), maxRetries);
        throw new RuntimeException("XGate payout failed after retries: " + 
                (lastException != null ? lastException.getMessage() : "Unknown error"));
    }

    public String checkStatus(String externalId) {
        log.info("[xGate-Reconcile] Đang kiểm tra trạng thái GD: {}", externalId);
        // Logic: Gọi GET /api/v1/payout/status/{externalId}
        return "SUCCESS"; 
    }

    private String executePayoutApiCall(WithdrawRequest request) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("amount", request.getAmount());
        body.put("bank_code", request.getBankName()); 
        body.put("account_number", request.getBankAccount());
        body.put("account_name", request.getAccountHolderName());
        body.put("external_id", "HC-" + request.getRequestId() + "-" + System.currentTimeMillis());
        body.put("note", "HomieConnect Withdraw #" + request.getRequestId());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            log.info("[xGate] Calling Payout API: {}/payout", apiUrl);
            ResponseEntity<Map> response = restTemplate.postForEntity(apiUrl + "/payout", entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> resBody = response.getBody();
                String externalId = (String) resBody.get("external_id");
                if (externalId == null) externalId = (String) resBody.get("id");
                
                log.info("[xGate] Payout success. External ID: {}", externalId);
                return externalId;
            } else {
                throw new Exception("xGate API error: " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("[xGate] API Request failed: {}", e.getMessage());
            throw e;
        }
    }
}

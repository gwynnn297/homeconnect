package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.ChatParseRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.ChatParseResponse;
import com.homeconnect.core.exception.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

@Slf4j
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
@Tag(name = "AI Chat", description = "Proxy API parse chat đặt lịch qua Python AI service")
public class AiController {

    private final RestTemplate restTemplate;

    @Value("${app.ai.parser-url:http://localhost:8000/api/v1/chat/parse}")
    private String aiParserUrl;

    @PostMapping("/parse")
    @Operation(summary = "Parse câu chat đặt lịch", description = "Forward tin nhắn sang Python AI parser và trả dữ liệu booking đã chuẩn hóa")
    public ResponseEntity<ApiResponse<ChatParseResponse>> parseChat(@Valid @RequestBody ChatParseRequest request) {
        try {
            if (!StringUtils.hasText(aiParserUrl)) {
                throw new ApiException("Chưa cấu hình URL cho AI parser", HttpStatus.INTERNAL_SERVER_ERROR);
            }
            final String parserUrl = aiParserUrl.trim();

            ChatParseResponse parsed = restTemplate.postForObject(parserUrl, request, ChatParseResponse.class);

            if (parsed == null) {
                throw new ApiException("Không nhận được phản hồi từ AI parser", HttpStatus.BAD_GATEWAY);
            }

            return ResponseEntity.ok(ApiResponse.<ChatParseResponse>builder()
                    .message("Parse câu chat thành công")
                    .data(parsed)
                    .build());
        } catch (ResourceAccessException ex) {
            log.error("AI parser timeout/unreachable at {}: {}", aiParserUrl, ex.getMessage());
            throw new ApiException("Không kết nối được AI parser. Vui lòng kiểm tra Python service đang chạy.",
                    HttpStatus.GATEWAY_TIMEOUT);
        } catch (HttpStatusCodeException ex) {
            log.error("AI parser returned error {}: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new ApiException("AI parser trả về lỗi: " + ex.getStatusCode().value(), HttpStatus.BAD_GATEWAY);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Unexpected AI parser error", ex);
            throw new ApiException("Có lỗi xảy ra khi parse tin nhắn bằng AI", HttpStatus.BAD_GATEWAY);
        }
    }
}

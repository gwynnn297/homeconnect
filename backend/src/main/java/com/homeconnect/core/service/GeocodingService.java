package com.homeconnect.core.service;

import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class GeocodingService {

    private final RestTemplate restTemplate;

    @org.springframework.beans.factory.annotation.Value("${app.goong.api-key}")
    private String apiKey;

    @org.springframework.beans.factory.annotation.Value("${app.goong.geocoding-url}")
    private String goongUrl;

    public GeocodingService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Data
    @Builder
    public static class GeoResult {
        private BigDecimal latitude;
        private BigDecimal longitude;
    }

    /**
     * Lấy tọa độ từ địa chỉ. Sử dụng chiến lược Fallback nếu không tìm thấy địa chỉ cụ thể.
     */
    @RateLimiter(name = "goong")
    public GeoResult geocode(String detail, String ward, String district, String province) {
        log.info("Geocoding via Goong attempt for: {}, {}, {}, {}, Vietnam", detail, ward, district, province);
        
        // 1. Cấp độ 1: Địa chỉ đầy đủ
        String addrFull = String.format("%s, %s, %s, %s, Vietnam", detail, ward != null ? ward : "", district, province)
                .replace(", ,", ",");
        GeoResult result = tryGeocode(addrFull);
        if (result != null) return result;

        log.warn("Goong Geocoding chi tiết thất bại. Bắt đầu đơn giản hóa...");

        // 2. Cấp độ 2: Bỏ tiền tố hành chính (Phường/Quận/...)
        result = tryGeocode(String.format("%s, %s, %s, %s, Vietnam", detail, cleanPrefix(ward), cleanPrefix(district), cleanPrefix(province)));
        if (result != null) return result;

        // 3. Cấp độ 3: Bỏ Phường
        result = tryGeocode(String.format("%s, %s, %s, Vietnam", detail, district, province));
        if (result != null) return result;

        // 4. Cấp độ 4: Chỉ Số nhà + Quận
        result = tryGeocode(String.format("%s, %s, Vietnam", detail, district));
        if (result != null) return result;

        // 5. Cấp độ 5: Chỉ tên đường (bỏ số nhà) trong Quận
        String streetOnly = detail.replaceAll("^\\d+[a-zA-Z]?\\s+", "").trim();
        if (!streetOnly.equals(detail)) {
            result = tryGeocode(String.format("%s, %s, Vietnam", streetOnly, district));
            if (result != null) return result;
        }

        // 6. Cấp độ 6: Fallback về trung tâm Phường
        if (ward != null && !ward.isBlank()) {
            result = tryGeocode(String.format("%s, %s, %s, Vietnam", cleanPrefix(ward), cleanPrefix(district), cleanPrefix(province)));
            if (result != null) return result;
        }

        // 7. Cấp độ 7: Fallback về trung tâm Quận
        result = tryGeocode(String.format("%s, %s, Vietnam", cleanPrefix(district), cleanPrefix(province)));
        if (result != null) return result;

        log.error("Tất cả các thử nghiệm Goong Geocoding đều thất bại cho: {}.", addrFull);
        throw new RuntimeException("Không thể định vị địa chỉ này: " + addrFull);
    }

    /**
     * Loại bỏ các tiền tố địa danh phổ biến của Việt Nam
     */
    private String cleanPrefix(String name) {
        if (name == null) return null;
        return name.replaceFirst("(?i)^(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn)\\s+", "").trim();
    }

    private GeoResult tryGeocode(String fullAddress) {
        try {
            String url = UriComponentsBuilder.fromUriString(goongUrl)
                    .queryParam("address", fullAddress)
                    .queryParam("api_key", apiKey)
                    .build()
                    .toUriString();

            return executeRequest(url);
        } catch (Exception e) {
            log.error("Goong Geocoding error for address {}: {}", fullAddress, e.getMessage());
        }
        return null;
    }

    private GeoResult executeRequest(String url) {
        org.springframework.http.ResponseEntity<Map> responseEntity = restTemplate.getForEntity(url, Map.class);
        Map<String, Object> response = responseEntity.getBody();

        if (response != null && "OK".equals(response.get("status"))) {
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results != null && !results.isEmpty()) {
                // Lấy kết quả đầu tiên (Best match)
                Map<String, Object> geometry = (Map<String, Object>) results.get(0).get("geometry");
                Map<String, Object> location = (Map<String, Object>) geometry.get("location");
                
                return GeoResult.builder()
                        .latitude(new BigDecimal(location.get("lat").toString()))
                        .longitude(new BigDecimal(location.get("lng").toString()))
                        .build();
            }
        }
        return null;
    }
}

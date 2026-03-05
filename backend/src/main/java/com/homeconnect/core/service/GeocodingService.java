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
    private static final String NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

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
    @RateLimiter(name = "nominatim")
    public GeoResult geocode(String detail, String ward, String district, String province) {
        log.info("Geocoding accuracy attempt for: {}, {}, {}, {}, Vietnam", detail, ward, district, province);
        
        // 1. Cấp độ 1: Structured Search (Chuẩn nhất)
        GeoResult result = tryGeocodeStructured(detail, ward, district, province);
        if (result != null) return result;

        // 2. Cấp độ 2: Structured Search sạch (bỏ Phường/Quận/Tỉnh)
        result = tryGeocodeStructured(detail, cleanPrefix(ward), cleanPrefix(district), cleanPrefix(province));
        if (result != null) return result;

        // 3. Cấp độ 3: Free-form đầy đủ
        String addrFull = String.format("%s, %s, %s, %s, Vietnam", detail, ward != null ? ward : "", district, province)
                .replace(", ,", ",");
        result = tryGeocode(addrFull);
        if (result != null) return result;

        log.warn("Geocoding chi tiết thất bại. Bắt đầu đơn giản hóa để tìm kết quả đường phố...");

        // 4. Cấp độ 4: Bỏ Phường (Nhiều khi Phường gán sai trong OSM)
        String addrNoWard = String.format("%s, %s, %s, Vietnam", detail, district, province);
        result = tryGeocode(addrNoWard);
        if (result != null) return result;

        // 5. Cấp độ 5: Bỏ Tỉnh (Sửa lỗi OSM gán nhầm Tỉnh - Ví dụ Tam Kỳ gán vào Đà Nẵng)
        String addrNoProvince = String.format("%s, %s, %s, Vietnam", detail, ward, district);
        result = tryGeocode(addrNoProvince);
        if (result != null) return result;

        // 6. Cấp độ 6: Chỉ Số nhà + Quận (Bỏ cả Phường và Tỉnh)
        String addrMinimal = String.format("%s, %s, Vietnam", detail, district);
        result = tryGeocode(addrMinimal);
        if (result != null) return result;

        // 7. Cấp độ 7: Strip "ward/city names" duplicated in detail
        String simpleStreet = detail.split(",")[0].trim();
        if (!simpleStreet.equals(detail)) {
            result = tryGeocode(String.format("%s, %s, Vietnam", simpleStreet, district));
            if (result != null) return result;
        }

        // 8. Cấp độ 8: Chỉ tên đường (không số nhà) trong Quận
        // (Vẫn tốt hơn là nhảy về tâm Phường nếu ko tìm thấy số nhà 60)
        String streetOnly = detail.replaceAll("^\\d+[a-zA-Z]?\\s+", "").trim();
        if (!streetOnly.equals(detail)) {
            result = tryGeocode(String.format("%s, %s, Vietnam", streetOnly, district));
            if (result != null) return result;
        }

        // 9. Cấp độ 9: Fallback về trung tâm Phường (Chỉ khi ko thấy đường)
        if (ward != null && !ward.isBlank()) {
            result = tryGeocode(String.format("%s, %s, %s, Vietnam", cleanPrefix(ward), cleanPrefix(district), cleanPrefix(province)));
            if (result == null) {
                result = tryGeocode(String.format("%s, %s, Vietnam", cleanPrefix(ward), cleanPrefix(district)));
            }
            if (result != null) return result;
        }

        // 10. Cấp độ 10: Fallback về trung tâm Quận
        result = tryGeocode(String.format("%s, %s, Vietnam", cleanPrefix(district), cleanPrefix(province)));
        if (result == null) {
            result = tryGeocode(String.format("%s, Vietnam", cleanPrefix(district)));
        }
        if (result != null) return result;

        log.error("Tất cả các thử nghiệm Geocoding đều thất bại cho: {}.", addrFull);
        throw new RuntimeException("Không thể định vị địa chỉ này: " + addrFull);
    }

    /**
     * Loại bỏ các tiền tố địa danh phổ biến của Việt Nam để tăng độ khớp với OpenStreetMap
     */
    private String cleanPrefix(String name) {
        if (name == null) return null;
        return name.replaceFirst("(?i)^(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn)\\s+", "").trim();
    }

    /**
     * Loại bỏ dấu tiếng Việt (để xử lý lỗi encoding hoặc database không dấu)
     */
    private String removeAccents(String str) {
        if (str == null) return null;
        String nfdNormalizedString = java.text.Normalizer.normalize(str, java.text.Normalizer.Form.NFD);
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        return pattern.matcher(nfdNormalizedString).replaceAll("").replace('đ', 'd').replace('Đ', 'D');
    }

    private GeoResult tryGeocodeStructured(String street, String ward, String district, String province) {
        try {
            String streetInfo = (ward != null && !ward.isBlank()) ? street + ", " + ward : street;

            UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(NOMINATIM_URL)
                    .queryParam("street", streetInfo)
                    .queryParam("county", district)
                    .queryParam("state", province)
                    .queryParam("country", "Vietnam")
                    .queryParam("format", "json")
                    .queryParam("addressdetails", 1)
                    .queryParam("limit", 3); // Tăng limit để chọn lọc

            return executeRequest(builder.build().toUriString(), street);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Overload method hỗ trợ string địa chỉ gộp (Backward compatibility fallback)
     */
    public GeoResult geocode(String fullAddress) {
        log.info("Geocoding simple address: {}", fullAddress);
        GeoResult result = tryGeocode(fullAddress);
        if (result != null) return result;
        
        throw new RuntimeException("Không thể tìm thấy tọa độ cho địa chỉ: " + fullAddress);
    }

    private GeoResult tryGeocode(String fullAddress) {
        String normalizedAddress = normalizeAddress(fullAddress);
        try {
            String url = UriComponentsBuilder.fromUriString(NOMINATIM_URL)
                    .queryParam("q", normalizedAddress)
                    .queryParam("format", "json")
                    .queryParam("addressdetails", 1)
                    .queryParam("countrycodes", "vn")
                    .queryParam("limit", 3) // Tăng limit
                    .build()
                    .toUriString();

            return executeRequest(url, fullAddress);
        } catch (Exception e) {
            log.error("Geocoding error for address {}: {}", normalizedAddress, e.getMessage());
        }
        return null;
    }

    private GeoResult executeRequest(String url, String originalDetail) {
        // Nominatim requires a User-Agent header
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("User-Agent", "HomeConnect/1.0 (contact: nguyentrananhtu106@gmail.com)");
        headers.setAccept(java.util.Collections.singletonList(org.springframework.http.MediaType.APPLICATION_JSON));
        
        org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(headers);

        org.springframework.http.ResponseEntity<List> responseEntity = restTemplate.exchange(
                url,
                org.springframework.http.HttpMethod.GET,
                entity,
                List.class
        );

        List<Map<String, Object>> response = responseEntity.getBody();

        if (response != null && !response.isEmpty()) {
            return findBestMatch(response, originalDetail);
        }
        return null;
    }

    private GeoResult findBestMatch(List<Map<String, Object>> results, String originalDetail) {
        String targetHouseNumber = extractHouseNumber(originalDetail);
        
        Map<String, Object> bestResult = results.get(0);
        
        if (targetHouseNumber != null) {
            for (Map<String, Object> res : results) {
                Map<String, Object> address = (Map<String, Object>) res.get("address");
                if (address != null) {
                    String foundHouseNumber = (String) address.get("house_number");
                    if (targetHouseNumber.equalsIgnoreCase(foundHouseNumber)) {
                        log.info("Found exact house number match: {}", foundHouseNumber);
                        bestResult = res;
                        break;
                    }
                }
            }
        }

        return GeoResult.builder()
                .latitude(new BigDecimal((String) bestResult.get("lat")))
                .longitude(new BigDecimal((String) bestResult.get("lon")))
                .build();
    }

    private String extractHouseNumber(String detail) {
        if (detail == null) return null;
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("^(\\d+[a-zA-Z]?)").matcher(detail.trim());
        return matcher.find() ? matcher.group(1) : null;
    }

    private String normalizeAddress(String address) {
        if (address == null) return "";
        return address.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}

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

    @org.springframework.beans.factory.annotation.Value("${app.goong.place-detail-url:https://rsapi.goong.io/Place/Detail}")
    private String goongPlaceDetailUrl;

    private static final double MAX_PLACE_COORD_DISTANCE_METERS = 150.0;

    public GeocodingService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Data
    @Builder
    public static class GeoResult {
        private BigDecimal latitude;
        private BigDecimal longitude;
        private String normalizedAddress;
    }

    /**
     * Validate tọa độ do client gửi có khớp với placeId từ Goong hay không.
     */
    @RateLimiter(name = "goong")
    public void validatePlaceCoordinates(String placeId, BigDecimal latitude, BigDecimal longitude) {
        try {
            String url = UriComponentsBuilder.fromUriString(goongPlaceDetailUrl)
                    .queryParam("place_id", placeId)
                    .queryParam("api_key", apiKey)
                    .build()
                    .toUriString();

            org.springframework.http.ResponseEntity<Map> responseEntity = restTemplate.getForEntity(url, Map.class);
            Map<String, Object> response = responseEntity.getBody();

            if (response == null || !"OK".equals(response.get("status"))) {
                throw new IllegalArgumentException("placeId Goong không hợp lệ hoặc không truy xuất được");
            }

            Map<String, Object> result = (Map<String, Object>) response.get("result");
            if (result == null) {
                throw new IllegalArgumentException("Không tìm thấy chi tiết địa điểm từ Goong");
            }

            Map<String, Object> geometry = (Map<String, Object>) result.get("geometry");
            Map<String, Object> location = geometry != null ? (Map<String, Object>) geometry.get("location") : null;
            if (location == null || location.get("lat") == null || location.get("lng") == null) {
                throw new IllegalArgumentException("Goong không trả về tọa độ hợp lệ cho placeId");
            }

            BigDecimal goongLat = new BigDecimal(location.get("lat").toString());
            BigDecimal goongLng = new BigDecimal(location.get("lng").toString());

            double distanceMeters = calculateDistanceMeters(latitude, longitude, goongLat, goongLng);
            if (distanceMeters > MAX_PLACE_COORD_DISTANCE_METERS) {
                throw new IllegalArgumentException("Tọa độ không khớp với địa chỉ đã chọn từ Goong");
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi xác thực placeId {} với Goong: {}", placeId, e.getMessage());
            throw new RuntimeException("Không thể xác thực địa chỉ với Goong");
        }
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
     * Geocode theo địa chỉ tự do (dùng cho tạo Job Post).
     * Backend tự xử lý lat/lng từ addressDetail để không phụ thuộc tọa độ FE gửi lên.
     */
    @RateLimiter(name = "goong")
    public GeoResult geocodeByAddressText(String addressDetail) {
        if (addressDetail == null || addressDetail.isBlank()) {
            throw new IllegalArgumentException("Địa chỉ không được để trống");
        }

        String normalizedAddress = addressDetail.trim();
        GeoResult result = tryGeocode(normalizedAddress + ", Vietnam");
        if (result != null) {
            if (result.getNormalizedAddress() == null || result.getNormalizedAddress().isBlank()) {
                result.setNormalizedAddress(normalizedAddress);
            }
            return result;
        }

        result = tryGeocode(normalizedAddress);
        if (result != null) {
            if (result.getNormalizedAddress() == null || result.getNormalizedAddress().isBlank()) {
                result.setNormalizedAddress(normalizedAddress);
            }
            return result;
        }

        throw new RuntimeException("Không thể định vị địa chỉ này: " + normalizedAddress);
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
                Map<String, Object> firstResult = results.get(0);
                Map<String, Object> geometry = (Map<String, Object>) firstResult.get("geometry");
                Map<String, Object> location = (Map<String, Object>) geometry.get("location");
                String formattedAddress = firstResult.get("formatted_address") != null
                        ? firstResult.get("formatted_address").toString()
                        : null;
                
                return GeoResult.builder()
                        .latitude(new BigDecimal(location.get("lat").toString()))
                        .longitude(new BigDecimal(location.get("lng").toString()))
                        .normalizedAddress(formattedAddress)
                        .build();
            }
        }
        return null;
    }

    private double calculateDistanceMeters(BigDecimal lat1, BigDecimal lng1,
                                           BigDecimal lat2, BigDecimal lng2) {
        final int EARTH_RADIUS = 6371000;

        double dLat = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double dLng = Math.toRadians(lng2.doubleValue() - lng1.doubleValue());

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1.doubleValue())) *
                        Math.cos(Math.toRadians(lat2.doubleValue())) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS * c;
    }
}

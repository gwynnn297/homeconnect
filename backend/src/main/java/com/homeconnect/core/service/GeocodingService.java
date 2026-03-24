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
        throw new com.homeconnect.core.exception.ApiException(
                "Không tìm thấy địa chỉ này trên bản đồ. Vui lòng kiểm tra lại hoặc nhập địa chỉ chính xác hơn.",
                org.springframework.http.HttpStatus.BAD_REQUEST);
    }

    /**
     * Geocode theo địa chỉ tự do (dùng cho tạo Job Post).
     * Backend tự xử lý lat/lng từ addressDetail để không phụ thuộc tọa độ FE gửi lên.
     */
    @RateLimiter(name = "goong")
    public GeoResult geocodeByAddressText(String addressDetail) {
        String normalizedAddress = addressDetail.trim();
        
        // Kiểm tra sơ bộ chuỗi nhập vào: Phải đủ dài (số từ >= 6) HOẶC có ít nhất 2 dấu phẩy
        // Để đảm bảo có ít nhất [Số nhà/Đường] + [Quận/Phường] + [Tỉnh/Thành phố]
        String[] words = normalizedAddress.split("\\s+");
        long commaCount = normalizedAddress.chars().filter(ch -> ch == ',').count();
        
        if (words.length < 6 && commaCount < 2) {
            throw new com.homeconnect.core.exception.ApiException(
                    "Vui lòng nhập địa chỉ đầy đủ hơn (Ví dụ: Số 60 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội).",
                    org.springframework.http.HttpStatus.BAD_REQUEST);
        }

        String finalQuery = normalizedAddress;
        if (!normalizedAddress.toLowerCase().contains("vietnam") && !normalizedAddress.toLowerCase().contains("việt nam")) {
            finalQuery = normalizedAddress + ", Vietnam";
        }
        
        GeoResult result = tryGeocode(finalQuery);
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

        throw new com.homeconnect.core.exception.ApiException(
                "Địa chỉ chưa đủ cụ thể. Vui lòng nhập đầy đủ Số nhà, Tên đường, Phường/Xã và Quận/Huyện.",
                org.springframework.http.HttpStatus.BAD_REQUEST);
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
                Map<String, Object> firstResult = results.get(0);
                log.debug("Goong result: {}", firstResult.get("formatted_address"));

                // Kiểm tra độ tin cậy: Nếu kết quả quá chung chung (chỉ có tên nước) thì coi như không tìm thấy
                String formattedAddress = firstResult.get("formatted_address") != null
                        ? firstResult.get("formatted_address").toString()
                        : "";
                
                // Nếu kết quả trả về quá chung chung (ít hơn 4 thành phần phân cách bởi dấu phẩy)
                // Ví dụ: "Quận 1, TP.HCM, Vietnam" (3 phần) -> Chưa đủ cụ thể
                // Một địa chỉ tốt thường có: [Tên đường], [Quận], [Tỉnh/TP], Vietnam (Tối thiểu 4 phần)
                if (formattedAddress.equalsIgnoreCase("Vietnam") || formattedAddress.equalsIgnoreCase("Việt Nam") 
                    || formattedAddress.split(",").length < 4) {
                    log.warn("Goong returned a result that is too broad/generic: {}", formattedAddress);
                    return null;
                }

                Map<String, Object> geometry = (Map<String, Object>) firstResult.get("geometry");
                Map<String, Object> location = (Map<String, Object>) geometry.get("location");
                
                // Kiểm tra partial_match: Nếu Goong/Google không tìm thấy địa chỉ chính xác
                // và phải "đoán" hoặc bỏ bớt thành phần địa chỉ để ra kết quả.
                Object partialMatch = firstResult.get("partial_match");
                if (partialMatch != null && (Boolean) partialMatch) {
                    log.warn("Goong returned a partial match for address. Rejecting for strictness.");
                    return null;
                }

                // Kiểm tra location_type: Nếu có trả về thì log lại để theo dõi, 
                // nhưng không chặn cứng vì một số kết quả hợp lệ của Goong có thể để trống trường này.
                String locationType = geometry.get("location_type") != null ? geometry.get("location_type").toString() : "UNKNOWN";
                log.debug("Location type: {}", locationType);

                return GeoResult.builder()
                        .latitude(new BigDecimal(location.get("lat").toString()))
                        .longitude(new BigDecimal(location.get("lng").toString()))
                        .normalizedAddress(formattedAddress)
                        .build();
            }
        } else {
            log.warn("Goong status: {}", response != null ? response.get("status") : "null");
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

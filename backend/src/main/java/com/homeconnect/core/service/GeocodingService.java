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
import com.homeconnect.core.exception.ApiException;
import org.springframework.http.HttpStatus;

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

    @org.springframework.beans.factory.annotation.Value("${app.goong.autocomplete-url:https://rsapi.goong.io/Place/Autocomplete}")
    private String goongAutocompleteUrl;

    private static final double MAX_PLACE_COORD_DISTANCE_METERS = 150.0;

    public GeocodingService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Data
    @Builder
    public static class GeoResult {
        private String placeId;
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

            org.springframework.http.ResponseEntity<Map<String, Object>> responseEntity = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, null, 
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});
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

        // 3. Cấp độ 3: Chỉ Số nhà + Tên đường + Quận + Tỉnh (Bỏ phường)
        result = tryGeocode(String.format("%s, %s, %s, Vietnam", detail, district, province));
        if (result != null) return result;

        log.error("Tất cả các thử nghiệm Goong Geocoding đều thất bại cho: {}.", addrFull);
        return null;
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
        
        if (words.length < 7 && commaCount < 3) {
            throw new ApiException(
                    "Địa chỉ quá ngắn hoặc thiếu thông tin (Quận, Phường, Tỉnh). Vui lòng nhập đầy đủ (Ví dụ: 60 Lý Thường Kiệt, Trần Hưng Đạo, Hoàn Kiếm, Hà Nội).",
                    HttpStatus.BAD_REQUEST);
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

        throw new ApiException(
                "Địa chỉ chưa đủ cụ thể. Vui lòng nhập đầy đủ Số nhà, Tên đường, Phường/Xã và Quận/Huyện.",
                HttpStatus.BAD_REQUEST);
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

            return executeRequest(url, fullAddress);
        } catch (Exception e) {
            log.error("Goong Geocoding error for address {}: {}", fullAddress, e.getMessage());
        }
        return null;
    }

    private GeoResult executeRequest(String url, String originalAddress) {
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
                
                // Kiểm tra location_type: Chặn các kết quả quá chung chung (vùng, thành phố, quận)
                String locationType = geometry.get("location_type") != null ? geometry.get("location_type").toString() : "UNKNOWN";
                if (locationType.equals("APPROXIMATE") || locationType.equals("GEOMETRIC_CENTER")) {
                    log.warn("Goong returned a generic location type ({}). Rejecting for strictness.", locationType);
                    return null;
                }

                // Kiểm tra khớp số nhà: Nếu input có số mà kết quả không có số ở đầu -> Sai lệch
                if (originalAddress != null && originalAddress.matches("^\\d+.*") && !formattedAddress.matches("^\\d+.*")) {
                    log.warn("Input has house number but result does not. Potential fuzzy mismatch: {}", formattedAddress);
                    return null;
                }

                return GeoResult.builder()
                        .placeId(firstResult.get("place_id") != null ? firstResult.get("place_id").toString() : null)
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

    @RateLimiter(name = "goong")
    @SuppressWarnings("unchecked")
    public List<Map<String, String>> getSuggestions(String input) {
        if (input == null || input.trim().length() < 3) {
            return List.of();
        }

        // Junk detector: Chặn chuỗi lặp lại hoặc chuỗi vô nghĩa trước khi gọi API
        String normalized = input.toLowerCase().trim();
        if (normalized.matches(".*(.)\\1{3,}.*") || // Ký tự lặp lại 4 lần liên tiếp (aaaa, 1111)
            normalized.matches("^[asdfghjklqwertyuiopzxcvbnm]{5,}$") && !normalized.contains(" ")) { // Chuỗi nhảm nhí dài không dấu cách
            
            // Chặn các chuỗi múa phím phổ biến: asdasd, qweqwe, zxczxc
            if (normalized.contains("asd") || normalized.contains("qwe") || normalized.contains("zxc") || 
                normalized.contains("dfg") || normalized.contains("ghj") || normalized.contains("jkl")) {
               return List.of();
            }

            // Kiểm tra nguyên âm: Nếu chuỗi dài > 5 ký tự mà không có nguyên âm -> Rác
            if (normalized.length() > 5 && !normalized.matches(".*[aeiouyáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ].*")) {
                return List.of();
            }
        }
        try {
            String url = UriComponentsBuilder.fromUriString(goongAutocompleteUrl)
                    .queryParam("input", input)
                    .queryParam("limit", 10)
                    .queryParam("location", "10.7769,106.7009") // Bias về TP.HCM (hoặc HN nếu cần)
                    .queryParam("radius", 50000) // Bán kính 50km
                    .queryParam("more_compound", true) // Trả về thông tin địa chỉ chi tiết hơn
                    .queryParam("api_key", apiKey)
                    .build()
                    .toUriString();

            Map<String, Object> raw = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, null, 
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {}).getBody();
            if (raw == null) return List.of();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> predictions = (List<Map<String, Object>>) raw.get("predictions");
            if (predictions == null) return List.of();

            return predictions.stream()
                    .map(p -> Map.of(
                            "place_id",    String.valueOf(p.getOrDefault("place_id", "")),
                            "description", String.valueOf(p.getOrDefault("description", ""))
                    ))
                    .collect(java.util.stream.Collectors.toList());

        } catch (Exception e) {
            log.error("Goong Autocomplete error for input '{}': {}", input, e.getMessage());
            return List.of();
        }
    }

    @RateLimiter(name = "goong")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getPlaceDetail(String placeId) {
        if (placeId == null || placeId.isBlank()) {
            throw new ApiException("placeId không được để trống", HttpStatus.BAD_REQUEST);
        }
        try {
            String url = UriComponentsBuilder.fromUriString(goongPlaceDetailUrl)
                    .queryParam("place_id", placeId)
                    .queryParam("api_key", apiKey)
                    .build()
                    .toUriString();

            Map<String, Object> raw = restTemplate.getForObject(url, Map.class);
            if (raw == null || !"OK".equals(raw.get("status"))) {
                throw new ApiException("Không thể lấy chi tiết địa điểm từ Goong (status: " + 
                    (raw != null ? raw.get("status") : "null") + ")", HttpStatus.BAD_REQUEST);
            }

            Map<String, Object> result = (Map<String, Object>) raw.get("result");
            if (result == null) {
                throw new ApiException("Goong không trả về kết quả cho placeId này", HttpStatus.NOT_FOUND);
            }

            Map<String, Object> geometry = (Map<String, Object>) result.get("geometry");
            Map<String, Object> location = (geometry != null) ? (Map<String, Object>) geometry.get("location") : null;

            Double lat = (location != null) ? Double.valueOf(String.valueOf(location.get("lat"))) : 0.0;
            Double lng = (location != null) ? Double.valueOf(String.valueOf(location.get("lng"))) : 0.0;

            return Map.of(
                "place_id", placeId,
                "name", String.valueOf(result.getOrDefault("name", "")),
                "formatted_address", String.valueOf(result.getOrDefault("formatted_address", "")),
                "latitude", lat,
                "longitude", lng
            );

        } catch (Exception e) {
            log.error("Goong Place Detail error: {}", e.getMessage());
            return Map.of("status", "ERROR");
        }
    }

    /**
     * Lấy thông tin địa chỉ có cấu trúc từ placeId (cho Frontend tự điền form).
     * Trả về: addressDetail, wardName, districtName, provinceName, latitude, longitude
     */
    @RateLimiter(name = "goong")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getAddressComponents(String placeId) {
        if (placeId == null || placeId.isBlank()) {
            throw new ApiException("placeId không được để trống", HttpStatus.BAD_REQUEST);
        }
        try {
            String url = UriComponentsBuilder.fromUriString(goongPlaceDetailUrl)
                    .queryParam("place_id", placeId)
                    .queryParam("api_key", apiKey)
                    .build()
                    .toUriString();

            org.springframework.http.ResponseEntity<Map<String, Object>> responseEntity = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, null, 
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});
            Map<String, Object> raw = responseEntity.getBody();
            
            if (raw == null || !"OK".equals(raw.get("status"))) {
                throw new ApiException("Không thể lấy chi tiết địa điểm từ Goong", HttpStatus.BAD_REQUEST);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>) raw.get("result");
            if (result == null) {
                throw new ApiException("Goong không trả về kết quả cho placeId này", HttpStatus.NOT_FOUND);
            }

            // Lấy tọa độ
            Map<String, Object> geometry = (Map<String, Object>) result.get("geometry");
            Map<String, Object> location = (geometry != null) ? (Map<String, Object>) geometry.get("location") : null;
            Double lat = (location != null) ? Double.valueOf(String.valueOf(location.get("lat"))) : 0.0;
            Double lng = (location != null) ? Double.valueOf(String.valueOf(location.get("lng"))) : 0.0;

            // Parse address_components để lấy từng thành phần
            List<Map<String, Object>> components = (List<Map<String, Object>>) result.get("address_components");
            String streetNumber = "", route = "", ward = "", district = "", province = "";

            if (components != null) {
                for (Map<String, Object> comp : components) {
                    List<String> types = (List<String>) comp.get("types");
                    String longName = String.valueOf(comp.getOrDefault("long_name", ""));
                    if (types == null) continue;
                    if (types.contains("street_number"))                   streetNumber = longName;
                    else if (types.contains("route"))                      route = longName;
                    else if (types.contains("administrative_area_level_3") || 
                             types.contains("sublocality_level_1") ||
                             types.contains("administrative_area_level_4")) ward = longName;
                    else if (types.contains("administrative_area_level_2")) district = longName;
                    else if (types.contains("administrative_area_level_1")) province = longName;
                }
            }

            // Ghép addressDetail từ số nhà + tên đường
            String addressDetail = (streetNumber.isBlank() ? "" : streetNumber + " ") + route;
            if (addressDetail.isBlank()) {
                addressDetail = String.valueOf(result.getOrDefault("name", ""));
            }

            // Nếu parse không được từ components, fallback dùng formatted_address
            String formattedAddress = String.valueOf(result.getOrDefault("formatted_address", ""));

            java.util.Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("placeId", placeId);
            response.put("formattedAddress", formattedAddress);
            response.put("addressDetail", addressDetail.trim());
            response.put("wardName", ward);
            response.put("districtName", district);
            response.put("provinceName", province);
            response.put("latitude", lat);
            response.put("longitude", lng);
            return response;

        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Goong Address Components error: {}", e.getMessage());
            throw new ApiException("Không thể phân tích địa chỉ từ placeId này.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
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

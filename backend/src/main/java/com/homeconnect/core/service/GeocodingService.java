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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
        private String wardName;
        private String districtName;
        private String provinceName;
        private String wardCode;
        private String districtCode;
        private String provinceCode;
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
     * Lấy tọa độ từ địa chỉ.
     */
    @RateLimiter(name = "goong")
    public GeoResult geocode(String detail, String ward, String district, String province) {
        String addrFull = String.format("%s, %s, %s, %s, Vietnam", detail, ward != null ? ward : "", district, province)
                .replace(", ,", ",");
        GeoResult result = tryGeocode(addrFull);
        if (result != null) return result;

        result = tryGeocode(String.format("%s, %s, %s, %s, Vietnam", detail, cleanPrefix(ward), cleanPrefix(district), cleanPrefix(province)));
        if (result != null) return result;

        result = tryGeocode(String.format("%s, %s, %s, Vietnam", detail, district, province));
        return result;
    }

    @RateLimiter(name = "goong")
    public GeoResult geocodeByAddressText(String addressDetail) {
        String normalizedAddress = addressDetail.trim();
        String finalQuery = normalizedAddress;
        if (!normalizedAddress.toLowerCase().contains("vietnam") && !normalizedAddress.toLowerCase().contains("việt nam")) {
            finalQuery = normalizedAddress + ", Vietnam";
        }
        
        GeoResult result = tryGeocode(finalQuery);
        if (result != null) return result;

        result = tryGeocode(normalizedAddress);
        if (result != null) return result;

        throw new ApiException("Địa chỉ chưa đủ cụ thể. Vui lòng nhập đầy đủ Số nhà, Tên đường, Phường/Xã và Quận/Huyện.", HttpStatus.BAD_REQUEST);
    }

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
        org.springframework.http.ResponseEntity<Map<String, Object>> responseEntity = restTemplate.exchange(
                url, org.springframework.http.HttpMethod.GET, null, 
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});
        Map<String, Object> response = responseEntity.getBody();

        if (response != null && "OK".equals(response.get("status"))) {
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results != null && !results.isEmpty()) {
                Map<String, Object> firstResult = results.get(0);
                String formattedAddress = firstResult.get("formatted_address") != null ? firstResult.get("formatted_address").toString() : "";
                
                Map<String, Object> geometry = (Map<String, Object>) firstResult.get("geometry");
                Map<String, Object> location = (Map<String, Object>) geometry.get("location");
                
                Map<String, String> components = parseComponents(firstResult);

                return GeoResult.builder()
                        .placeId(firstResult.get("place_id") != null ? firstResult.get("place_id").toString() : null)
                        .latitude(new BigDecimal(location.get("lat").toString()))
                        .longitude(new BigDecimal(location.get("lng").toString()))
                        .normalizedAddress(formattedAddress)
                        .wardName(components.get("wardName"))
                        .districtName(components.get("districtName"))
                        .provinceName(components.get("provinceName"))
                        .wardCode(components.get("wardCode"))
                        .districtCode(components.get("districtCode"))
                        .provinceCode(components.get("provinceCode"))
                        .build();
            }
        }
        return null;
    }

    @RateLimiter(name = "goong")
    public List<Map<String, String>> getSuggestions(String input) {
        if (input == null || input.trim().length() < 3) return List.of();
        try {
            String url = UriComponentsBuilder.fromUriString(goongAutocompleteUrl)
                    .queryParam("input", input)
                    .queryParam("limit", 10)
                    .queryParam("location", "10.7769,106.7009")
                    .queryParam("radius", 50000)
                    .queryParam("more_compound", true)
                    .queryParam("api_key", apiKey)
                    .build()
                    .toUriString();

            Map<String, Object> raw = restTemplate.exchange(
                    url, org.springframework.http.HttpMethod.GET, null, 
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {}).getBody();
            if (raw == null) return List.of();

            List<Map<String, Object>> predictions = (List<Map<String, Object>>) raw.get("predictions");
            if (predictions == null) return List.of();

            List<Map<String, String>> result = new ArrayList<>();
            for (Map<String, Object> p : predictions) {
                Map<String, String> map = new HashMap<>();
                map.put("place_id", String.valueOf(p.getOrDefault("place_id", "")));
                map.put("description", String.valueOf(p.getOrDefault("description", "")));
                result.add(map);
            }
            return result;
        } catch (Exception e) {
            log.error("Goong Autocomplete error: {}", e.getMessage());
            return List.of();
        }
    }

    @RateLimiter(name = "goong")
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
                throw new ApiException("Không thể lấy chi tiết địa điểm từ Goong", HttpStatus.BAD_REQUEST);
            }

            Map<String, Object> result = (Map<String, Object>) raw.get("result");
            if (result == null) {
                throw new ApiException("Goong không trả về kết quả cho placeId này", HttpStatus.NOT_FOUND);
            }

            Map<String, Object> geometry = (Map<String, Object>) result.get("geometry");
            Map<String, Object> location = (geometry != null) ? (Map<String, Object>) geometry.get("location") : null;

            if (location == null || location.get("lat") == null || location.get("lng") == null) {
                throw new ApiException("Goong không trả về tọa độ hợp lệ cho địa điểm này", HttpStatus.BAD_REQUEST);
            }
            Double lat = Double.valueOf(String.valueOf(location.get("lat")));
            Double lng = Double.valueOf(String.valueOf(location.get("lng")));

            Map<String, Object> response = new HashMap<>();
            response.put("place_id", placeId);
            response.put("name", String.valueOf(result.getOrDefault("name", "")));
            response.put("formatted_address", String.valueOf(result.getOrDefault("formatted_address", "")));
            response.put("latitude", lat);
            response.put("longitude", lng);
            return response;
        } catch (Exception e) {
            log.error("Goong Place Detail error: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("status", "ERROR");
            return error;
        }
    }

    @RateLimiter(name = "goong")
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

            Map<String, Object> result = (Map<String, Object>) raw.get("result");
            if (result == null) {
                throw new ApiException("Goong không trả về kết quả cho placeId này", HttpStatus.NOT_FOUND);
            }

            Map<String, Object> geometry = (Map<String, Object>) result.get("geometry");
            Map<String, Object> location = (geometry != null) ? (Map<String, Object>) geometry.get("location") : null;
            if (location == null || location.get("lat") == null || location.get("lng") == null) {
                throw new ApiException("Goong không trả về tọa độ hợp lệ cho địa điểm này", HttpStatus.BAD_REQUEST);
            }
            Double lat = Double.valueOf(String.valueOf(location.get("lat")));
            Double lng = Double.valueOf(String.valueOf(location.get("lng")));

            Map<String, String> extracted = parseComponents(result);
            String wCode = extracted.get("wardCode"), dCode = extracted.get("districtCode"), pCode = extracted.get("provinceCode");
            String ward = extracted.get("wardName"), district = extracted.get("districtName"), province = extracted.get("provinceName");

            if (wCode.isBlank() || dCode.isBlank() || pCode.isBlank()) {
                try {
                    String reverseUrl = UriComponentsBuilder.fromUriString(goongUrl)
                            .queryParam("latlng", lat.toString() + "," + lng.toString())
                            .queryParam("api_key", apiKey)
                            .build().toUriString();
                    
                    Map<String, Object> revBody = restTemplate.getForObject(reverseUrl, Map.class);
                    if (revBody != null && "OK".equals(revBody.get("status"))) {
                        List<Map<String, Object>> results = (List<Map<String, Object>>) revBody.get("results");
                        if (results != null && !results.isEmpty()) {
                            Map<String, String> revComp = parseComponents(results.get(0));
                            if (wCode.isBlank()) { wCode = revComp.get("wardCode"); ward = revComp.get("wardName"); }
                            if (dCode.isBlank()) { dCode = revComp.get("districtCode"); district = revComp.get("districtName"); }
                            if (pCode.isBlank()) { pCode = revComp.get("provinceCode"); province = revComp.get("provinceName"); }
                        }
                    }
                } catch (Exception e) {
                    log.error("Reverse Geocoding fallback failed: {}", e.getMessage());
                }
            }

            List<Map<String, Object>> components = (List<Map<String, Object>>) result.get("address_components");
            String streetNumber = "", route = "";
            if (components != null) {
                for (Map<String, Object> comp : components) {
                    List<String> types = (List<String>) comp.get("types");
                    if (types == null) continue;
                    if (types.contains("street_number")) streetNumber = String.valueOf(comp.get("long_name"));
                    if (types.contains("route")) route = String.valueOf(comp.get("long_name"));
                }
            }

            String addressDetail = (streetNumber.isBlank() ? "" : streetNumber + " ") + route;
            if (addressDetail.isBlank()) addressDetail = String.valueOf(result.getOrDefault("name", ""));

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("placeId", placeId);
            response.put("formattedAddress", String.valueOf(result.getOrDefault("formatted_address", "")));
            response.put("addressDetail", addressDetail.trim());
            response.put("wardName", ward);
            response.put("districtName", district);
            response.put("provinceName", province);
            response.put("wardCode", wCode);
            response.put("districtCode", dCode);
            response.put("provinceCode", pCode);
            response.put("latitude", lat);
            response.put("longitude", lng);
            return response;
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Goong Address Components error: {}", e.getMessage());
            throw new ApiException("Không thể phân tích địa chỉ.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private Map<String, String> parseComponents(Map<String, Object> result) {
        Map<String, String> res = new HashMap<>();
        String ward = "", district = "", province = "";
        String wCode = "", dCode = "", pCode = "";

        List<Map<String, Object>> components = (List<Map<String, Object>>) result.get("address_components");
        if (components != null) {
            for (Map<String, Object> comp : components) {
                List<String> types = (List<String>) comp.get("types");
                String longName = String.valueOf(comp.getOrDefault("long_name", ""));
                String shortName = String.valueOf(comp.getOrDefault("short_name", ""));
                if (types == null) continue;

                if (types.contains("administrative_area_level_3") || types.contains("ward") || types.contains("sublocality_level_1")) {
                    ward = longName; wCode = shortName;
                } else if (types.contains("administrative_area_level_2")) {
                    district = longName; dCode = shortName;
                } else if (types.contains("administrative_area_level_1")) {
                    province = longName; pCode = shortName;
                }
            }
        }

        if (result.containsKey("compound")) {
            Map<String, Object> compound = (Map<String, Object>) result.get("compound");
            if (compound != null) {
                if (compound.get("commune") != null) ward = String.valueOf(compound.get("commune"));
                if (compound.get("district") != null) district = String.valueOf(compound.get("district"));
                if (compound.get("province") != null) province = String.valueOf(compound.get("province"));
                if (compound.get("commune_id") != null) wCode = String.valueOf(compound.get("commune_id"));
                if (compound.get("district_id") != null) dCode = String.valueOf(compound.get("district_id"));
                if (compound.get("province_id") != null) pCode = String.valueOf(compound.get("province_id"));
            }
        }

        res.put("wardName", ward);
        res.put("districtName", district);
        res.put("provinceName", province);
        res.put("wardCode", wCode);
        res.put("districtCode", dCode);
        res.put("provinceCode", pCode);
        return res;
    }

    private double calculateDistanceMeters(BigDecimal lat1, BigDecimal lng1, BigDecimal lat2, BigDecimal lng2) {
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

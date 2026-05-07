package com.homeconnect.core.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ExternalLocationService {

    private final RestTemplate restTemplate;
    private static final String BASE_URL = "https://provinces.open-api.vn/api/v1";

    public ExternalLocationService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Lấy danh sách Tỉnh/Thành
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getProvinces() {

        try {
            String url = BASE_URL + "/p/";
            return restTemplate.getForObject(url, List.class);
        } catch (Exception e) {
            log.error("Error fetching provinces: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Lấy danh sách Quận/Huyện theo mã Tỉnh
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDistrictsByProvince(String provinceCode) {

        try {
            String url = UriComponentsBuilder.fromUriString(BASE_URL)
                    .path("/p/{provinceCode}")
                    .queryParam("depth", 2)
                    .buildAndExpand(provinceCode)
                    .toUriString();
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            log.error("Error fetching districts for province {}: {}", provinceCode, e.getMessage());
            return Collections.emptyMap();
        }
    }



    /**
     * Lấy danh sách Phường/Xã theo mã Quận
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getWardsByDistrict(String districtCode) {

        try {
            String url = UriComponentsBuilder.fromUriString(BASE_URL)
                    .path("/d/{districtCode}")
                    .queryParam("depth", 2)
                    .buildAndExpand(districtCode)
                    .toUriString();
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            log.error("Error fetching wards for district {}: {}", districtCode, e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * Tìm mã Tỉnh theo tên
     */
    public String findProvinceCodeByName(String provinceName) {
        if (provinceName == null || provinceName.isBlank()) return null;
        List<Map<String, Object>> provinces = getProvinces();
        String cleanInput = cleanName(provinceName);
        
        for (Map<String, Object> p : provinces) {
            String name = (String) p.get("name");
            if (cleanName(name).equalsIgnoreCase(cleanInput)) {
                return String.valueOf(p.get("code"));
            }
        }
        return null;
    }

    /**
     * Tìm mã Quận theo tên trong Tỉnh
     */
    public String findDistrictCodeByName(String provinceCode, String districtName) {
        if (provinceCode == null || districtName == null || districtName.isBlank()) return null;
        Map<String, Object> provinceData = getDistrictsByProvince(provinceCode);
        if (provinceData == null || !provinceData.containsKey("districts")) return null;
        
        List<Map<String, Object>> districts = (List<Map<String, Object>>) provinceData.get("districts");
        String cleanInput = cleanName(districtName);
        
        for (Map<String, Object> d : districts) {
            String name = (String) d.get("name");
            if (cleanName(name).equalsIgnoreCase(cleanInput)) {
                return String.valueOf(d.get("code"));
            }
        }
        return null;
    }

    /**
     * Tìm mã Phường theo tên trong Quận
     */
    public String findWardCodeByName(String districtCode, String wardName) {
        if (districtCode == null || wardName == null || wardName.isBlank()) return null;
        Map<String, Object> districtData = getWardsByDistrict(districtCode);
        if (districtData == null || !districtData.containsKey("wards")) return null;
        
        List<Map<String, Object>> wards = (List<Map<String, Object>>) districtData.get("wards");
        String cleanInput = cleanName(wardName);
        
        for (Map<String, Object> w : wards) {
            String name = (String) w.get("name");
            if (cleanName(name).equalsIgnoreCase(cleanInput)) {
                return String.valueOf(w.get("code"));
            }
        }
        return null;
    }

    /**
     * Kiểm tra districtCode có hợp lệ không
     */
    @SuppressWarnings("unchecked")
    public boolean validateDistrict(String districtCode, String districtName) {

        try {
            String url = UriComponentsBuilder.fromUriString(BASE_URL)
                    .path("/d/{districtCode}")
                    .buildAndExpand(districtCode)
                    .toUriString();
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("name")) {
                String name = (String) response.get("name");
                // So sánh tương đối (không phân biệt hoa thường, trim)
                return name.equalsIgnoreCase(districtName.trim());
            }
            return false;
        } catch (Exception e) {
            log.error("Provinces API Downtime/Error: {}", e.getMessage());
            // Fail-fast rule: Nếu API lỗi thì coi như validate thất bại
            return false;
        }
    }

    private String cleanName(String name) {
        if (name == null) return "";
        return name.toLowerCase()
                .replace("thành phố", "")
                .replace("tỉnh", "")
                .replace("quận", "")
                .replace("huyện", "")
                .replace("thị xã", "")
                .replace("phường", "")
                .replace("xã", "")
                .replace("thị trấn", "")
                .replace("tp.", "")
                .trim();
    }
}

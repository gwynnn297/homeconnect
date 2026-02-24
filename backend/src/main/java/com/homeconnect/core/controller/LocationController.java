package com.homeconnect.core.controller;

import com.homeconnect.core.entity.Location;
import com.homeconnect.core.enums.LocationType;
import com.homeconnect.core.repository.LocationRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller quản lý danh sách địa điểm (Tỉnh/Thành, Quận/Huyện)
 */
@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
@Tag(name = "Địa điểm", description = "API tra cứu danh sách tỉnh/thành, quận/huyện")
public class LocationController {

    private final LocationRepository locationRepository;

    @GetMapping("/provinces")
    @Operation(summary = "Lấy danh sách tỉnh/thành phố", description = "Trả về toàn bộ danh sách tỉnh/thành phố Việt Nam")
    public ResponseEntity<List<Map<String, Object>>> getProvinces() {
        List<Location> provinces = locationRepository.findByType(LocationType.PROVINCE);

        List<Map<String, Object>> result = provinces.stream()
                .map(loc -> Map.<String, Object>of(
                        "id", loc.getLocationId(),
                        "name", loc.getName()
                ))
                .toList();

        return ResponseEntity.ok(result);
    }
}

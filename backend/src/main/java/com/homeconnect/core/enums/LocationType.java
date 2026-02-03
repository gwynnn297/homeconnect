package com.homeconnect.core.enums;

/**
 * Enum loại địa điểm
 * Sử dụng trong bảng locations
 */
public enum LocationType {
    PROVINCE("Tỉnh/Thành phố"),
    DISTRICT("Quận/Huyện");
    
    private final String displayName;
    
    LocationType(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}
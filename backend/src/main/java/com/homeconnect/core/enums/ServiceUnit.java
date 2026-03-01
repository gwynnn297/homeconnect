package com.homeconnect.core.enums;

import lombok.Getter;

/**
 * ServiceUnit - Đơn vị tính cho dịch vụ
 */
@Getter
public enum ServiceUnit {
    PER_HOUR("Theo giờ"),
    PER_SERVICE("Theo dịch vụ"),
    PER_METERS("Theo m2"),
    PER_ROOM("Theo phòng");

    private final String description;

    ServiceUnit(String description) {
        this.description = description;
    }
}

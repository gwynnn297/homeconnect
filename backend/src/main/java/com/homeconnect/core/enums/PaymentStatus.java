package com.homeconnect.core.enums;

import lombok.Getter;

@Getter
public enum PaymentStatus {
    HOLDING("Đang giữ tiền (Escrow)"),
    RELEASED("Đã thanh toán cho thợ"),
    REFUNDED("Đã hoàn tiền cho khách");

    private final String description;

    PaymentStatus(String description) {
        this.description = description;
    }
}

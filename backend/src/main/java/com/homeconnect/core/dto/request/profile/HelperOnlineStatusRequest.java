package com.homeconnect.core.dto.request.profile;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HelperOnlineStatusRequest {
    @NotNull(message = "Trạng thái online không được để trống")
    private Boolean isOnline;
}

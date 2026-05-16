package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.HelperRegistrationStage1Request;
import com.homeconnect.core.dto.request.HelperRegistrationStage2Request;
import com.homeconnect.core.dto.request.KycVerifyRequest;
import com.homeconnect.core.dto.request.RegistrationDraft;
import com.homeconnect.core.dto.response.KycVerifyResponse;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.exception.RegistrationIncompleteException;
import com.homeconnect.core.entity.*;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class HelperRegistrationService {

    private final RegistrationCacheService registrationCacheService;
    private final HelperServiceRepository helperServiceRepository;
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final AddressRepository addressRepository;

    private final GeocodingService geocodingService;
    private final RestTemplate restTemplate;

    private static final Pattern CCCD_PATTERN = Pattern.compile("\\b\\d{12}\\b");

    @Value("${app.fpt.ai.api-key:}")
    private String fptAiApiKey;

    @Value("${app.fpt.ai.ocr-url:https://api.fpt.ai/vision/idr/vnm}")
    private String fptAiOcrUrl;

    @Value("${app.facepp.api-key:}")
    private String faceppApiKey;

    @Value("${app.facepp.api-secret:}")
    private String faceppApiSecret;

    @Value("${app.facepp.compare-url:https://api-us.faceplusplus.com/facepp/v3/compare}")
    private String faceppCompareUrl;

    @Value("${app.kyc.face-match-threshold:70}")
    private double kycFaceMatchThreshold;

    @Transactional
    public void registerStage1(String email, HelperRegistrationStage1Request request) {
        log.info("Saving Stage 1 Draft for helper: {}", email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));

        if (user.getRole() != UserRole.HELPER) {
            throw new RuntimeException("Chỉ Helper mới có thể thực hiện đăng ký này");
        }

        // Kiểm tra tuổi (>= 18)
        int age = Period.between(request.getDateOfBirth(), LocalDate.now()).getYears();
        if (age < 18) {
            throw new RuntimeException("Helper phải từ 18 tuổi trở lên");
        }

        if (request.getExperienceYears() > (age - 15)) {
            throw new RuntimeException("Số năm kinh nghiệm không hợp lệ so với tuổi của bạn");
        }

        // Lấy hoặc tạo mới draft
        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null) {
            draft = new RegistrationDraft();
        }

        // Kiểm tra danh mục Dịch vụ (Cha)
        for (Integer catId : request.getCategoryIds()) {
            if (!serviceCategoryRepository.existsById(catId)) {
                throw new RuntimeException("Danh mục không hợp lệ: " + catId);
            }
        }


        // Update draft với Stage 1 data
        draft.setDateOfBirth(request.getDateOfBirth());
        draft.setHometownName(request.getHometownName());
        draft.setProvinceName(request.getProvinceName());
        draft.setProvinceCode(request.getProvinceCode());
        draft.setDistrictName(request.getDistrictName());
        draft.setDistrictCode(request.getDistrictCode());
        draft.setWardName(request.getWardName());
        draft.setWardCode(request.getWardCode());
        draft.setCurrentAddress(request.getCurrentAddress());
        draft.setWorkingDistricts(request.getWorkingDistricts());
        draft.setBio(request.getBio());
        draft.setExperienceYears(request.getExperienceYears());
        draft.setCategoryIds(request.getCategoryIds());

        draft.setLatitude(request.getLatitude());
        draft.setLongitude(request.getLongitude());

        registrationCacheService.saveDraft(email, draft);
        persistStage1Snapshot(user, draft);
        log.info("Stage 1 draft saved in cache for: {}", email);
    }

    /**
     * Giai đoạn 2: Xác thực danh tính (CCCD)
     */
    @Transactional
    public void registerStage2(String email, HelperRegistrationStage2Request request) {
        log.info("Saving Stage 2 Draft for helper: {}", email);

        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null || !draft.isStage1Complete()) {
            User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));

            RegistrationDraft recoveredDraft = buildStage1DraftFromPersistedData(user);
            if (recoveredDraft == null || !recoveredDraft.isStage1Complete()) {
            throw new RegistrationIncompleteException(
                "Vui lòng hoàn thành Giai đoạn 1 trước khi thực hiện Giai đoạn 2");
            }

            draft = recoveredDraft;
            registrationCacheService.saveDraft(email, draft);
            log.info("Recovered Stage 1 draft from persisted data for helper: {}", email);
        }

        String normalizedIdentity = request.getIdentityNumber() != null
            ? request.getIdentityNumber().trim()
            : null;
        if (normalizedIdentity != null && normalizedIdentity.isBlank()) {
            normalizedIdentity = null;
        }

        // Kiểm tra format CCCD (12 chữ số) nếu người dùng có nhập fallback
        if (normalizedIdentity != null && !normalizedIdentity.isBlank() && !normalizedIdentity.matches("^\\d{12}$")) {
            throw new RuntimeException("Số CCCD phải bao gồm chính xác 12 chữ số");
        }

        // Kiểm tra trùng lặp nếu có fallback CCCD hợp lệ
        if (normalizedIdentity != null
            && !normalizedIdentity.isBlank()
            && helperProfileRepository.existsByCccdNumber(normalizedIdentity)) {
            throw new ApiException("CCCD này đã được đăng ký trong hệ thống!", HttpStatus.CONFLICT);
        }

        // Update draft với Stage 2 data
        draft.setIdentityNumber(normalizedIdentity);
        draft.setCccdFrontUrl(request.getCccdFrontUrl());
        draft.setCccdBackUrl(request.getCccdBackUrl());
        draft.setSelfieUrl(request.getSelfieUrl());
        draft.setFaceRightUrl(request.getFaceRightUrl());
        draft.setFaceLeftUrl(request.getFaceLeftUrl());

        registrationCacheService.saveDraft(email, draft);
        log.info("Stage 2 draft updated in cache for: {}", email);
    }

    /**
     * Bước cuối: Gửi hồ sơ để duyệt
     */
    @Transactional
    public void submitRegistration(String email) {
        log.info("Starting final submission for helper: {}", email);

        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null || !draft.isStage1Complete() || !draft.isStage2Complete()) {
            throw new RegistrationIncompleteException(
                    "Hồ sơ chưa hoàn thiện. Vui lòng hoàn thành cả 2 giai đoạn trước khi gửi.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));

        if (draft.getIdentityNumber() != null
            && helperProfileRepository.existsByCccdNumberAndUser_IdNot(draft.getIdentityNumber(), user.getId())) {
            throw new ApiException("CCCD này đã được đăng ký trong hệ thống!", HttpStatus.CONFLICT);
        }

        persistRegistration(user, draft, draft.getIdentityNumber(), KycStatus.WAITING_APPROVAL);

        // 6. Xóa Cache
        registrationCacheService.removeDraft(email);

        log.info("Registration successfully persisted for helper: {}", email);
        }

        /**
         * PB-33: Verify AI KYC (OCR + FaceMatch) và submit hồ sơ.
         */
        @Transactional
        public KycVerifyResponse verifyKycAndSubmit(String email, KycVerifyRequest request) {
        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null || !draft.isStage1Complete() || !draft.isStage2Complete()) {
            throw new RegistrationIncompleteException(
                "Hồ sơ chưa hoàn thiện. Vui lòng hoàn thành cả 2 giai đoạn trước khi gửi.");
        }

        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));

        String cccdFrontUrl = firstNonBlank(request.getCccdFrontUrl(), draft.getCccdFrontUrl());
        String selfieUrl = firstNonBlank(request.getSelfieUrl(), draft.getSelfieUrl());
        if (cccdFrontUrl == null || selfieUrl == null) {
            throw new ApiException("Thiếu ảnh CCCD mặt trước hoặc ảnh selfie", HttpStatus.BAD_REQUEST);
        }

        String extractedCccd = resolveCccdNumber(cccdFrontUrl,
            firstNonBlank(request.getIdentityNumberFallback(), draft.getIdentityNumber()));

        if (helperProfileRepository.existsByCccdNumberAndUser_IdNot(extractedCccd, user.getId())) {
            throw new ApiException("CCCD này đã được đăng ký trong hệ thống!", HttpStatus.CONFLICT);
        }

        double confidence = compareFaceByUrl(cccdFrontUrl, selfieUrl);
        if (confidence < kycFaceMatchThreshold) {
            throw new ApiException(
                "Xác minh khuôn mặt thất bại (" + String.format("%.2f", confidence)
                    + "%). Vui lòng kiểm tra ảnh rõ mặt và thử lại.",
                HttpStatus.BAD_REQUEST);
        }

        persistRegistration(user, draft, extractedCccd, KycStatus.IDENTITY_VERIFIED);
        registrationCacheService.removeDraft(email);

        return KycVerifyResponse.builder()
            .success(true)
            .message("Xác minh khuôn mặt thành công! Hồ sơ đang chờ Admin duyệt kỹ năng.")
            .cccdNumber(extractedCccd)
            .faceConfidence(confidence)
            .kycStatus(KycStatus.IDENTITY_VERIFIED)
            .build();
        }

        private void persistRegistration(User user, RegistrationDraft draft, String cccdNumber, KycStatus kycStatus) {
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
            .orElseGet(() -> HelperProfile.builder().user(user).build());

        profile.setBio(draft.getBio());
        profile.setExperienceYears(draft.getExperienceYears());
        profile.setIdentityNumber(cccdNumber);
        profile.setCccdNumber(cccdNumber);
        profile.setIdentityFrontUrl(optimizeImageUrlForFaceCompare(draft.getCccdFrontUrl()));
        profile.setIdentityBackUrl(optimizeImageUrlForFaceCompare(draft.getCccdBackUrl()));
        profile.setSelfieUrl(optimizeImageUrlForFaceCompare(draft.getSelfieUrl()));
        profile.setFaceRightUrl(optimizeImageUrlForFaceCompare(draft.getFaceRightUrl()));
        profile.setFaceLeftUrl(optimizeImageUrlForFaceCompare(draft.getFaceLeftUrl()));
        profile.setKycStatus(kycStatus);
        profile.setHometownName(draft.getHometownName());
        profile.setUpdatedAt(LocalDateTime.now());

        // 2. Lưu Working Districts
        helperWorkingDistrictRepository.deleteByHelper_Id(user.getId());
        helperWorkingDistrictRepository.flush();
        for (com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest wdReq : draft
                .getWorkingDistricts()) {
            helperWorkingDistrictRepository.save(HelperWorkingDistrict.builder()
                    .helper(user)
                    .districtName(wdReq.getName())
                    .districtCode(wdReq.getCode())
                    .provinceCode(wdReq.getProvinceCode())
                    .build());
        }

        // 3. Lưu Registered Services (Dành cho Danh mục Cha)
        helperServiceRepository.deleteByHelper_Id(user.getId());
        helperServiceRepository.flush();
        for (Integer catId : new java.util.HashSet<>(draft.getCategoryIds())) {
            ServiceCategory category = serviceCategoryRepository.findById(catId)
                    .orElseThrow(() -> new RuntimeException("Danh mục không hợp lệ: " + catId));
            helperServiceRepository.save(HelperService.builder()
                    .helper(user)
                    .category(category)
                    .isActive(true)
                    .build());
        }


        // 4. Update User status, Avatar & Date of Birth
        user.setStatus(UserStatus.PENDING_REVIEW);
        user.setAvatarUrl(draft.getSelfieUrl());
        user.setDateOfBirth(draft.getDateOfBirth());

        // 5. Save Default Address & Geocode
        Address address = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId())
                .orElse(Address.builder()
                        .user(user)
                        .isDefault(true)
                        .type("HOME")
                        .build());

        address.setAddressDetail(draft.getCurrentAddress());
        address.setProvinceName(draft.getProvinceName());
        address.setProvinceCode(draft.getProvinceCode());
        address.setDistrictName(draft.getDistrictName());
        address.setDistrictCode(draft.getDistrictCode());
        address.setWardName(draft.getWardName());
        address.setWardCode(draft.getWardCode());

        // Logic ưu tiên tọa độ (Chuẩn Production-Ready)
        BigDecimal lat = draft.getLatitude();
        BigDecimal lng = draft.getLongitude();

        if (lat != null && lng != null
                && (lat.compareTo(BigDecimal.ZERO) != 0 || lng.compareTo(BigDecimal.ZERO) != 0)) {
            address.setLatitude(lat);
            address.setLongitude(lng);
        } else {
            try {
                GeocodingService.GeoResult geo = geocodingService.geocode(
                        draft.getCurrentAddress(),
                        draft.getWardName(),
                        draft.getDistrictName(),
                        draft.getProvinceName());
                address.setLatitude(geo.getLatitude());
                address.setLongitude(geo.getLongitude());
            } catch (Exception e) {
                log.error("Geocoding failed during submission for helper {}: {}", user.getEmail(), e.getMessage());
                throw new ApiException("Không thể định vị chính xác địa chỉ hiện tại. Vui lòng kiểm tra lại Số nhà, Tên đường và Phường/Quận.", HttpStatus.BAD_REQUEST);
            }
        }

        addressRepository.save(address);
        helperProfileRepository.save(profile);
        userRepository.save(user);
    }

    private String resolveCccdNumber(String cccdFrontUrl, String fallbackIdentityNumber) {
        String ocrResult = extractIdentityNumberFromOcr(cccdFrontUrl);
        String resolved = firstNonBlank(ocrResult, fallbackIdentityNumber);
        if (resolved == null) {
            throw new ApiException("Không trích xuất được số CCCD từ ảnh. Vui lòng thử lại ảnh rõ nét hơn.",
                    HttpStatus.BAD_REQUEST);
        }

        String normalized = resolved.replaceAll("\\D", "");
        if (!normalized.matches("^\\d{12}$")) {
            throw new ApiException("Số CCCD không hợp lệ sau khi OCR", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String extractIdentityNumberFromOcr(String cccdFrontUrl) {
        if (fptAiApiKey == null || fptAiApiKey.isBlank()) {
            return null;
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("url", cccdFrontUrl);
        body.add("image_url", cccdFrontUrl);

        HttpHeaders headers = new HttpHeaders();
        headers.set("api-key", fptAiApiKey);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        ResponseEntity<JsonNode> response;
        try {
            response = restTemplate.exchange(
                    RequestEntity
                            .post(URI.create(Objects.requireNonNull(fptAiOcrUrl, "FPT OCR url is required")))
                            .headers(headers)
                            .body(body),
                    JsonNode.class);
        } catch (ResourceAccessException ex) {
            log.warn("[KYC][OCR][TIMEOUT] url={}, message={}", fptAiOcrUrl, ex.getMessage());
            return null;
        } catch (Exception ex) {
            log.warn("[KYC][OCR][FAIL] message={}", ex.getMessage());
            return null;
        }

        JsonNode root = response.getBody();
        if (root == null) {
            return null;
        }

        return findFirstCccdCandidate(root, Set.of("id_number", "idnumber", "identity_number", "cccd_number"));
    }

    private String findFirstCccdCandidate(JsonNode node, Set<String> preferredKeys) {
        if (node == null || node.isNull()) {
            return null;
        }

        if (node.isObject()) {
            for (String preferredKey : preferredKeys) {
                JsonNode preferredNode = node.get(preferredKey);
                String candidate = toCccd(preferredNode);
                if (candidate != null) {
                    return candidate;
                }
            }

            var fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                String key = entry.getKey().toLowerCase();
                if (key.contains("id") || key.contains("cccd") || key.contains("number")) {
                    String candidate = toCccd(entry.getValue());
                    if (candidate != null) {
                        return candidate;
                    }
                }
                String nested = findFirstCccdCandidate(entry.getValue(), preferredKeys);
                if (nested != null) {
                    return nested;
                }
            }
            return null;
        }

        if (node.isArray()) {
            for (JsonNode child : node) {
                String candidate = findFirstCccdCandidate(child, preferredKeys);
                if (candidate != null) {
                    return candidate;
                }
            }
        }

        return toCccd(node);
    }

    private String toCccd(JsonNode node) {
        if (node == null || !node.isValueNode()) {
            return null;
        }
        String raw = node.asText("").trim();
        if (raw.isBlank()) {
            return null;
        }
        Matcher matcher = CCCD_PATTERN.matcher(raw.replaceAll("[^0-9]", ""));
        if (matcher.find()) {
            return matcher.group();
        }
        return null;
    }

    private double compareFaceByUrl(String imageUrl1, String imageUrl2) {
        if (faceppApiKey == null || faceppApiKey.isBlank() || faceppApiSecret == null || faceppApiSecret.isBlank()) {
            throw new ApiException("Chưa cấu hình Face++ API key/secret", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        String optimizedImageUrl1 = optimizeImageUrlForFaceCompare(imageUrl1);
        String optimizedImageUrl2 = optimizeImageUrlForFaceCompare(imageUrl2);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("api_key", faceppApiKey);
        body.add("api_secret", faceppApiSecret);
        body.add("image_url1", optimizedImageUrl1);
        body.add("image_url2", optimizedImageUrl2);

        ResponseEntity<Map<String, Object>> response;
        try {
            response = restTemplate.exchange(
                    RequestEntity
                            .post(URI.create(Objects.requireNonNull(faceppCompareUrl, "Face++ compare url is required")))
                            .contentType(MediaType.MULTIPART_FORM_DATA)
                            .body(body),
                    new ParameterizedTypeReference<>() {
                    });
        } catch (HttpClientErrorException ex) {
            String errorBody = ex.getResponseBodyAsString();
            if (errorBody != null && errorBody.contains("IMAGE_FILE_TOO_LARGE")) {
            throw new ApiException(
                "Ảnh CCCD quá lớn cho hệ thống AI. Vui lòng dùng ảnh rõ nét nhưng dung lượng thấp hơn (khuyến nghị < 2MB).",
                HttpStatus.BAD_REQUEST);
            }
            throw new ApiException("Face++ từ chối ảnh đầu vào. Vui lòng kiểm tra ảnh CCCD/selfie và thử lại.",
                HttpStatus.BAD_REQUEST);
        } catch (ResourceAccessException ex) {
            throw new ApiException("Dich vu AI dang phan hoi cham. Vui long thu lai sau.", HttpStatus.GATEWAY_TIMEOUT);
        }

        Map<String, Object> payload = response.getBody();
        if (payload == null) {
            throw new ApiException("Khong nhan duoc phan hoi tu Face++", HttpStatus.BAD_GATEWAY);
        }

        Object errorMessage = payload.get("error_message");
        if (errorMessage != null && !String.valueOf(errorMessage).isBlank()) {
            throw new ApiException("Face++ loi: " + errorMessage, HttpStatus.BAD_GATEWAY);
        }

        Object confidence = payload.get("confidence");
        if (confidence == null) {
            throw new ApiException("Khong lay duoc diem so khop khuon mat", HttpStatus.BAD_GATEWAY);
        }

        try {
            return Double.parseDouble(String.valueOf(confidence));
        } catch (NumberFormatException e) {
            throw new ApiException("Diem so khop khuon mat khong hop le", HttpStatus.BAD_GATEWAY);
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private void persistStage1Snapshot(User user, RegistrationDraft draft) {
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
                .orElseGet(() -> HelperProfile.builder().user(user).build());

        profile.setBio(draft.getBio());
        profile.setExperienceYears(draft.getExperienceYears());
        profile.setHometownName(draft.getHometownName());
        if (profile.getKycStatus() == null) {
            profile.setKycStatus(KycStatus.PENDING);
        }

        helperProfileRepository.save(profile);

        helperWorkingDistrictRepository.deleteByHelper_Id(user.getId());
        helperWorkingDistrictRepository.flush();
        for (com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest wdReq : draft
                .getWorkingDistricts()) {
            helperWorkingDistrictRepository.save(HelperWorkingDistrict.builder()
                    .helper(user)
                    .districtName(wdReq.getName())
                    .districtCode(wdReq.getCode())
                    .provinceCode(wdReq.getProvinceCode())
                    .build());
        }

        helperServiceRepository.deleteByHelper_Id(user.getId());
        helperServiceRepository.flush();
        for (Integer catId : new java.util.HashSet<>(draft.getCategoryIds())) {
            ServiceCategory category = serviceCategoryRepository.findById(catId)
                    .orElseThrow(() -> new RuntimeException("Danh mục không hợp lệ: " + catId));
            helperServiceRepository.save(HelperService.builder()
                    .helper(user)
                    .category(category)
                    .isActive(true)
                    .build());
        }

        user.setDateOfBirth(draft.getDateOfBirth());
        userRepository.save(user);

        Address address = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId())
                .orElse(Address.builder()
                        .user(user)
                        .isDefault(true)
                        .type("HOME")
                        .build());
        address.setAddressDetail(draft.getCurrentAddress());
        address.setProvinceName(draft.getProvinceName());
        address.setProvinceCode(draft.getProvinceCode());
        address.setDistrictName(draft.getDistrictName());
        address.setDistrictCode(draft.getDistrictCode());
        address.setWardName(draft.getWardName());
        address.setWardCode(draft.getWardCode());

        if (draft.getLatitude() != null && draft.getLongitude() != null) {
            address.setLatitude(draft.getLatitude());
            address.setLongitude(draft.getLongitude());
        }

        addressRepository.save(address);
    }

    private RegistrationDraft buildStage1DraftFromPersistedData(User user) {
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId()).orElse(null);
        Address address = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId()).orElse(null);

        if (profile == null || address == null) {
            return null;
        }

        java.util.List<com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest> workingDistricts =
                helperWorkingDistrictRepository.findByHelper_Id(user.getId()).stream()
                        .map(wd -> com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest
                                .builder()
                                .name(wd.getDistrictName())
                                .code(wd.getDistrictCode())
                                .build())
                        .toList();

        java.util.List<Integer> categoryIds = helperServiceRepository.findByHelper_Id(user.getId()).stream()
                .map(hs -> hs.getCategory().getCategoryId())
                .toList();

        RegistrationDraft draft = RegistrationDraft.builder()
                .dateOfBirth(user.getDateOfBirth())
                .hometownName(profile.getHometownName())
                .provinceName(address.getProvinceName())
                .districtName(address.getDistrictName())
                .wardName(address.getWardName())
                .currentAddress(address.getAddressDetail())
                .workingDistricts(workingDistricts)
                .bio(profile.getBio())
                .experienceYears(profile.getExperienceYears())
                .categoryIds(categoryIds)
                .latitude(address.getLatitude())
                .longitude(address.getLongitude())
                .build();

        return draft.isStage1Complete() ? draft : null;
    }

    private String optimizeImageUrlForFaceCompare(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return imageUrl;
        }

        String trimmed = imageUrl.trim();
        if (!trimmed.contains("res.cloudinary.com") || !trimmed.contains("/upload/")) {
            return trimmed;
        }

        if (trimmed.contains("/upload/f_")) {
            return trimmed;
        }

        // Cloudinary dynamic transformation to reduce image size while preserving face details.
        return trimmed.replaceFirst(
                "/upload/",
                "/upload/f_jpg,q_auto:good,w_1200,h_1200,c_limit/");
    }
}

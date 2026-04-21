import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import ProfileService from '../../services/ProfileService';
import CustomerLayout from '../../layouts/CustomerLayout';
import './CustomerPostJobPage.css';
import NotificationModal from '../../components/NotificationModal';

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

/** Số tiền từ API (BigDecimal có thể là number hoặc string) — tránh lỗi toLocaleString / NaN khi hiển thị */
const formatMoneyVnd = (val) => {
    if (val === undefined || val === null || val === '') return '0 ₫';
    const n = typeof val === 'number' && Number.isFinite(val) ? val : Number(val);
    if (!Number.isFinite(n)) return '0 ₫';
    return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
};

const DEFAULT_LATITUDE = 10.762622;
const DEFAULT_LONGITUDE = 106.660172;

const THEME_PRIMARY = '#2F5D50';

/** Khớp JobService.HOURS_PER_SUB_SERVICE: mỗi dịch vụ con trừ 1 giờ khi tính giá nền — FE cộng 1 giờ tổng khi chọn thêm */
const HOURS_PER_SUB_SERVICE = 1;

/** Danh mục dọn dẹp — UX kiểu bTakee, khớp validate backend (JobService) */
const HOME_CLEANING_CATEGORY_ID = 1;
const OFFICE_CLEANING_CATEGORY_ID = 4;

/** Dọn nhà (category 1): backend tối đa 4 giờ; workSize = m² — mids khớp ngưỡng >60/>80/>100 */
const HOME_CLEANING_DURATION_AREA = {
    2: { minM2: 30, maxM2: 50, hint: 'Studio, căn 1 phòng' },
    3: { minM2: 50, maxM2: 70, hint: 'Căn 2 phòng nhỏ' },
    4: { minM2: 70, maxM2: 100, hint: '2–3 phòng (tối đa 4 giờ)' },
};

/** Vệ sinh VP (category 4): map cũ — chỉ dùng tham chiếu; UI mới dùng OFFICE_CLEANING_PRESETS (khớp validate backend) */
const OFFICE_CLEANING_DURATION_AREA = {
    2: { minM2: 40, maxM2: 90, hint: 'VP nhỏ / khu vực chung' },
    3: { minM2: 90, maxM2: 120, hint: 'Nhiều phòng làm việc' },
    4: { minM2: 120, maxM2: 160, hint: 'Diện tích sàn lớn' },
    6: { minM2: 160, maxM2: 220, hint: 'Open space / nhiều tầng' },
    8: { minM2: 200, maxM2: 280, hint: 'Văn phòng rộng' },
};

/** Nhóm diện tích sàn ước lượng — vệ sinh văn phòng (category 4) */
const OFFICE_AREA_BANDS = [
    { id: 'LT200', title: 'Dưới 200 m²', badge: '< 200 m²' },
    { id: 'LT400', title: 'Dưới 400 m²', badge: '< 400 m²' },
    { id: 'LT900', title: 'Dưới 900 m²', badge: '< 900 m²' },
];

const getOfficeBandWorkerLabel = (bandId) => {
    if (bandId === 'LT400') return '2 người';
    if (bandId === 'LT900') return '3 người';
    return '1 người';
};

/**
 * Preset VP: workSize = maxM2 (m²) gửi backend; baseHours = giờ phần chính (tổng ca, khớp JobService cat 4).
 * LT200: 1 người. LT400: 2 người. LT900: 3 người — gói lớn nhất 900 m² tối đa 6 giờ.
 */
const OFFICE_CLEANING_PRESETS = [
    { id: 'o_lt200_a', band: 'LT200', maxM2: 100, baseHours: 2, lineM2: 'Tối đa 100 m²', lineTime: '1 người / 2 giờ' },
    { id: 'o_lt200_b', band: 'LT200', maxM2: 150, baseHours: 3, lineM2: 'Tối đa 150 m²', lineTime: '1 người / 3 giờ' },
    { id: 'o_lt200_c', band: 'LT200', maxM2: 200, baseHours: 4, lineM2: 'Tối đa 200 m²', lineTime: '1 người / 4 giờ' },
    { id: 'o_lt400_a', band: 'LT400', maxM2: 200, baseHours: 4, lineM2: 'Tối đa 200 m²', lineTime: '2 người / 4 giờ' },
    { id: 'o_lt400_b', band: 'LT400', maxM2: 300, baseHours: 6, lineM2: 'Tối đa 300 m²', lineTime: '2 người / 6 giờ' },
    { id: 'o_lt400_c', band: 'LT400', maxM2: 400, baseHours: 8, lineM2: 'Tối đa 400 m²', lineTime: '2 người / 8 giờ' },
    { id: 'o_lt900_a', band: 'LT900', maxM2: 450, baseHours: 4, lineM2: 'Tối đa 450 m²', lineTime: '3 người / 4 giờ' },
    { id: 'o_lt900_b', band: 'LT900', maxM2: 675, baseHours: 5, lineM2: 'Tối đa 675 m²', lineTime: '3 người / 5 giờ' },
    { id: 'o_lt900_c', band: 'LT900', maxM2: 900, baseHours: 6, lineM2: 'Tối đa 900 m²', lineTime: '3 người / 6 giờ' },
];

const getOfficePresetById = (id) =>
    OFFICE_CLEANING_PRESETS.find((p) => p.id === id) || OFFICE_CLEANING_PRESETS[0];

const getOfficePresetsForBand = (bandId) => OFFICE_CLEANING_PRESETS.filter((p) => p.band === bandId);

function resolveInitialOfficePreset(initialData) {
    if (Number(initialData.categoryId) !== OFFICE_CLEANING_CATEGORY_ID) {
        return { presetId: 'o_lt200_a', band: 'LT200' };
    }
    const subs = Array.isArray(initialData.serviceIds) ? initialData.serviceIds.length : 0;
    const total = Number(initialData.durationHours);
    const base = Number.isFinite(total) ? Math.round(total - subs * HOURS_PER_SUB_SERVICE) : 2;
    const ws = Number(initialData.workSize);
    let best = OFFICE_CLEANING_PRESETS[0];
    let bestScore = Infinity;
    for (const p of OFFICE_CLEANING_PRESETS) {
        const wsScore = Number.isFinite(ws) && ws > 0 ? Math.abs(p.maxM2 - ws) : 0;
        const hScore = Math.abs(p.baseHours - base);
        const score = wsScore + hScore * 15;
        if (score < bestScore) {
            bestScore = score;
            best = p;
        }
    }
    return { presetId: best.id, band: best.band };
}

const isHomeCleaningCategoryId = (categoryId) => Number(categoryId) === HOME_CLEANING_CATEGORY_ID;
const isOfficeCleaningCategoryId = (categoryId) => Number(categoryId) === OFFICE_CLEANING_CATEGORY_ID;
const isCleaningCategoryId = (categoryId) =>
    isHomeCleaningCategoryId(categoryId) || isOfficeCleaningCategoryId(categoryId);

const getCleaningAreaMap = (categoryId) =>
    isHomeCleaningCategoryId(categoryId) ? HOME_CLEANING_DURATION_AREA : OFFICE_CLEANING_DURATION_AREA;

const getCleaningAreaMeta = (categoryId, hours) => {
    const map = getCleaningAreaMap(categoryId);
    return map[hours] || null;
};

const getCleaningWorkSizeMid = (categoryId, hours) => {
    const m = getCleaningAreaMeta(categoryId, hours);
    if (!m) return undefined;
    return (m.minM2 + m.maxM2) / 2;
};

/** Nấu ăn (category 2): backend dùng workSize = số món; additionalData.isTaskerShopping → +50k */
const COOKING_CATEGORY_ID = 2;
const isCookingCategoryId = (categoryId) => Number(categoryId) === COOKING_CATEGORY_ID;

/** Đi chợ (category 3): additionalData.isTaskerAdvance → +30k; additionalData.shoppingAmount cộng vào tổng (JobService) */
const SHOPPING_CATEGORY_ID = 3;
const isShoppingCategoryId = (categoryId) => Number(categoryId) === SHOPPING_CATEGORY_ID;

/** Trông trẻ (category 5): workSize = số bé (1 hoặc 2); backend cộng phụ phí bé thứ 2 theo giờ (JobService) */
const CHILDCARE_CATEGORY_ID = 5;
const isChildcareCategoryId = (categoryId) => Number(categoryId) === CHILDCARE_CATEGORY_ID;

/** Làm vườn (category 6): backend workSize = diện tích vườn (m²); validateWorkSizeAndDuration trong JobService */
const GARDENING_CATEGORY_ID = 6;
const isGardeningCategoryId = (categoryId) => Number(categoryId) === GARDENING_CATEGORY_ID;
const GARDEN_AREA_M2_MIN = 1;
const GARDEN_AREA_M2_MAX = 300;

/** Sơn sửa (category 7): backend workSize = số hạng mục; validateWorkSizeAndDuration case 7 (tổng durationHours) */
const PAINT_REPAIR_CATEGORY_ID = 7;
const isPaintRepairCategoryId = (categoryId) => Number(categoryId) === PAINT_REPAIR_CATEGORY_ID;
const PAINT_ITEM_COUNT_MIN = 1;
const PAINT_ITEM_COUNT_MAX = 20;

/** Tổng giờ tối thiểu theo số hạng mục — khớp JobService case 7 */
const minTotalHoursForPaintItemCount = (itemCount) => {
    const w = Math.min(PAINT_ITEM_COUNT_MAX, Math.max(1, Math.round(Number(itemCount)) || 1));
    if (w > 4) return 4;
    if (w > 2) return 3;
    return 2;
};

const getPaintRepairDurationViolationMessage = (itemCount, durationHoursTotal) => {
    const w = Math.min(PAINT_ITEM_COUNT_MAX, Math.max(1, Math.round(Number(itemCount)) || 1));
    const h = Number(durationHoursTotal);
    const need = minTotalHoursForPaintItemCount(w);
    if (!Number.isFinite(h) || h < 1) return null;
    if (h < need) {
        return `Trên 2 hạng mục cần tối thiểu 3 giờ tổng; trên 4 hạng mục cần tối thiểu 4 giờ tổng (hiện ${h}h, cần ≥${need}h)`;
    }
    return null;
};

const isPaintRepairDurationValidForBackend = (itemCount, durationHoursTotal) =>
    getPaintRepairDurationViolationMessage(itemCount, durationHoursTotal) == null;

/** Khớp thông báo JobService.validateWorkSizeAndDuration — cat 6 */
const getGardeningDurationViolationMessage = (gardenM2, durationHoursTotal) => {
    const m = Number(gardenM2);
    const h = Number(durationHoursTotal);
    if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(h) || h <= 0) return null;
    if (m > 80 && h < 4) return 'Diện tích trên 80m2 cần tối thiểu 4 giờ';
    if (m > 50 && h < 3) return 'Diện tích trên 50m2 cần tối thiểu 3 giờ';
    return null;
};

const isGardeningDurationValidForBackend = (gardenM2, durationHoursTotal) =>
    getGardeningDurationViolationMessage(gardenM2, durationHoursTotal) == null;
const CHILDCARE_MAX_CHILDREN = 2;
const CHILDCARE_EXTRA_FEE_PER_CHILD_PER_HOUR_VND = 30000;
/** Lưu trong additionalData — khớp label hiển thị */
const CHILDCARE_AGE_MONTHS_12_TO_6Y = 'MONTHS_12_TO_6Y';
const CHILDCARE_AGE_7_TO_11Y = 'AGE_7_TO_11Y';
const CHILDCARE_AGE_OPTIONS = [
    { value: CHILDCARE_AGE_MONTHS_12_TO_6Y, label: '12 tháng – 6 tuổi' },
    { value: CHILDCARE_AGE_7_TO_11Y, label: '7 tuổi – 11 tuổi' },
];
const CHILDCARE_AGE_SET = new Set(CHILDCARE_AGE_OPTIONS.map((o) => o.value));

const getChildcareAgeLabel = (code) =>
    CHILDCARE_AGE_OPTIONS.find((o) => o.value === code)?.label || '—';

/** Điều khoản dịch vụ trông trẻ theo giờ (hiển thị cho khách) */
const CHILDCARE_HOURLY_TERMS = [
    'Thời lượng và mức phí tính theo số giờ đã đặt; thay đổi giờ cần thống nhất với thợ trước khi làm việc.',
    'Phụ huynh cung cấp đầy đủ thông tin sức khỏe, dị ứng, thuốc đang dùng (nếu có) và ít nhất hai số liên hệ khẩn cấp.',
    'Cô trông trẻ thực hiện công việc trong phạm vi đã mô tả; không thay thế quyết định y tế hay đưa bé ra ngoài nếu chưa được phụ huynh đồng ý rõ ràng.',
    'Gia đình chuẩn bị đồ dùng, thức ăn, tã và không gian an toàn cho bé theo độ tuổi đã khai báo.',
    'Trong ca trông 2 trẻ, mức giá áp dụng tăng khoảng 30% so với ca 1 trẻ (theo chính sách hiển thị); số tiền cụ thể theo báo giá hệ thống.',
    'Mọi tranh chấp hoặc sự cố ngoài phạm vi trông nom theo giờ sẽ được xử lý theo quy định nền tảng và thỏa thuận với thợ.',
];
const SHOPPING_ADVANCE_SERVICE_FEE_VND = 30000;
const SHOPPING_MONEY_MIN_VND = 100;
const SHOPPING_MONEY_MAX_VND = 3_000_000;
/** Giờ lao động nền cố định trên UI đi chợ (không cho khách chọn giờ); vẫn cộng thêm khi có dịch vụ con */
const SHOPPING_DEFAULT_BASE_DURATION_HOURS = 2;
const SHOPPING_ITEM_ROWS_DEFAULT = 5;
const SHOPPING_ITEM_ROWS_MAX = 15;
/** Mức gợi ý tiền ứng (VNĐ) — helper chọn nhanh */
const SHOPPING_SUGGESTED_AMOUNTS = [100_000, 200_000, 300_000, 500_000, 800_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000];

const normalizeShoppingItemNames = (count, existingList) => {
    const n = Math.min(SHOPPING_ITEM_ROWS_MAX, Math.max(1, Math.round(Number(count)) || 1));
    const src = Array.isArray(existingList) ? existingList.map((s) => String(s ?? '')) : [];
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(i < src.length ? src[i] : '');
    return out;
};

/** JobService.validateWorkSizeAndDuration case 2 — áp trên tổng durationHours (gồm giờ dịch vụ con) */
const isCookingDishHoursValid = (dishCount, durationHours) => {
    const d = Number(dishCount);
    const h = Number(durationHours);
    if (!Number.isFinite(d) || d < 1 || !Number.isFinite(h) || h < 1) return false;
    if (d > 5 && h < 4) return false;
    if (d > 3 && h < 3) return false;
    return true;
};

/** Tổng giờ tối thiểu theo số món — dùng clamp base + subs (không đổi backend) */
const minTotalHoursForCookingDishCount = (dishCount) => {
    const d = Math.min(12, Math.max(1, Math.round(Number(dishCount)) || 1));
    if (d > 5) return 4;
    if (d > 3) return 3;
    return 1;
};

/** Khẩu vị — lưu trong additionalData.flavorRegion (backend lưu JSON, không tính thêm phí) */
const COOKING_FLAVOR_OPTIONS = [
    { value: 'BAC', label: 'Bắc' },
    { value: 'TRUNG', label: 'Trung' },
    { value: 'NAM', label: 'Nam' },
];

const COOKING_FLAVOR_SET = new Set(COOKING_FLAVOR_OPTIONS.map((o) => o.value));

const getCookingFlavorLabel = (code) => COOKING_FLAVOR_OPTIONS.find((o) => o.value === code)?.label || code || '—';

const normalizeDishNamesLength = (count, existingList) => {
    const n = Math.min(12, Math.max(1, Math.round(Number(count)) || 1));
    const src = Array.isArray(existingList) ? existingList.map((s) => String(s ?? '')) : [];
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(i < src.length ? src[i] : '');
    return out;
};

const SERVICE_DETAIL_CONFIG = {
    1: {
        equipmentTitle: '🧹 Công cụ, dụng cụ và hóa chất',
        equipmentItems: [
            'Dụng cụ cơ bản: chổi, cây lau nhà, khăn lau, bàn chải vệ sinh',
            'Hóa chất phổ thông: nước lau sàn, tẩy nhà tắm, lau kính, tẩy dầu mỡ nhẹ',
            'Vật tư tiêu hao: găng tay, bao rác, túi gom bụi'
        ],
        scopeTitle: '📌 Chi tiết công việc theo khu vực',
        scopeSections: [
            {
                title: 'Phòng ngủ',
                items: ['Gấp chăn gối gọn gàng', 'Lau bụi tủ, kệ, đầu giường', 'Quét/hút bụi và lau sàn']
            },
            {
                title: 'Phòng tắm',
                items: ['Cọ rửa lavabo, bồn cầu, vòi nước', 'Lau kính, kệ, khu vực tắm', 'Khử mùi và làm sạch sàn']
            },
            {
                title: 'Nhà bếp',
                items: ['Lau bề mặt bếp, bồn rửa, mặt bàn', 'Lau ngoài tủ bếp, thiết bị thường dùng', 'Sắp xếp gọn khu vực nấu']
            },
            {
                title: 'Phòng khách',
                items: ['Lau bụi bàn ghế, kệ tivi', 'Quét/hút bụi và lau sàn', 'Sắp xếp gọn khu vực sinh hoạt']
            },
            {
                title: 'Khu vực chung',
                items: ['Lau hành lang, khu đi lại', 'Thu gom rác và thay túi', 'Xử lý các vết bẩn dễ thấy']
            }
        ]
    },
    2: {
        equipmentTitle: '🍳 Dụng cụ & nguyên liệu cơ bản',
        equipmentItems: [
            'Dụng cụ: nồi, chảo, dao, thớt, muỗng, vá…',
            'Gia vị cơ bản: muối, đường, nước mắm, dầu ăn, tiêu… (thường dùng của gia đình)',
            'Dụng cụ bảo quản: hộp đựng, màng bọc thực phẩm (nếu có sẵn)'
        ],
        scopeTitle: '📌 Công việc nấu ăn điển hình',
        scopeSections: [
            {
                title: 'Chuẩn bị',
                items: ['Trao đổi khẩu phần và món ăn mong muốn', 'Sơ chế nguyên liệu: rửa, cắt, ướp cơ bản']
            },
            {
                title: 'Nấu nướng',
                items: ['Nấu 2–3 món chính theo yêu cầu', 'Chuẩn bị thêm món canh/món xào phù hợp bữa ăn']
            },
            {
                title: 'Hoàn tất & dọn dẹp',
                items: ['Trình bày món ăn gọn gàng', 'Dọn rửa dụng cụ đã sử dụng', 'Lau sạch khu vực bếp đã thao tác']
            }
        ]
    },
    3: {
        equipmentTitle: '🛍️ Dụng cụ & phương tiện đi chợ',
        equipmentItems: [
            'Túi đựng đồ, túi phân loại (nếu có yêu cầu riêng)',
            'Danh sách mua sắm chi tiết từ khách hàng',
            'Tiền mặt / ví điện tử (theo thỏa thuận thanh toán)'
        ],
        scopeTitle: '📌 Quy trình đi chợ',
        scopeSections: [
            {
                title: 'Chuẩn bị',
                items: ['Nhận danh sách món & ngân sách dự kiến', 'Trao đổi thêm về khẩu vị và thương hiệu ưu tiên']
            },
            {
                title: 'Mua sắm',
                items: ['Chọn thực phẩm tươi, còn hạn sử dụng tốt', 'Ưu tiên giá hợp lý, đầy đủ số lượng yêu cầu']
            },
            {
                title: 'Bàn giao',
                items: ['Kiểm đếm lại cùng khách', 'Bàn giao hóa đơn/chứng từ (nếu có)', 'Hỗ trợ xếp đồ vào tủ theo yêu cầu']
            }
        ]
    },
    4: {
        equipmentTitle: '🏢 Dụng cụ vệ sinh văn phòng',
        equipmentItems: [
            'Chổi, cây lau nhà, máy hút bụi (nếu có)', 
            'Khăn lau, dụng cụ lau kính, hóa chất vệ sinh bề mặt',
            'Bao rác, găng tay, dung dịch sát khuẩn tay/nút bấm thang máy'
        ],
        scopeTitle: '📌 Khu vực vệ sinh văn phòng',
        scopeSections: [
            {
                title: 'Khu làm việc',
                items: ['Lau bụi mặt bàn, ghế, vách ngăn', 'Hút bụi/Quét và lau sàn quanh khu vực bàn']
            },
            {
                title: 'Phòng họp',
                items: ['Lau bàn họp, tay nắm cửa', 'Sắp xếp lại ghế và thiết bị cơ bản']
            },
            {
                title: 'Khu pantry',
                items: ['Lau mặt bàn, bồn rửa, kệ để ly', 'Thu gom rác sinh hoạt']
            },
            {
                title: 'WC chung',
                items: ['Vệ sinh bồn cầu, lavabo, gương', 'Lau sàn và bổ sung giấy/xà phòng (nếu có sẵn)']
            }
        ]
    },
    5: {
        equipmentTitle: '👶 Dụng cụ chăm sóc bé',
        equipmentItems: [
            'Dụng cụ của gia đình: bình sữa, chăn gối, xe đẩy…',
            'Đồ chơi, sách truyện an toàn cho bé',
            'Khăn giấy/khăn vải, tã bỉm, quần áo thay (do gia đình chuẩn bị)'
        ],
        scopeTitle: '📌 Công việc trông trẻ thường làm',
        scopeSections: [
            {
                title: 'Ăn uống',
                items: ['Hỗ trợ cho bé ăn theo hướng dẫn', 'Pha sữa/bột theo công thức gia đình']
            },
            {
                title: 'Sinh hoạt',
                items: ['Trông bé chơi, đọc sách, tương tác nhẹ nhàng', 'Thay tã, hỗ trợ bé đi vệ sinh theo độ tuổi']
            },
            {
                title: 'Giấc ngủ & an toàn',
                items: ['Trấn an, ru bé ngủ đúng giờ', 'Đảm bảo khu vực xung quanh bé an toàn, gọn gàng']
            }
        ]
    },
    6: {
        equipmentTitle: '🌿 Dụng cụ làm vườn',
        equipmentItems: [
            'Kéo cắt cành, cuốc nhỏ, xẻng, bình tưới',
            'Bao tay, nón, ủng (nếu cần thiết)',
            'Phân bón hoặc thuốc xử lý (do gia đình chuẩn bị hoặc có thỏa thuận trước)'
        ],
        scopeTitle: '📌 Công việc làm vườn điển hình',
        scopeSections: [
            {
                title: 'Cắt tỉa',
                items: ['Tỉa lá khô, cành thừa', 'Định hình lại tán cây cơ bản']
            },
            {
                title: 'Tưới & bón',
                items: ['Tưới nước theo hướng dẫn của gia đình', 'Bón phân nhẹ cho cây (nếu đã chuẩn bị sẵn)']
            },
            {
                title: 'Dọn dẹp',
                items: ['Thu gom lá rụng, cành cắt', 'Đóng bao rác vườn gọn gàng']
            }
        ]
    },
    7: {
        equipmentTitle: '🔨 Dụng cụ sơn sửa cơ bản',
        equipmentItems: [
            'Con lăn, cọ sơn, bạt che, băng keo giấy',
            'Giấy nhám, dụng cụ trét bột (nếu cần xử lý nhẹ)',
            'Xô, khay sơn, khăn lau vết bẩn'
        ],
        scopeTitle: '📌 Phạm vi công việc sơn sửa',
        scopeSections: [
            {
                title: 'Chuẩn bị bề mặt',
                items: ['Che phủ nội thất xung quanh', 'Lau sạch bụi, xử lý sơ bộ vết bong tróc nhẹ']
            },
            {
                title: 'Sơn/Lăn',
                items: ['Pha loãng sơn theo hướng dẫn trên hộp', 'Lăn 1–2 lớp ở khu vực đã thống nhất']
            },
            {
                title: 'Dọn dẹp sau khi sơn',
                items: ['Gom rác sơn (băng keo, bạt che đã dùng)', 'Lau sơ khu vực bẩn dễ thấy']
            }
        ]
    }
};

const SERVICE_INFOS = {
    1: { name: 'Dọn dẹp nhà cửa', icon: '🏠', color: THEME_PRIMARY },
    2: { name: 'Nấu ăn', icon: '🍳', color: THEME_PRIMARY },
    3: { name: 'Đi chợ', icon: '🛍️', color: THEME_PRIMARY },
    4: { name: 'Vệ sinh văn phòng', icon: '🏢', color: THEME_PRIMARY },
    5: { name: 'Trông trẻ', icon: '👶', color: THEME_PRIMARY },
    6: { name: 'Làm vườn', icon: '🌿', color: THEME_PRIMARY },
    7: { name: 'Sơn sửa', icon: '🔨', color: THEME_PRIMARY },
};

const CustomerPostJobPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const categoryId =
        parseInt(searchParams.get('categoryId') || searchParams.get('serviceId'), 10) || 1;
    const parsedWorkDate = String(searchParams.get('workDate') || '').trim();
    const parsedStartTime = String(searchParams.get('startTime') || '').trim();
    const parsedDurationHoursRaw = Number(searchParams.get('durationHours'));
    const parsedDurationHours =
        Number.isFinite(parsedDurationHoursRaw) && parsedDurationHoursRaw >= 1
            ? Math.min(12, Math.max(1, Math.round(parsedDurationHoursRaw)))
            : 2;
    const parsedServiceIds = String(searchParams.get('serviceIds') || '')
        .split(',')
        .map((item) => Math.round(Number(item)))
        .filter((item) => Number.isFinite(item) && item > 0);
    const parsedServiceIdsKey = parsedServiceIds.join(',');
    const bookingKey = `${categoryId}|${parsedWorkDate}|${parsedStartTime}|${parsedDurationHours}|${parsedServiceIdsKey}`;
    const [categoryName, setCategoryName] = useState('');

    const [notification, setNotification] = useState(null);

    const [step, setStep] = useState(1);

    const [jobData, setJobData] = useState({
        categoryId,
        serviceIds: parsedServiceIds,
        addressId: null,
        addressDetail: '',
        workDate: parsedWorkDate,
        startTime: parsedStartTime,
        durationHours: parsedDurationHours,
        title: '',
        description: '',
        workSize: undefined,
        hasPets: false,
        isPremium: false,
        bringTools: false,
        additionalData: {}
    });

    const [estimateData, setEstimateData] = useState(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const handleSelectAddress = (addressPayload) => {
        setJobData(prev => ({
            ...prev,
            addressId: addressPayload?.addressId ?? prev.addressId,
            addressDetail: addressPayload?.fullAddress || '',
        }));
        setStep(2);
    };

    const handleJobDetailsSubmit = (details, preCalculatedEstimate) => {
        const newData = { ...jobData, ...details };
        setJobData(newData);
        setEstimateData(preCalculatedEstimate);
        setStep(3);
    };

    const handleConfirmAndPay = async () => {
        try {
            setLoadingSubmit(true);
            const payload = {
                categoryId: jobData.categoryId,
                serviceIds: jobData.serviceIds,
                addressId: jobData.addressId,
                workDate: jobData.workDate,
                startTime: jobData.startTime,
                durationHours: jobData.durationHours,
                title: jobData.title,
                description: jobData.description,
                hasPets: Boolean(jobData.hasPets),
                isPremium: Boolean(jobData.isPremium),
                bringTools: Boolean(jobData.bringTools),
                ...(jobData.workSize != null && Number.isFinite(Number(jobData.workSize))
                    ? { workSize: Number(jobData.workSize) }
                    : {}),
                ...(Number(jobData.categoryId) === COOKING_CATEGORY_ID && jobData.additionalData && typeof jobData.additionalData === 'object'
                    ? {
                          additionalData: {
                              isTaskerShopping: Boolean(jobData.additionalData.isTaskerShopping),
                              eaterCount: Math.min(50, Math.max(1, Math.round(Number(jobData.additionalData.eaterCount)) || 1)),
                              dishNames: Array.isArray(jobData.additionalData.dishNames)
                                  ? jobData.additionalData.dishNames
                                  : [],
                              flavorRegion: COOKING_FLAVOR_SET.has(String(jobData.additionalData.flavorRegion || '').toUpperCase())
                                  ? String(jobData.additionalData.flavorRegion).toUpperCase()
                                  : 'NAM',
                              fruitDessert: Boolean(jobData.additionalData.fruitDessert),
                          },
                      }
                    : {}),
                ...(Number(jobData.categoryId) === SHOPPING_CATEGORY_ID && jobData.additionalData && typeof jobData.additionalData === 'object'
                    ? {
                          additionalData: {
                              isTaskerAdvance: Boolean(jobData.additionalData.isTaskerAdvance),
                              ...(Boolean(jobData.additionalData.isTaskerAdvance)
                                  ? {
                                        shoppingAmount: Math.min(
                                            SHOPPING_MONEY_MAX_VND,
                                            Math.max(
                                                SHOPPING_MONEY_MIN_VND,
                                                Math.round(Number(jobData.additionalData.shoppingAmount)) || 0
                                            )
                                        ),
                                    }
                                  : {}),
                              ...(Array.isArray(jobData.additionalData.shoppingItemNames) &&
                              jobData.additionalData.shoppingItemNames.some((s) => String(s ?? '').trim())
                                  ? {
                                        shoppingItemNames: jobData.additionalData.shoppingItemNames
                                            .map((s) => String(s ?? '').trim())
                                            .filter(Boolean),
                                    }
                                  : {}),
                          },
                      }
                    : {}),
                ...(Number(jobData.categoryId) === CHILDCARE_CATEGORY_ID &&
                jobData.additionalData &&
                typeof jobData.additionalData === 'object'
                    ? {
                          additionalData: {
                              ...(CHILDCARE_AGE_SET.has(
                                  String(jobData.additionalData.childAgeBand1 || '').toUpperCase().trim()
                              )
                                  ? {
                                        childAgeBand1: String(
                                            jobData.additionalData.childAgeBand1
                                        )
                                            .toUpperCase()
                                            .trim(),
                                    }
                                  : {}),
                              ...(Number(jobData.workSize) === 2 &&
                              CHILDCARE_AGE_SET.has(
                                  String(jobData.additionalData.childAgeBand2 || '').toUpperCase().trim()
                              )
                                  ? {
                                        childAgeBand2: String(
                                            jobData.additionalData.childAgeBand2
                                        )
                                            .toUpperCase()
                                            .trim(),
                                    }
                                  : {}),
                          },
                      }
                    : {})
            };
            const res = await apiClient.post('/api/v1/jobs', payload);
            setNotification({ type: 'success', message: res?.message || "Đăng tin thành công! Bạn có thể xem tin đã đăng ở phần Quản lý bài đăng." });
            setTimeout(() => {
                navigate('/customer/manage-posts');
            }, 2000);
        } catch (error) {
            console.error("Error creating job", error);
            setNotification({ type: 'error', message: error.message || "Có lỗi xảy ra khi thanh toán và đăng tin." });
        } finally {
            setLoadingSubmit(false);
        }
    };

    useEffect(() => {
        const loadCategoryName = async () => {
            try {
                const res = await ProfileService.getActiveCategories();
                const list = extractPayload(res);
                const matched = Array.isArray(list) ? list.find((item) => Number(item?.id) === categoryId) : null;
                setCategoryName(matched?.name || '');
            } catch {
                setCategoryName('');
            }
        };
        loadCategoryName();
    }, [categoryId]);

    // Khi chatbot navigate ngay trên cùng trang (đổi query URL),
    // state jobData trong parent cần đồng bộ theo lịch vừa chat.
    useEffect(() => {
        // Khi chatbot điều hướng ngay trên cùng trang (chỉ đổi query),
        // cần đưa user về lại bước chọn địa chỉ.
        setStep(1);
        setEstimateData(null);
        setLoadingEstimate(false);
        setLoadingSubmit(false);

        setJobData((prev) => {
            const categoryChanged = prev.categoryId !== categoryId;
            return {
                ...prev,
                categoryId,
                serviceIds: parsedServiceIds,
                workDate: parsedWorkDate,
                startTime: parsedStartTime,
                durationHours: parsedDurationHours,
                ...(categoryChanged
                    ? {
                          workSize: undefined,
                          hasPets: false,
                          isPremium: false,
                          bringTools: false,
                          additionalData: {},
                          title: '',
                          description: ''
                      }
                    : {}),
            };
        });
    }, [
        categoryId,
        parsedServiceIdsKey,
        parsedWorkDate,
        parsedStartTime,
        parsedDurationHours,
    ]);

    const serviceInfo = SERVICE_INFOS[categoryId] || {
        name: categoryName || 'Dịch vụ',
        icon: '✨',
        color: '#2f4858'
    };

    return (
        <CustomerLayout>
            {notification && (
                <NotificationModal
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                    duration={2000}
                />
            )}
            <div className="customer-post-job-page">
                {step === 1 && (
                    <AddressStep
                        key={`address-step-${bookingKey}`}
                        onBack={() => navigate('/customer-dashboard')}
                        onSelectAddress={handleSelectAddress}
                        serviceInfo={serviceInfo}
                    />
                )}
                {step === 2 && (
                    <JobDetailsStep
                        key={`job-details-${bookingKey}`}
                        onBack={() => setStep(1)}
                        onSubmit={handleJobDetailsSubmit}
                        initialData={jobData}
                        serviceInfo={serviceInfo}
                    />
                )}
                {step === 3 && (
                    <ConfirmPayStep
                        key={`confirm-pay-${bookingKey}`}
                        onBack={() => setStep(2)}
                        onConfirm={handleConfirmAndPay}
                        jobData={jobData}
                        estimateData={estimateData}
                        loadingEstimate={loadingEstimate}
                        loadingSubmit={loadingSubmit}
                        serviceInfo={serviceInfo}
                    />
                )}
            </div>
        </CustomerLayout>
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 1: Address Step                                                       */
/* -------------------------------------------------------------------------- */
const AddressStep = ({ onBack, onSelectAddress, serviceInfo }) => {
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [savedError, setSavedError] = useState('');
    const [inUseAddressIds, setInUseAddressIds] = useState([]);

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoadingSuggest, setIsLoadingSuggest] = useState(false);
    const [suggestError, setSuggestError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [addressType, setAddressType] = useState('HOME');

    // ─── Edit/Delete saved addresses (frontend only) ─────────────────────
    const [editTargetAddress, setEditTargetAddress] = useState(null);
    const [editForm, setEditForm] = useState({
        addressDetail: '',
        wardName: '',
        districtName: '',
        provinceName: '',
        type: 'HOME',
        isDefault: false
    });
    const [editError, setEditError] = useState('');
    const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);
    const [isDeletingAddress, setIsDeletingAddress] = useState(false);

    const debounceRef = useRef(null);
    const latestQueryRef = useRef('');

    const normalizedQuery = useMemo(() => String(query || '').trim(), [query]);

    const buildFullAddress = (addr) => {
        if (!addr) return '';
        const parts = [
            addr.addressDetail,
            addr.wardName,
            addr.districtName,
            addr.provinceName
        ].filter(Boolean);
        return parts.join(', ');
    };

    const parseDescriptionToSaveRequest = (description = '') => {
        const parts = String(description)
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);

        if (parts.length < 4) {
            return null;
        }

        const provinceName = parts[parts.length - 1];
        const districtName = parts[parts.length - 2];
        const wardName = parts[parts.length - 3];
        const addressDetail = parts.slice(0, parts.length - 3).join(', ');

        if (!addressDetail || !wardName || !districtName || !provinceName) {
            return null;
        }

        return { addressDetail, wardName, districtName, provinceName };
    };

    const loadSavedAddresses = async () => {
        try {
            setIsLoadingSaved(true);
            setSavedError('');
            const res = await apiClient.get('/api/v1/addresses');
            const list = extractPayload(res);
            setSavedAddresses(Array.isArray(list) ? list : []);
        } catch (err) {
            setSavedAddresses([]);
            setSavedError(err?.message || 'Không thể tải danh sách địa chỉ đã lưu.');
        } finally {
            setIsLoadingSaved(false);
        }
    };

    useEffect(() => {
        loadSavedAddresses();
    }, []);

    useEffect(() => {
        const loadInUseAddressIds = async () => {
            try {
                const res = await apiClient.get('/api/v1/jobs');
                const list = extractPayload(res);
                if (!Array.isArray(list)) {
                    setInUseAddressIds([]);
                    return;
                }
                const ids = Array.from(
                    new Set(
                        list
                            .map((j) => Number(j?.addressId))
                            .filter((id) => Number.isFinite(id) && id > 0)
                    )
                );
                setInUseAddressIds(ids);
            } catch {
                // Không chặn flow đăng tin nếu endpoint jobs đang lỗi.
                setInUseAddressIds([]);
            }
        };
        loadInUseAddressIds();
    }, []);

    const fetchSuggestions = async (input) => {
        if (!input || input.trim().length < 3) {
            setSuggestions([]);
            setSuggestError('');
            return;
        }
        try {
            setIsLoadingSuggest(true);
            setSuggestError('');
            const res = await apiClient.get('/api/v1/addresses/autocomplete', {
                params: { input }
            });
            const list = extractPayload(res);
            setSuggestions(Array.isArray(list) ? list : []);
        } catch (err) {
            setSuggestions([]);
            setSuggestError(err?.message || 'Không thể lấy gợi ý địa chỉ.');
        } finally {
            setIsLoadingSuggest(false);
        }
    };

    useEffect(() => {
        latestQueryRef.current = normalizedQuery;
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(latestQueryRef.current);
        }, 350);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [normalizedQuery]);

    const handlePickSaved = (addr) => {
        const fullAddress = buildFullAddress(addr);
        onSelectAddress({
            addressId: addr?.addressId ?? null,
            fullAddress,
            latitude: addr?.latitude ? Number(addr.latitude) : DEFAULT_LATITUDE,
            longitude: addr?.longitude ? Number(addr.longitude) : DEFAULT_LONGITUDE
        });
    };

    const handlePickSuggestion = async (s) => {
        const placeId = s?.place_id || s?.placeId;
        const description = s?.description || '';
        const parsed = parseDescriptionToSaveRequest(description);

        if (!placeId || !parsed) {
            setSuggestError('Địa chỉ gợi ý chưa đủ thông tin (cần tối thiểu: số nhà/đường, phường, quận, tỉnh). Vui lòng nhập chi tiết hơn.');
            return;
        }

        try {
            setIsSaving(true);
            setSuggestError('');
            const payload = {
                ...parsed,
                placeId,
                type: addressType,
                isDefault: false
            };
            const res = await apiClient.post('/api/v1/addresses', payload);
            const saved = extractPayload(res);
            setSavedAddresses((prev) => {
                const next = [saved, ...(Array.isArray(prev) ? prev : []).filter((a) => a?.addressId !== saved?.addressId)];
                return next;
            });

            const fullAddress = buildFullAddress(saved) || description;
            onSelectAddress({
                addressId: saved?.addressId ?? null,
                fullAddress,
                latitude: saved?.latitude ? Number(saved.latitude) : DEFAULT_LATITUDE,
                longitude: saved?.longitude ? Number(saved.longitude) : DEFAULT_LONGITUDE
            });
        } catch (err) {
            setSuggestError(err?.message || 'Không thể lưu địa chỉ. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const sortedSavedAddresses = useMemo(() => {
        const arr = Array.isArray(savedAddresses) ? [...savedAddresses] : [];
        return arr.sort((a, b) => {
            const aDef = Boolean(a?.isDefault);
            const bDef = Boolean(b?.isDefault);
            if (aDef !== bDef) return aDef ? -1 : 1;
            const aHome = String(a?.type || '').toUpperCase() === 'HOME';
            const bHome = String(b?.type || '').toUpperCase() === 'HOME';
            if (aHome !== bHome) return aHome ? -1 : 1;
            return Number(b?.addressId ?? 0) - Number(a?.addressId ?? 0);
        });
    }, [savedAddresses]);

    const openEditAddress = (addr) => {
        if (!addr) return;
        setEditTargetAddress(addr);
        setEditError('');
        setEditForm({
            addressDetail: addr.addressDetail || '',
            wardName: addr.wardName || '',
            districtName: addr.districtName || '',
            provinceName: addr.provinceName || '',
            type: addr.type || 'HOME',
            isDefault: Boolean(addr.isDefault)
        });
    };

    const closeEditAddress = (force = false) => {
        if (!force && isUpdatingAddress) return; // tránh bấm đóng khi đang submit
        setEditTargetAddress(null);
        setEditError('');
    };

    const handleUpdateAddress = async () => {
        if (!editTargetAddress) return;

        const addressDetail = String(editForm.addressDetail || '').trim();
        const wardName = String(editForm.wardName || '').trim();
        const districtName = String(editForm.districtName || '').trim();
        const provinceName = String(editForm.provinceName || '').trim();

        if (!addressDetail || !wardName || !districtName || !provinceName) {
            setEditError('Vui lòng điền đầy đủ địa chỉ (Số nhà, Phường/Xã, Quận/Huyện, Tỉnh/Thành).');
            return;
        }

        try {
            setIsUpdatingAddress(true);
            setEditError('');

            const payload = {
                addressDetail,
                wardName,
                districtName,
                provinceName,
                type: editForm.type || 'HOME',
                isDefault: Boolean(editForm.isDefault)
            };

            await apiClient.put(`/api/v1/addresses/${editTargetAddress.addressId}`, payload);
            await loadSavedAddresses();
            closeEditAddress(true);
        } catch (err) {
            setEditError(err?.message || 'Không thể cập nhật địa chỉ. Vui lòng thử lại.');
        } finally {
            setIsUpdatingAddress(false);
        }
    };

    const handleDeleteAddress = async (addressId) => {
        if (!addressId) return;
        if (inUseAddressIds.includes(Number(addressId))) {
            setEditError('Không thể xóa địa chỉ này vì đang được dùng trong bài đăng hiện có.');
            return;
        }
        const ok = window.confirm('Bạn có chắc chắn muốn xóa địa chỉ này không?');
        if (!ok) return;

        try {
            setIsDeletingAddress(true);
            setSavedError('');
            setEditError('');

            await apiClient.delete(`/api/v1/addresses/${addressId}`);
            await loadSavedAddresses();

            // Nếu đang sửa đúng địa chỉ đó thì đóng modal
            setEditTargetAddress((prev) => (prev?.addressId === addressId ? null : prev));
        } catch (err) {
            setEditError(err?.message || 'Không thể xóa địa chỉ. Vui lòng thử lại.');
        } finally {
            setIsDeletingAddress(false);
        }
    };

    return (
        <div className="pj-card">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>
                    ←
                </button>
                <div className="pj-header-title">
                    <span className="pj-icon">{serviceInfo.icon}</span>
                    Đăng tin {serviceInfo.name}
                </div>
                <div className="pj-step">Bước 1/3</div>
            </div>

            <div className="pj-body">
                <div className="pj-two-columns">
                    {/* Cột trái - Tìm kiếm địa chỉ mới */}
                    <div className="pj-column">
                        <div className="pj-section">
                            <h3 className="pj-section-title">Tìm địa chỉ mới</h3>

                            <div className="pj-form-group">
                                <label className="pj-label">Địa chỉ thi công</label>
                                <input
                                    type="text"
                                    className="pj-input"
                                    placeholder="Nhập số nhà, đường, phường, quận, thành phố..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                                {isLoadingSuggest && <div className="pj-hint">Đang tìm kiếm...</div>}
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">Loại địa chỉ</label>
                                <select
                                    className="pj-select"
                                    value={addressType}
                                    onChange={(e) => setAddressType(e.target.value)}
                                    disabled={isSaving}
                                >
                                    <option value="HOME">🏠 Nhà riêng</option>
                                    <option value="OFFICE">🏢 Văn phòng</option>
                                    <option value="OTHER">📍 Khác</option>
                                </select>
                            </div>

                            {suggestError && (
                                <div className="pj-error">{suggestError}</div>
                            )}

                            {suggestions.length > 0 && (
                                <div className="pj-suggestions">
                                    <div className="pj-suggestions-header">📍 Kết quả gợi ý</div>
                                    {suggestions.map((sug) => (
                                        <button
                                            type="button"
                                            key={sug.place_id || sug.placeId || sug.description}
                                            className="pj-suggestion-item"
                                            onClick={() => handlePickSuggestion(sug)}
                                            disabled={isSaving}
                                        >
                                            <div className="pj-suggestion-title">{sug.description}</div>
                                            <div className="pj-suggestion-action">
                                                {isSaving ? 'Đang lưu...' : 'Chọn'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!isLoadingSuggest && normalizedQuery.length >= 3 && suggestions.length === 0 && !suggestError && (
                                <div className="pj-hint">
                                    Không tìm thấy địa chỉ phù hợp. Vui lòng nhập chi tiết hơn (phường, quận, thành phố).
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cột phải - Địa chỉ đã lưu */}
                    <div className="pj-column">
                        <div className="pj-section">
                            <div className="pj-section-header">
                                <h3 className="pj-section-title">📌 Địa chỉ đã lưu</h3>
                                <span className="pj-count">{savedAddresses.length}</span>
                            </div>

                            <div className="pj-address-list">
                                {isLoadingSaved && (
                                    <div className="pj-hint">Đang tải địa chỉ...</div>
                                )}

                                {!isLoadingSaved && savedError && (
                                    <div className="pj-error">{savedError}</div>
                                )}

                                {!isLoadingSaved && !savedError && savedAddresses.length === 0 && (
                                    <div className="pj-empty">
                                        <p>📭 Chưa có địa chỉ nào được lưu</p>
                                        <small>Hãy tìm kiếm và thêm địa chỉ mới</small>
                                    </div>
                                )}

                                {!isLoadingSaved && !savedError && savedAddresses.length > 0 && (
                                    <>
                                        {sortedSavedAddresses.map(addr => (
                                            (() => {
                                                const isInUse = inUseAddressIds.includes(Number(addr?.addressId));
                                                return (
                                                    <div
                                                        className="pj-address-item"
                                                        key={addr.addressId}
                                                        onClick={() => handlePickSaved(addr)}
                                                    >
                                                        <div className="pj-address-icon">
                                                            {String(addr.type || '').toUpperCase() === 'HOME' ? '🏠' :
                                                                String(addr.type || '').toUpperCase() === 'OFFICE' ? '🏢' : '📍'}
                                                        </div>
                                                        <div className="pj-address-info">
                                                            <div className="pj-address-name">
                                                                {String(addr.type || '').toUpperCase() === 'HOME'
                                                                    ? 'Nhà riêng'
                                                                    : String(addr.type || '').toUpperCase() === 'OFFICE'
                                                                        ? 'Văn phòng'
                                                                        : 'Địa chỉ khác'}
                                                                {addr.isDefault && <span className="pj-badge">Mặc định</span>}
                                                                {isInUse && <span className="pj-badge pj-badge-inuse">Đang dùng</span>}
                                                            </div>
                                                            <div className="pj-address-detail">{buildFullAddress(addr)}</div>
                                                        </div>
                                                        <div
                                                            className="pj-address-actions"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="pj-address-action-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEditAddress(addr);
                                                                }}
                                                                disabled={isUpdatingAddress || isDeletingAddress}
                                                            >
                                                                ✏️ Sửa
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="pj-address-action-btn pj-address-action-delete"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteAddress(addr.addressId);
                                                                }}
                                                                disabled={isUpdatingAddress || isDeletingAddress || isInUse}
                                                            >
                                                                🗑️ Xóa
                                                            </button>
                                                        </div>
                                                        <div className="pj-address-arrow">→</div>
                                                    </div>
                                                );
                                            })()
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {editTargetAddress && (
                <div className="pj-modal-backdrop" onClick={closeEditAddress} role="dialog" aria-modal="true">
                    <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="pj-modal-header">
                            <h3 className="pj-modal-title">Sửa địa chỉ</h3>
                            <button
                                type="button"
                                className="pj-modal-close"
                                onClick={closeEditAddress}
                                disabled={isUpdatingAddress}
                            >
                                ✕
                            </button>
                        </div>

                        {editError && <div className="pj-error">{editError}</div>}

                        <div className="pj-modal-body">
                            <div className="pj-form-group">
                                <label className="pj-label">Số nhà, tên đường *</label>
                                <input
                                    className="pj-input"
                                    value={editForm.addressDetail}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, addressDetail: e.target.value }))}
                                    disabled={isUpdatingAddress}
                                />
                            </div>

                            <div className="pj-form-row">
                                <div className="pj-form-group half">
                                    <label className="pj-label">Phường/Xã *</label>
                                    <input
                                        className="pj-input"
                                        value={editForm.wardName}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, wardName: e.target.value }))}
                                        disabled={isUpdatingAddress}
                                    />
                                </div>

                                <div className="pj-form-group half">
                                    <label className="pj-label">Quận/Huyện *</label>
                                    <input
                                        className="pj-input"
                                        value={editForm.districtName}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, districtName: e.target.value }))}
                                        disabled={isUpdatingAddress}
                                    />
                                </div>
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">Tỉnh/Thành phố *</label>
                                <input
                                    className="pj-input"
                                    value={editForm.provinceName}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, provinceName: e.target.value }))}
                                    disabled={isUpdatingAddress}
                                />
                            </div>

                            <div className="pj-form-row">
                                <div className="pj-form-group half">
                                    <label className="pj-label">Loại địa chỉ</label>
                                    <select
                                        className="pj-select"
                                        value={editForm.type}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value }))}
                                        disabled={isUpdatingAddress}
                                    >
                                        <option value="HOME">🏠 Nhà riêng</option>
                                        <option value="OFFICE">🏢 Văn phòng</option>
                                        <option value="OTHER">📍 Khác</option>
                                    </select>
                                </div>

                                <div className="pj-form-group half" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <label className="pj-label" style={{ marginBottom: 0 }}>
                                        Địa chỉ mặc định
                                    </label>
                                    <div style={{ marginLeft: 12 }}>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(editForm.isDefault)}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                                            disabled={isUpdatingAddress}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pj-actions">
                            <button
                                type="button"
                                className="pj-btn-primary pj-btn-secondary"
                                onClick={closeEditAddress}
                                disabled={isUpdatingAddress}
                                style={{ marginRight: 10 }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                className="pj-btn-primary"
                                onClick={handleUpdateAddress}
                                disabled={isUpdatingAddress || isDeletingAddress}
                            >
                                {isUpdatingAddress ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 2: Job Details Step                                                   */
/* -------------------------------------------------------------------------- */
const JobDetailsStep = ({ onBack, onSubmit, initialData, serviceInfo }) => {
    const cleaningMode = isCleaningCategoryId(initialData.categoryId);
    const cookingMode = isCookingCategoryId(initialData.categoryId);
    const shoppingMode = isShoppingCategoryId(initialData.categoryId);
    const childcareMode = isChildcareCategoryId(initialData.categoryId);
    const gardeningMode = isGardeningCategoryId(initialData.categoryId);
    const paintRepairMode = isPaintRepairCategoryId(initialData.categoryId);
    const homeCleaningMode = isHomeCleaningCategoryId(initialData.categoryId);
    const officeCleaningMode = isOfficeCleaningCategoryId(initialData.categoryId);
    const detailConfig = SERVICE_DETAIL_CONFIG[initialData.categoryId];

    /** Tổng thời lượng gửi API = base + (số dịch vụ con × HOURS_PER_SUB_SERVICE) — khớp backend */
    const minBaseHoursFloor = homeCleaningMode || officeCleaningMode ? 2 : 1;

    const [workDate, setWorkDate] = useState(initialData.workDate || new Date().toISOString().split('T')[0]);
    const [startHour, setStartHour] = useState(() => {
        const raw = String(initialData?.startTime || '08:00');
        const parts = raw.split(':');
        const hh = Number(parts[0]);
        if (!Number.isFinite(hh)) return 8;
        return Math.max(0, Math.min(23, hh));
    });
    const [startMinute, setStartMinute] = useState(() => {
        const raw = String(initialData?.startTime || '08:00');
        const parts = raw.split(':');
        const mm = Number(parts[1]);
        if (!Number.isFinite(mm)) return 0;
        // Chỉ cho phép chọn 00 hoặc 30.
        if (mm <= 15) return 0;
        return 30;
    });
    const [baseDurationHours, setBaseDurationHours] = useState(() => {
        const homeCleaning = isHomeCleaningCategoryId(initialData.categoryId);
        const officeCleaning = isOfficeCleaningCategoryId(initialData.categoryId);
        const subs = officeCleaning
            ? 0
            : Array.isArray(initialData.serviceIds)
              ? initialData.serviceIds.length
              : 0;
        const cooking = isCookingCategoryId(initialData.categoryId);
        const officeInit = officeCleaning ? resolveInitialOfficePreset(initialData) : null;
        const officeMaxJH = officeInit
            ? officeInit.band === 'LT900'
                ? 6
                : officeInit.band === 'LT400'
                  ? 8
                  : 4
            : 12;
        const maxJH = homeCleaning ? 4 : officeCleaning ? officeMaxJH : 12;

        if (isShoppingCategoryId(initialData.categoryId)) {
            const maxBase = maxJH - subs * HOURS_PER_SUB_SERVICE;
            const minBase = Math.max(1, 1 - subs * HOURS_PER_SUB_SERVICE);
            const target = Math.min(SHOPPING_DEFAULT_BASE_DURATION_HOURS, maxBase);
            if (maxBase < minBase) return minBase;
            return Math.max(minBase, Math.min(maxBase, target));
        }

        if (isPaintRepairCategoryId(initialData.categoryId)) {
            const subs = Array.isArray(initialData.serviceIds) ? initialData.serviceIds.length : 0;
            const w = (() => {
                const x = Number(initialData.workSize);
                if (Number.isFinite(x) && x >= 1) {
                    return Math.min(PAINT_ITEM_COUNT_MAX, Math.max(PAINT_ITEM_COUNT_MIN, Math.round(x)));
                }
                return 2;
            })();
            const minTotal = minTotalHoursForPaintItemCount(w);
            const rawTotalPaint = Number(initialData.durationHours);
            let totalPaint =
                Number.isFinite(rawTotalPaint) && rawTotalPaint >= 1 ? rawTotalPaint : minTotal;
            totalPaint = Math.max(minTotal, Math.min(12, totalPaint));
            let basePaint = Math.round(totalPaint - subs * HOURS_PER_SUB_SERVICE);
            const maxBasePaint = 12 - subs * HOURS_PER_SUB_SERVICE;
            const minBasePaint = Math.max(1, minTotal - subs * HOURS_PER_SUB_SERVICE);
            if (!Number.isFinite(basePaint)) basePaint = minBasePaint;
            if (maxBasePaint < minBasePaint) return minBasePaint;
            return Math.max(minBasePaint, Math.min(maxBasePaint, basePaint));
        }

        const rawTotal = Number(initialData.durationHours);
        const defaultTotal = homeCleaning ? 2 : 2;
        let total = Number.isFinite(rawTotal) && rawTotal >= 1 ? rawTotal : defaultTotal;
        if (homeCleaning) {
            total = Math.min(4, Math.max(2, total));
        } else if (officeCleaning && total < 2) {
            total = 2;
        }
        if (officeCleaning && officeInit) {
            const cap =
                officeInit.band === 'LT900' ? 6 : officeInit.band === 'LT400' ? 8 : 4;
            total = Math.min(cap, total);
        }
        const initDishN = (() => {
            const w = Number(initialData.workSize);
            if (Number.isFinite(w) && w >= 1) return Math.min(12, Math.max(1, Math.round(w)));
            return 3;
        })();
        const initMinTotalRule = cooking
            ? minTotalHoursForCookingDishCount(initDishN)
            : isCleaningCategoryId(initialData.categoryId)
              ? 2
              : 1;
        let base = Math.round(total - subs * HOURS_PER_SUB_SERVICE);
        const maxBase = maxJH - subs * HOURS_PER_SUB_SERVICE;
        const minBase = Math.max(
            homeCleaning || officeCleaning ? 2 : 1,
            initMinTotalRule - subs * HOURS_PER_SUB_SERVICE
        );
        if (!Number.isFinite(base)) base = minBase;
        if (maxBase < minBase) return minBase;
        return Math.max(minBase, Math.min(maxBase, base));
    });
    const [showCleaningEquipmentDetail, setShowCleaningEquipmentDetail] = useState(false);
    const [showCleaningScopeDetail, setShowCleaningScopeDetail] = useState(false);
    const [officePresetId, setOfficePresetId] = useState(() => resolveInitialOfficePreset(initialData).presetId);
    const [officeAreaBand, setOfficeAreaBand] = useState(() => resolveInitialOfficePreset(initialData).band);
    const maxJobDurationHours = useMemo(() => {
        if (homeCleaningMode) return 4;
        if (officeCleaningMode) {
            if (officeAreaBand === 'LT900') return 6;
            if (officeAreaBand === 'LT400') return 8;
            return 4;
        }
        return 12;
    }, [homeCleaningMode, officeCleaningMode, officeAreaBand]);
    const [showChildcareWorkDetail, setShowChildcareWorkDetail] = useState(false);
    const [showChildcareTermsDetail, setShowChildcareTermsDetail] = useState(false);
    const [showGardeningDetail, setShowGardeningDetail] = useState(false);
    const [hasPets, setHasPets] = useState(Boolean(initialData.hasPets));
    const [isPremium, setIsPremium] = useState(Boolean(initialData.isPremium));
    const [bringTools, setBringTools] = useState(Boolean(initialData.bringTools));
    const [title, setTitle] = useState(initialData.title || `Cần tìm người ${serviceInfo.name.toLowerCase()}`);
    const [description, setDescription] = useState(initialData.description || '');
    const [selectedSubServiceIds, setSelectedSubServiceIds] = useState(
        isOfficeCleaningCategoryId(initialData.categoryId)
            ? []
            : Array.isArray(initialData.serviceIds)
              ? initialData.serviceIds
              : []
    );
    const [subServices, setSubServices] = useState([]);
    const [loadingSubServices, setLoadingSubServices] = useState(false);
    const [subServiceError, setSubServiceError] = useState('');
    const [subServiceBlockMessage, setSubServiceBlockMessage] = useState('');

    const [dishCount, setDishCount] = useState(() => {
        const w = Number(initialData.workSize);
        if (Number.isFinite(w) && w >= 1) return Math.min(12, Math.max(1, Math.round(w)));
        return 3;
    });
    const [dishNames, setDishNames] = useState(() => {
        const w = Number(initialData.workSize);
        const count = Number.isFinite(w) && w >= 1 ? Math.min(12, Math.max(1, Math.round(w))) : 3;
        return normalizeDishNamesLength(count, initialData.additionalData?.dishNames);
    });
    const [eaterCount, setEaterCount] = useState(() => {
        const e = Number(initialData.additionalData?.eaterCount);
        if (Number.isFinite(e) && e >= 1) return Math.min(50, Math.round(e));
        return 4;
    });
    const [flavorRegion, setFlavorRegion] = useState(() => {
        const raw = String(initialData.additionalData?.flavorRegion || '').toUpperCase();
        return COOKING_FLAVOR_SET.has(raw) ? raw : 'NAM';
    });
    const [fruitDessert, setFruitDessert] = useState(() => Boolean(initialData.additionalData?.fruitDessert));
    const [isTaskerShopping, setIsTaskerShopping] = useState(() =>
        Boolean(initialData.additionalData && initialData.additionalData.isTaskerShopping)
    );

    const [childCount, setChildCount] = useState(() => {
        const w = Number(initialData.workSize);
        if (Number.isFinite(w) && w >= 1) return Math.min(CHILDCARE_MAX_CHILDREN, Math.max(1, Math.round(w)));
        return 1;
    });
    const normalizeChildcareAgeFromInitial = (raw) => {
        const s = String(raw ?? '').toUpperCase().trim();
        return CHILDCARE_AGE_SET.has(s) ? s : '';
    };
    const [childAgeBand1, setChildAgeBand1] = useState(() =>
        normalizeChildcareAgeFromInitial(initialData.additionalData?.childAgeBand1)
    );
    const [childAgeBand2, setChildAgeBand2] = useState(() =>
        normalizeChildcareAgeFromInitial(initialData.additionalData?.childAgeBand2)
    );

    const [gardenAreaM2, setGardenAreaM2] = useState(() => {
        const w = Number(initialData.workSize);
        if (Number.isFinite(w) && w >= GARDEN_AREA_M2_MIN)
            return Math.min(GARDEN_AREA_M2_MAX, Math.round(w * 10) / 10);
        return 40;
    });

    const [paintItemCount, setPaintItemCount] = useState(() => {
        const w = Number(initialData.workSize);
        if (Number.isFinite(w) && w >= 1) {
            return Math.min(PAINT_ITEM_COUNT_MAX, Math.max(PAINT_ITEM_COUNT_MIN, Math.round(w)));
        }
        return 2;
    });

    const [shoppingItemRowCount, setShoppingItemRowCount] = useState(() => {
        const raw = initialData.additionalData?.shoppingItemNames;
        if (Array.isArray(raw) && raw.some((s) => String(s ?? '').trim()))
            return Math.min(SHOPPING_ITEM_ROWS_MAX, Math.max(3, raw.length));
        return SHOPPING_ITEM_ROWS_DEFAULT;
    });
    const [shoppingItemNames, setShoppingItemNames] = useState(() => {
        const raw = initialData.additionalData?.shoppingItemNames;
        const cnt =
            Array.isArray(raw) && raw.some((s) => String(s ?? '').trim())
                ? Math.min(SHOPPING_ITEM_ROWS_MAX, Math.max(3, raw.length))
                : SHOPPING_ITEM_ROWS_DEFAULT;
        return normalizeShoppingItemNames(cnt, raw);
    });
    const [shoppingMoneyVnd, setShoppingMoneyVnd] = useState(() => {
        const a = Number(initialData.additionalData?.shoppingAmount);
        return Number.isFinite(a) && a >= SHOPPING_MONEY_MIN_VND
            ? Math.min(SHOPPING_MONEY_MAX_VND, Math.round(a))
            : 0;
    });
    const [shoppingMoneyDebounced, setShoppingMoneyDebounced] = useState(() => {
        const a = Number(initialData.additionalData?.shoppingAmount);
        return Number.isFinite(a) && a >= SHOPPING_MONEY_MIN_VND
            ? Math.min(SHOPPING_MONEY_MAX_VND, Math.round(a))
            : 0;
    });

    useEffect(() => {
        if (!shoppingMode) return;
        const v = Math.min(SHOPPING_MONEY_MAX_VND, Math.max(0, Math.round(Number(shoppingMoneyVnd)) || 0));
        const t = setTimeout(() => setShoppingMoneyDebounced(v), 400);
        return () => clearTimeout(t);
    }, [shoppingMode, shoppingMoneyVnd]);

    useEffect(() => {
        if (!shoppingMode) return;
        setShoppingItemNames((prev) => normalizeShoppingItemNames(shoppingItemRowCount, prev));
    }, [shoppingMode, shoppingItemRowCount]);

    const minTotalHoursRule = useMemo(() => {
        if (cookingMode) return minTotalHoursForCookingDishCount(dishCount);
        if (paintRepairMode) {
            const w = Math.min(
                PAINT_ITEM_COUNT_MAX,
                Math.max(PAINT_ITEM_COUNT_MIN, Math.round(Number(paintItemCount)) || 1)
            );
            return minTotalHoursForPaintItemCount(w);
        }
        return cleaningMode ? 2 : 1;
    }, [cookingMode, cleaningMode, paintRepairMode, dishCount, paintItemCount]);

    const [preEstimate, setPreEstimate] = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);

    const selectedSubServiceItems = useMemo(() => {
        if (!Array.isArray(subServices) || !Array.isArray(selectedSubServiceIds)) return [];
        const ids = new Set(selectedSubServiceIds.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
        return subServices.filter((s) => {
            const sid = Number(s?.id ?? s?.serviceId);
            return Number.isFinite(sid) && ids.has(sid);
        });
    }, [subServices, selectedSubServiceIds]);

    const subServiceCount = selectedSubServiceIds.length;

    const paintRepairN = useMemo(
        () =>
            Math.min(
                PAINT_ITEM_COUNT_MAX,
                Math.max(PAINT_ITEM_COUNT_MIN, Math.round(Number(paintItemCount)) || 1)
            ),
        [paintItemCount]
    );

    /** Giờ phần chính tối thiểu khớp backend — tính cùng render, tránh race với useEffect kẹp (lỗi báo giá/hiển thị) */
    const paintRepairEffectiveBaseHours = useMemo(() => {
        if (!paintRepairMode) return null;
        const subs = subServiceCount;
        const minTotal = minTotalHoursForPaintItemCount(paintRepairN);
        const maxB = maxJobDurationHours - subs * HOURS_PER_SUB_SERVICE;
        const minB = Math.max(minBaseHoursFloor, minTotal - subs * HOURS_PER_SUB_SERVICE);
        if (maxB < minB) return minB;
        return minB;
    }, [paintRepairMode, paintRepairN, subServiceCount, maxJobDurationHours, minBaseHoursFloor]);

    const durationHoursRaw =
        paintRepairMode && paintRepairEffectiveBaseHours != null
            ? paintRepairEffectiveBaseHours + subServiceCount * HOURS_PER_SUB_SERVICE
            : baseDurationHours + subServiceCount * HOURS_PER_SUB_SERVICE;
    const durationHours = Math.min(12, Math.max(1, Math.round(Number(durationHoursRaw)) || 1));

    useEffect(() => {
        if (paintRepairMode) return;
        const subs = selectedSubServiceIds.length;
        const maxB = maxJobDurationHours - subs * HOURS_PER_SUB_SERVICE;
        const minB = Math.max(minBaseHoursFloor, minTotalHoursRule - subs * HOURS_PER_SUB_SERVICE);
        if (maxB < minB) return;
        if (shoppingMode) {
            const target = Math.min(SHOPPING_DEFAULT_BASE_DURATION_HOURS, maxB);
            const next = Math.max(minB, Math.min(maxB, target));
            setBaseDurationHours(next);
            return;
        }
        setBaseDurationHours((b) => {
            const n = Number(b);
            if (!Number.isFinite(n)) return minB;
            return Math.max(minB, Math.min(maxB, n));
        });
    }, [
        paintRepairMode,
        shoppingMode,
        selectedSubServiceIds.length,
        maxJobDurationHours,
        minBaseHoursFloor,
        minTotalHoursRule,
    ]);

    useEffect(() => {
        setDishNames((prev) => normalizeDishNamesLength(dishCount, prev));
    }, [dishCount]);

    const cookingAdditionalData = useMemo(() => {
        if (!cookingMode) return null;
        const n = Math.min(12, Math.max(1, Math.round(Number(dishCount))));
        const names = normalizeDishNamesLength(n, dishNames);
        const fr = String(flavorRegion || '').toUpperCase();
        return {
            isTaskerShopping: Boolean(isTaskerShopping),
            eaterCount: Math.min(50, Math.max(1, Math.round(Number(eaterCount)) || 1)),
            dishNames: names,
            flavorRegion: COOKING_FLAVOR_SET.has(fr) ? fr : 'NAM',
            fruitDessert: Boolean(fruitDessert),
        };
    }, [cookingMode, dishCount, dishNames, isTaskerShopping, eaterCount, flavorRegion, fruitDessert]);

    const shoppingEstimateAdditionalData = useMemo(() => {
        if (!shoppingMode) return null;
        const amt = Math.round(Number(shoppingMoneyDebounced)) || 0;
        const advance =
            amt >= SHOPPING_MONEY_MIN_VND && amt <= SHOPPING_MONEY_MAX_VND;
        return {
            isTaskerAdvance: advance,
            ...(advance
                ? { shoppingAmount: Math.min(SHOPPING_MONEY_MAX_VND, Math.max(SHOPPING_MONEY_MIN_VND, amt)) }
                : {}),
        };
    }, [shoppingMode, shoppingMoneyDebounced]);

    useEffect(() => {
        const fetchPrice = async () => {
            if (cookingMode && !isCookingDishHoursValid(dishCount, durationHours)) {
                setPreEstimate(null);
                setLoadingPrice(false);
                return;
            }
            if (
                shoppingMode &&
                !(
                    Number(shoppingMoneyDebounced) >= SHOPPING_MONEY_MIN_VND &&
                    Number(shoppingMoneyDebounced) <= SHOPPING_MONEY_MAX_VND
                )
            ) {
                setPreEstimate(null);
                setLoadingPrice(false);
                return;
            }
            if (gardeningMode) {
                const gm = Number(gardenAreaM2);
                if (!Number.isFinite(gm) || gm < GARDEN_AREA_M2_MIN) {
                    setPreEstimate(null);
                    setLoadingPrice(false);
                    return;
                }
                if (!isGardeningDurationValidForBackend(gardenAreaM2, durationHours)) {
                    setPreEstimate(null);
                    setLoadingPrice(false);
                    return;
                }
            }
            if (paintRepairMode) {
                if (!isPaintRepairDurationValidForBackend(paintRepairN, durationHours)) {
                    setPreEstimate(null);
                    setLoadingPrice(false);
                    return;
                }
            }
            setLoadingPrice(true);
            try {
                const ws = cleaningMode
                    ? officeCleaningMode
                        ? getOfficePresetById(officePresetId).maxM2
                        : getCleaningWorkSizeMid(initialData.categoryId, baseDurationHours)
                    : cookingMode
                      ? Number(dishCount)
                      : childcareMode
                        ? Math.min(CHILDCARE_MAX_CHILDREN, Math.max(1, Math.round(Number(childCount))))
                        : gardeningMode
                          ? Math.min(
                                GARDEN_AREA_M2_MAX,
                                Math.max(GARDEN_AREA_M2_MIN, Number(gardenAreaM2))
                            )
                          : paintRepairMode
                            ? paintRepairN
                            : undefined;
                const res = await apiClient.post('/api/v1/jobs/estimate', {
                    categoryId: initialData.categoryId,
                    serviceIds: selectedSubServiceIds.map((id) => Math.round(Number(id))).filter((id) => Number.isFinite(id)),
                    durationHours: Math.round(Number(durationHours)),
                    isPremium: Boolean(isPremium),
                    ...(ws != null && Number.isFinite(Number(ws)) ? { workSize: Number(ws) } : {}),
                    /* Giá category 2 chỉ phụ thuộc isTaskerShopping; không gửi full additionalData để tránh gọi lại API mỗi lần gõ tên món */
                    ...(cookingMode ? { additionalData: { isTaskerShopping: Boolean(isTaskerShopping) } } : {}),
                    ...(shoppingMode && shoppingEstimateAdditionalData
                        ? { additionalData: shoppingEstimateAdditionalData }
                        : {}),
                });
                setPreEstimate(extractPayload(res));
            } catch (err) {
                console.error("Lỗi tính giá", err);
                setPreEstimate(null);
            } finally {
                setLoadingPrice(false);
            }
        };
        fetchPrice();
    }, [
        durationHours,
        baseDurationHours,
        initialData.categoryId,
        selectedSubServiceIds,
        cleaningMode,
        officeCleaningMode,
        officePresetId,
        cookingMode,
        childcareMode,
        childCount,
        gardeningMode,
        gardenAreaM2,
        paintRepairMode,
        paintItemCount,
        paintRepairN,
        shoppingMode,
        dishCount,
        isTaskerShopping,
        isPremium,
        shoppingEstimateAdditionalData,
    ]);

    useEffect(() => {
        const loadSubServices = async () => {
            if (!initialData.categoryId) return;
            try {
                setLoadingSubServices(true);
                setSubServiceError('');
                const res = await apiClient.get(`/api/helpers/categories/${initialData.categoryId}/services`);
                const list = extractPayload(res);
                setSubServices(Array.isArray(list) ? list : []);
            } catch {
                setSubServices([]);
                setSubServiceError('Chưa lấy được dịch vụ con từ hệ thống.');
            } finally {
                setLoadingSubServices(false);
            }
        };
        loadSubServices();
    }, [initialData.categoryId]);

    const formatCurrency = (val) => formatMoneyVnd(val);

    const handleSubmit = () => {
        const startTime = `${String(startHour).padStart(2, '0')}:${startMinute === 0 ? '00' : '30'}`;
        const wsClean = cleaningMode
            ? officeCleaningMode
                ? getOfficePresetById(officePresetId).maxM2
                : getCleaningWorkSizeMid(initialData.categoryId, baseDurationHours)
            : undefined;
        const dishN = Math.min(12, Math.max(1, Math.round(Number(dishCount))));
        let additionalDataPayload = {};
        if (cookingMode && cookingAdditionalData) {
            additionalDataPayload = cookingAdditionalData;
        } else if (shoppingMode) {
            const amt = Math.round(Number(shoppingMoneyVnd)) || 0;
            const advance = amt >= SHOPPING_MONEY_MIN_VND && amt <= SHOPPING_MONEY_MAX_VND;
            const itemNames = normalizeShoppingItemNames(shoppingItemRowCount, shoppingItemNames)
                .map((s) => String(s || '').trim())
                .filter(Boolean);
            additionalDataPayload = {
                isTaskerAdvance: advance,
                ...(advance
                    ? {
                          shoppingAmount: Math.min(
                              SHOPPING_MONEY_MAX_VND,
                              Math.max(SHOPPING_MONEY_MIN_VND, amt)
                          ),
                      }
                    : {}),
                ...(itemNames.length > 0 ? { shoppingItemNames: itemNames } : {}),
            };
        } else if (childcareMode) {
            const n = Math.min(CHILDCARE_MAX_CHILDREN, Math.max(1, Math.round(Number(childCount))));
            additionalDataPayload = {
                childAgeBand1: childAgeBand1,
                ...(n === 2 ? { childAgeBand2: childAgeBand2 } : {}),
            };
        }
        const durationHoursInt = Math.min(12, Math.max(1, Math.round(Number(durationHours)) || 1));
        const serviceIdsInt = selectedSubServiceIds
            .map((id) => Math.round(Number(id)))
            .filter((id) => Number.isFinite(id));
        onSubmit(
            {
                serviceIds: serviceIdsInt,
                workDate,
                startTime,
                durationHours: durationHoursInt,
                title,
                description,
                hasPets,
                isPremium,
                bringTools,
                ...(cleaningMode && wsClean != null ? { workSize: wsClean } : {}),
                ...(cookingMode ? { workSize: dishN } : {}),
                ...(childcareMode
                    ? {
                          workSize: Math.min(
                              CHILDCARE_MAX_CHILDREN,
                              Math.max(1, Math.round(Number(childCount)))
                          ),
                      }
                    : {}),
                ...(gardeningMode
                    ? {
                          workSize: Math.min(
                              GARDEN_AREA_M2_MAX,
                              Math.max(GARDEN_AREA_M2_MIN, Number(gardenAreaM2))
                          ),
                      }
                    : {}),
                ...(paintRepairMode ? { workSize: paintRepairN } : {}),
                additionalData: additionalDataPayload,
            },
            preEstimate
        );
    };

    const applyMainDurationHours = (h) => {
        const subs = selectedSubServiceIds.length;
        const maxBase = maxJobDurationHours - subs * HOURS_PER_SUB_SERVICE;
        const minB = Math.max(minBaseHoursFloor, minTotalHoursRule - subs * HOURS_PER_SUB_SERVICE);
        const v = Math.round(Number(h));
        const next = Number.isFinite(v) ? Math.max(minB, Math.min(maxBase, v)) : minB;
        setSubServiceBlockMessage('');
        setBaseDurationHours(next);
    };

    const selectOfficeBand = (bandId) => {
        setOfficeAreaBand(bandId);
        const list = getOfficePresetsForBand(bandId);
        const first = list[0];
        if (first) {
            setOfficePresetId(first.id);
            applyMainDurationHours(first.baseHours);
        }
    };

    const selectOfficePreset = (preset) => {
        setOfficePresetId(preset.id);
        setOfficeAreaBand(preset.band);
        applyMainDurationHours(preset.baseHours);
    };

    const toggleSubService = (serviceId) => {
        const sid = Number(serviceId);
        if (!Number.isFinite(sid)) return;
        const isSelected = selectedSubServiceIds.includes(sid);
        const subs = selectedSubServiceIds.length;

        if (!isSelected) {
            if (baseDurationHours + (subs + 1) * HOURS_PER_SUB_SERVICE > maxJobDurationHours) {
                setSubServiceBlockMessage(
                    homeCleaningMode || officeCleaningMode
                        ? `${officeCleaningMode ? 'Vệ sinh VP' : 'Dọn nhà'} tối đa ${maxJobDurationHours} giờ tổng. Mỗi dịch vụ con cộng thêm ${HOURS_PER_SUB_SERVICE} giờ — không thể thêm mục này (hãy giảm giờ phần chính trước).`
                        : cookingMode
                          ? `Nấu ăn tối đa ${maxJobDurationHours} giờ tổng. Mỗi dịch vụ con cộng thêm ${HOURS_PER_SUB_SERVICE} giờ — không thể thêm mục này (hãy giảm giờ phần chính trước).`
                          : childcareMode
                            ? `Trông trẻ tối đa ${maxJobDurationHours} giờ tổng. Mỗi dịch vụ con cộng thêm ${HOURS_PER_SUB_SERVICE} giờ — không thể thêm mục này (hãy giảm giờ phần chính trước).`
                          : gardeningMode
                            ? `Làm vườn tối đa ${maxJobDurationHours} giờ tổng. Mỗi dịch vụ con cộng thêm ${HOURS_PER_SUB_SERVICE} giờ — không thể thêm mục này (hãy giảm giờ phần chính trước).`
                          : paintRepairMode
                            ? `Sơn sửa tối đa ${maxJobDurationHours} giờ tổng. Mỗi dịch vụ con cộng thêm ${HOURS_PER_SUB_SERVICE} giờ — không thể thêm mục này (hãy tăng hạng mục hoặc bớt dịch vụ con).`
                          : shoppingMode
                            ? `Đi chợ tối đa ${maxJobDurationHours} giờ tổng (gói cố định ${SHOPPING_DEFAULT_BASE_DURATION_HOURS} giờ + dịch vụ con). Không thể thêm mục — hãy bớt dịch vụ con nếu cần.`
                            : `Tổng thời lượng tối đa ${maxJobDurationHours} giờ. Thêm dịch vụ con cần +${HOURS_PER_SUB_SERVICE} giờ — đã đạt giới hạn.`
                );
                return;
            }
            setSubServiceBlockMessage('');
            setSelectedSubServiceIds((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
            return;
        }

        setSubServiceBlockMessage('');
        setSelectedSubServiceIds((prev) => prev.filter((id) => id !== sid));
    };

    const startTime = `${String(startHour).padStart(2, '0')}:${startMinute === 0 ? '00' : '30'}`;
    const cookingDishN = Math.min(12, Math.max(1, Math.round(Number(dishCount))));
    const cookingNamesForValid = normalizeDishNamesLength(cookingDishN, dishNames);
    const cookingHasAtLeastOneDishName = cookingNamesForValid.some((s) => String(s || '').trim().length > 0);

    const cookingFormOk =
        !cookingMode ||
        (Number.isFinite(Number(dishCount)) &&
            Number(dishCount) >= 1 &&
            Number(dishCount) <= 12 &&
            isCookingDishHoursValid(dishCount, durationHours) &&
            Number.isFinite(Number(eaterCount)) &&
            Number(eaterCount) >= 1 &&
            Number(eaterCount) <= 50 &&
            cookingHasAtLeastOneDishName);

    const shoppingItemsFilled = useMemo(() => {
        if (!shoppingMode) return true;
        return normalizeShoppingItemNames(shoppingItemRowCount, shoppingItemNames).some(
            (s) => String(s || '').trim().length > 0
        );
    }, [shoppingMode, shoppingItemRowCount, shoppingItemNames]);

    const shoppingFormOk =
        !shoppingMode ||
        (shoppingItemsFilled &&
            Number(shoppingMoneyVnd) >= SHOPPING_MONEY_MIN_VND &&
            Number(shoppingMoneyVnd) <= SHOPPING_MONEY_MAX_VND);

    const childcareFormOk =
        !childcareMode ||
        (Number.isFinite(Number(childCount)) &&
            Number(childCount) >= 1 &&
            Number(childCount) <= CHILDCARE_MAX_CHILDREN &&
            CHILDCARE_AGE_SET.has(childAgeBand1) &&
            (Number(childCount) === 1 || CHILDCARE_AGE_SET.has(childAgeBand2)));

    const gardeningFormOk =
        !gardeningMode ||
        (Number.isFinite(Number(gardenAreaM2)) &&
            Number(gardenAreaM2) >= GARDEN_AREA_M2_MIN &&
            Number(gardenAreaM2) <= GARDEN_AREA_M2_MAX &&
            isGardeningDurationValidForBackend(gardenAreaM2, durationHours));

    const paintRepairFormOk =
        !paintRepairMode ||
        (Number.isFinite(Number(paintItemCount)) &&
            Number(paintItemCount) >= PAINT_ITEM_COUNT_MIN &&
            Number(paintItemCount) <= PAINT_ITEM_COUNT_MAX &&
            isPaintRepairDurationValidForBackend(paintRepairN, durationHours));

    const isFormValid =
        initialData.addressId &&
        workDate &&
        startTime &&
        durationHours > 0 &&
        (!cleaningMode || durationHours >= 2) &&
        cookingFormOk &&
        shoppingFormOk &&
        childcareFormOk &&
        gardeningFormOk &&
        paintRepairFormOk;

    const durationOptions = homeCleaningMode
        ? [2, 3, 4]
        : officeCleaningMode
          ? [2, 3, 4, 5, 6, 8]
          : [1, 2, 3, 4, 6, 8];

    const durationOptionsWithCurrent = useMemo(() => {
        if (cleaningMode) return durationOptions;
        const set = new Set(durationOptions);
        const d = Number(baseDurationHours);
        if (Number.isFinite(d) && d >= 1 && d <= 12 && !set.has(d)) {
            return [...durationOptions, d].sort((a, b) => a - b);
        }
        return durationOptions;
    }, [cleaningMode, durationOptions, baseDurationHours]);

    const areaMeta = useMemo(() => {
        if (!cleaningMode) return null;
        if (officeCleaningMode) {
            const p = getOfficePresetById(officePresetId);
            return {
                minM2: p.maxM2,
                maxM2: p.maxM2,
                hint: `${p.lineM2} · ${p.lineTime} · workSize backend: ${p.maxM2} m²`,
            };
        }
        return getCleaningAreaMeta(initialData.categoryId, baseDurationHours);
    }, [cleaningMode, officeCleaningMode, officePresetId, initialData.categoryId, baseDurationHours]);

    return (
        <div className="pj-card">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>
                    ←
                </button>
                <div className="pj-header-title">
                    <span className="pj-icon">{serviceInfo.icon}</span>
                    Đăng tin {serviceInfo.name}
                </div>
                <div className="pj-step">Bước 2/3</div>
            </div>

            <div className="pj-body">
                <div className="pj-two-columns">
                    {/* Cột trái - Form nhập thông tin */}
                    <div className="pj-column">
                        <div className="pj-section">
                            <h3 className="pj-section-title">📋 Thông tin công việc</h3>

                            <div className="pj-form-row">
                                <div className="pj-form-group half">
                                    <label className="pj-label">📅 Ngày làm việc *</label>
                                    <input
                                        type="date"
                                        className="pj-input"
                                        value={workDate}
                                        onChange={e => setWorkDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="pj-form-group half">
                                    <label className="pj-label">⏰ Giờ bắt đầu *</label>
                                    <div className="pj-time-dropdowns" aria-label="Chọn giờ bắt đầu (phút chỉ 00 hoặc 30)">
                                        <div className="pj-time-dropdown">
                                            <div className="pj-time-dropdown-label">Giờ</div>
                                            <select
                                                className="pj-select pj-time-select"
                                                value={startHour}
                                                onChange={(e) => setStartHour(Number(e.target.value))}
                                            >
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <option key={i} value={i}>
                                                        {String(i).padStart(2, '0')}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="pj-time-dropdown">
                                            <div className="pj-time-dropdown-label">Phút</div>
                                            <select
                                                className="pj-select pj-time-select"
                                                value={startMinute}
                                                onChange={(e) => setStartMinute(Number(e.target.value))}
                                            >
                                                <option value={0}>00</option>
                                                <option value={30}>30</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {shoppingMode ? (
                                <div className="pj-form-group pj-cooking-block">
                                    <label className="pj-label">🛒 Sản phẩm cần mua *</label>
                                    <p className="pj-cleaning-lead pj-cooking-hint">
                                        Nhập tên từng món hàng (thực phẩm, đồ dùng…). Thợ dùng danh sách này khi đi chợ.
                                    </p>
                                    <div className="pj-dish-name-list">
                                        {normalizeShoppingItemNames(shoppingItemRowCount, shoppingItemNames).map((name, idx) => (
                                            <label key={`shop-item-${idx}`} className="pj-dish-name-row">
                                                <span className="pj-dish-name-label">Mục {idx + 1}</span>
                                                <input
                                                    type="text"
                                                    className="pj-input"
                                                    maxLength={200}
                                                    value={name}
                                                    placeholder={`Ví dụ: Sản phẩm ${idx + 1}…`}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setShoppingItemNames((prev) => {
                                                            const next = normalizeShoppingItemNames(shoppingItemRowCount, prev);
                                                            next[idx] = v;
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pj-form-row" style={{ marginTop: 10, alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            className="pj-detail-toggle"
                                            disabled={shoppingItemRowCount >= SHOPPING_ITEM_ROWS_MAX}
                                            onClick={() =>
                                                setShoppingItemRowCount((n) =>
                                                    Math.min(SHOPPING_ITEM_ROWS_MAX, n + 1)
                                                )
                                            }
                                        >
                                            + Thêm dòng
                                        </button>
                                        <button
                                            type="button"
                                            className="pj-detail-toggle"
                                            style={{ marginLeft: 8 }}
                                            disabled={shoppingItemRowCount <= 3}
                                            onClick={() =>
                                                setShoppingItemRowCount((n) => Math.max(3, n - 1))
                                            }
                                        >
                                            Bớt dòng
                                        </button>
                                    </div>
                                    {!shoppingItemsFilled ? (
                                        <div className="pj-error" role="alert" style={{ marginTop: 8 }}>
                                            Vui lòng nhập ít nhất một tên sản phẩm.
                                        </div>
                                    ) : null}

                                    <label className="pj-label" style={{ marginTop: 20 }}>
                                        Tiền hàng ứng trước (ước tính) *
                                    </label>
                                    <p className="pj-cleaning-lead pj-cooking-hint">
                                        Chọn mức gợi ý hoặc nhập số khác từ{' '}
                                        <strong>{SHOPPING_MONEY_MIN_VND.toLocaleString('vi-VN')} ₫</strong> đến{' '}
                                        <strong>{SHOPPING_MONEY_MAX_VND.toLocaleString('vi-VN')} ₫</strong>. Hệ thống cộng phí ứng
                                        tiền <strong>+{SHOPPING_ADVANCE_SERVICE_FEE_VND.toLocaleString('vi-VN')} ₫</strong> vào tổng
                                        dự kiến (khớp backend).
                                    </p>
                                    <div className="pj-duration-group pj-shopping-suggest-chips" role="group" aria-label="Mức tiền gợi ý">
                                        {SHOPPING_SUGGESTED_AMOUNTS.map((amt) => {
                                            const active = Number(shoppingMoneyVnd) === amt;
                                            return (
                                                <button
                                                    key={amt}
                                                    type="button"
                                                    className={`pj-duration-btn ${active ? 'active' : ''}`}
                                                    style={
                                                        active
                                                            ? { backgroundColor: serviceInfo.color, borderColor: serviceInfo.color }
                                                            : {}
                                                    }
                                                    onClick={() => setShoppingMoneyVnd(amt)}
                                                >
                                                    {amt >= 1_000_000
                                                        ? `${amt / 1_000_000} tr`.replace(/\.0$/, '')
                                                        : `${amt / 1000}k`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="pj-form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                                        <label className="pj-label" htmlFor="pj-shopping-money-custom">
                                            Hoặc nhập số tiền khác (VNĐ)
                                        </label>
                                        <input
                                            id="pj-shopping-money-custom"
                                            type="number"
                                            className="pj-input pj-input--narrow"
                                            min={SHOPPING_MONEY_MIN_VND}
                                            max={SHOPPING_MONEY_MAX_VND}
                                            step={1000}
                                            value={shoppingMoneyVnd || ''}
                                            onChange={(e) => {
                                                const t = e.target.value;
                                                if (t === '') {
                                                    setShoppingMoneyVnd(0);
                                                    return;
                                                }
                                                const v = Number(t);
                                                if (!Number.isFinite(v)) return;
                                                setShoppingMoneyVnd(
                                                    Math.min(
                                                        SHOPPING_MONEY_MAX_VND,
                                                        Math.max(0, Math.round(v))
                                                    )
                                                );
                                            }}
                                        />
                                        {shoppingMode &&
                                        (Number(shoppingMoneyVnd) < SHOPPING_MONEY_MIN_VND ||
                                            Number(shoppingMoneyVnd) > SHOPPING_MONEY_MAX_VND) ? (
                                            <div className="pj-error" role="alert" style={{ marginTop: 8 }}>
                                                {Number(shoppingMoneyVnd) > SHOPPING_MONEY_MAX_VND
                                                    ? `Tối đa ${SHOPPING_MONEY_MAX_VND.toLocaleString('vi-VN')} ₫.`
                                                    : `Tối thiểu ${SHOPPING_MONEY_MIN_VND.toLocaleString('vi-VN')} ₫ để bật ứng tiền và tính giá.`}
                                            </div>
                                        ) : null}
                                    </div>

                                    <label className="pj-switch-item pj-switch-item--block" style={{ marginTop: 16 }}>
                                        <input
                                            type="checkbox"
                                            checked={isPremium}
                                            onChange={(e) => setIsPremium(e.target.checked)}
                                        />
                                        <span>
                                            Gói cao cấp — phụ phí{' '}
                                            <strong className="pj-cooking-fee-tag">+50.000 ₫</strong> (áp dụng mọi danh mục)
                                        </span>
                                    </label>
                                </div>
                            ) : null}

                            {shoppingMode ? (
                                <div className="pj-form-group">
                                    <label className="pj-label">⏱️ Thời lượng</label>
                                    <p className="pj-cleaning-lead pj-cooking-hint" style={{ marginBottom: 0 }}>
                                        Gói đi chợ dùng <strong>{SHOPPING_DEFAULT_BASE_DURATION_HOURS} giờ</strong> phần chính (cố định,
                                        không chọn trên app). Tổng gửi hệ thống = {SHOPPING_DEFAULT_BASE_DURATION_HOURS} giờ + số
                                        dịch vụ con × {HOURS_PER_SUB_SERVICE} giờ (tối đa {maxJobDurationHours} giờ).
                                    </p>
                                </div>
                            ) : null}

                            {!shoppingMode ? (
                            <div className="pj-form-group">
                                <label className="pj-label">
                                    {paintRepairMode
                                        ? '🔨 Số hạng mục sơn sửa (workSize) *'
                                        : '⏱️ Thời lượng làm việc *'}
                                </label>
                                {cleaningMode ? (
                                    <div className="pj-cleaning-duration">
                                        {homeCleaningMode ? (
                                            <>
                                                <p className="pj-cleaning-lead">
                                                    Chọn thời gian theo diện tích căn — tối thiểu <strong>2 giờ</strong>, tối đa{' '}
                                                    <strong>4 giờ</strong> (theo quy định dịch vụ dọn nhà).
                                                </p>
                                                <div className="pj-cleaning-cards">
                                                    {durationOptions.map((h) => {
                                                        const meta = getCleaningAreaMeta(initialData.categoryId, h);
                                                        const active = baseDurationHours === h;
                                                        return (
                                                            <button
                                                                key={h}
                                                                type="button"
                                                                className={`pj-cleaning-card ${active ? 'active' : ''}`}
                                                                style={
                                                                    active
                                                                        ? {
                                                                              borderColor: serviceInfo.color,
                                                                              boxShadow: `0 0 0 2px ${serviceInfo.color}33`,
                                                                          }
                                                                        : {}
                                                                }
                                                                onClick={() => applyMainDurationHours(h)}
                                                            >
                                                                <span className="pj-cleaning-card-hours">{h} giờ</span>
                                                                {meta ? (
                                                                    <>
                                                                        <span className="pj-cleaning-card-m2">
                                                                            {meta.minM2}–{meta.maxM2} m²
                                                                        </span>
                                                                        <span className="pj-cleaning-card-hint">{meta.hint}</span>
                                                                    </>
                                                                ) : null}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {areaMeta ? (
                                                    <div className="pj-cleaning-selected">
                                                        <span className="pj-cleaning-selected-icon" aria-hidden>
                                                            📐
                                                        </span>
                                                        <div>
                                                            <div className="pj-cleaning-selected-title">
                                                                Diện tích gợi ý với {baseDurationHours} giờ phần chính
                                                            </div>
                                                            <div className="pj-cleaning-selected-text">
                                                                Khoảng <strong>
                                                                    {areaMeta.minM2}–{areaMeta.maxM2} m²
                                                                </strong>
                                                                {areaMeta.hint ? ` · ${areaMeta.hint}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : (
                                            <>
                                                <p className="pj-cleaning-lead">
                                                    <strong>Vệ sinh văn phòng:</strong> chọn nhóm diện tích sàn ước lượng, sau đó chọn gói
                                                    thời lượng. Backend nhận <strong>workSize</strong> = m² tối đa của gói và kiểm tra với{' '}
                                                    <strong>giờ làm việc</strong>: trên <strong>60 m²</strong> cần tối thiểu{' '}
                                                    <strong>2 giờ</strong>, trên <strong>100 m²</strong> cần <strong>3 giờ</strong>, trên{' '}
                                                    <strong>150 m²</strong> cần <strong>4 giờ</strong> — khớp backend (JobService). Nhóm{' '}
                                                    <strong>&lt; 400 m²</strong> dùng <strong>2 người</strong>; nhóm <strong>&lt; 900 m²</strong>{' '}
                                                    dùng <strong>3 người</strong> (tối đa <strong>6 giờ</strong> cho gói 900 m²).
                                                </p>
                                                <label className="pj-label" style={{ marginTop: 12, display: 'block' }}>
                                                    📐 Khoảng diện tích văn phòng
                                                </label>
                                                <div
                                                    className="pj-duration-group"
                                                    style={{ marginTop: 8 }}
                                                    role="group"
                                                    aria-label="Chọn nhóm diện tích"
                                                >
                                                    {OFFICE_AREA_BANDS.map((b) => {
                                                        const active = officeAreaBand === b.id;
                                                        return (
                                                            <button
                                                                key={b.id}
                                                                type="button"
                                                                className={`pj-duration-btn ${active ? 'active' : ''}`}
                                                                style={
                                                                    active
                                                                        ? {
                                                                              backgroundColor: serviceInfo.color,
                                                                              borderColor: serviceInfo.color,
                                                                          }
                                                                        : {}
                                                                }
                                                                onClick={() => selectOfficeBand(b.id)}
                                                            >
                                                                <span style={{ display: 'block', fontWeight: 700 }}>{b.badge}</span>
                                                                <span style={{ display: 'block', fontSize: '0.85em', opacity: 0.9 }}>
                                                                    {b.title}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <label className="pj-label" style={{ marginTop: 20, display: 'block' }}>
                                                    ⏱️ Gói thời lượng & diện tích ({getOfficeBandWorkerLabel(officeAreaBand)})
                                                </label>
                                                <p className="pj-cleaning-lead pj-cooking-hint" style={{ marginTop: 4, marginBottom: 12 }}>
                                                    Mỗi thẻ đặt <strong>giờ làm việc</strong> và mức <strong>m²</strong> gửi lên API (tối đa{' '}
                                                    {maxJobDurationHours} giờ cho nhóm đang chọn).
                                                </p>
                                                <div className="pj-cleaning-cards">
                                                    {getOfficePresetsForBand(officeAreaBand).map((preset) => {
                                                        const active = officePresetId === preset.id;
                                                        return (
                                                            <button
                                                                key={preset.id}
                                                                type="button"
                                                                className={`pj-cleaning-card ${active ? 'active' : ''}`}
                                                                style={
                                                                    active
                                                                        ? {
                                                                              borderColor: serviceInfo.color,
                                                                              boxShadow: `0 0 0 2px ${serviceInfo.color}33`,
                                                                          }
                                                                        : {}
                                                                }
                                                                onClick={() => selectOfficePreset(preset)}
                                                            >
                                                                <span className="pj-cleaning-card-hours">{preset.lineM2}</span>
                                                                <span className="pj-cleaning-card-m2">{preset.lineTime}</span>
                                                                <span className="pj-cleaning-card-hint">
                                                                    {preset.baseHours} giờ làm việc
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {areaMeta ? (
                                                    <div className="pj-cleaning-selected">
                                                        <span className="pj-cleaning-selected-icon" aria-hidden>
                                                            ✓
                                                        </span>
                                                        <div>
                                                            <div className="pj-cleaning-selected-title">Gói đang chọn</div>
                                                            <div className="pj-cleaning-selected-text">
                                                                {areaMeta.hint}
                                                                <div style={{ marginTop: 6 }}>
                                                                    Thời lượng hiện tại: <strong>{durationHours} giờ</strong>.
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {cookingMode ? (
                                            <p className="pj-cleaning-lead pj-cooking-hint" style={{ marginBottom: 10 }}>
                                                Số giờ trên thẻ là <strong>phần chính (nấu)</strong>. Mỗi dịch vụ con (mục bên dưới)
                                                cộng <strong>+{HOURS_PER_SUB_SERVICE} giờ</strong> vào <strong>tổng</strong> (tối đa{' '}
                                                {maxJobDurationHours} giờ). Quy tắc theo số món áp dụng trên <strong>tổng giờ</strong>{' '}
                                                (phần chính + dịch vụ con), khớp backend.
                                            </p>
                                        ) : null}
                                        {gardeningMode && !cookingMode ? (
                                            <p className="pj-cleaning-lead pj-cooking-hint" style={{ marginBottom: 10 }}>
                                                <strong>Làm vườn:</strong> backend nhận <strong>workSize</strong> = diện tích vườn (m²) và
                                                kiểm tra với <strong>tổng giờ</strong> — trên <strong>50 m²</strong> cần tối thiểu{' '}
                                                <strong>3 giờ tổng</strong>, trên <strong>80 m²</strong> cần tối thiểu{' '}
                                                <strong>4 giờ tổng</strong> (phần chính + dịch vụ con).
                                            </p>
                                        ) : null}
                                        {paintRepairMode && !cookingMode ? (
                                            <>
                                                <p className="pj-cleaning-lead pj-cooking-hint" style={{ marginBottom: 10 }}>
                                                    <strong>Sơn sửa:</strong> chọn <strong>số hạng mục</strong> (ví dụ: 1 phòng + vá tường + cửa
                                                    = 3). Backend nhận <strong>workSize</strong> = số hạng mục và kiểm tra{' '}
                                                    <strong>tổng thời lượng</strong>: trên <strong>2 hạng mục</strong> cần ≥{' '}
                                                    <strong>3 giờ tổng</strong>, trên <strong>4 hạng mục</strong> cần ≥ <strong>4 giờ tổng</strong>{' '}
                                                    — ứng dụng <strong>tự đặt giờ</strong> cho khớp (bạn không chọn số giờ thủ công).
                                                </p>
                                                <div
                                                    className="pj-duration-group pj-cooking-dish-chips"
                                                    role="group"
                                                    aria-label="Chọn nhanh số hạng mục"
                                                >
                                                    {[1, 2, 3, 4, 5, 6].map((n) => (
                                                        <button
                                                            key={n}
                                                            type="button"
                                                            className={`pj-duration-btn ${Number(paintItemCount) === n ? 'active' : ''}`}
                                                            style={
                                                                Number(paintItemCount) === n
                                                                    ? {
                                                                          backgroundColor: serviceInfo.color,
                                                                          borderColor: serviceInfo.color,
                                                                      }
                                                                    : {}
                                                            }
                                                            onClick={() => setPaintItemCount(n)}
                                                        >
                                                            {n} hạng mục
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="pj-form-row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
                                                    <div className="pj-form-group half">
                                                        <label className="pj-label" htmlFor="pj-paint-item-count">
                                                            Hoặc nhập ({PAINT_ITEM_COUNT_MIN}–{PAINT_ITEM_COUNT_MAX})
                                                        </label>
                                                        <input
                                                            id="pj-paint-item-count"
                                                            type="number"
                                                            className="pj-input"
                                                            min={PAINT_ITEM_COUNT_MIN}
                                                            max={PAINT_ITEM_COUNT_MAX}
                                                            step={1}
                                                            value={paintItemCount}
                                                            onChange={(e) => {
                                                                const t = e.target.value;
                                                                if (t === '') return;
                                                                const v = Number(t);
                                                                if (!Number.isFinite(v)) return;
                                                                setPaintItemCount(
                                                                    Math.min(
                                                                        PAINT_ITEM_COUNT_MAX,
                                                                        Math.max(PAINT_ITEM_COUNT_MIN, Math.round(v))
                                                                    )
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                {getPaintRepairDurationViolationMessage(paintRepairN, durationHours) ? (
                                                    <div className="pj-error" role="alert" style={{ marginTop: 10 }}>
                                                        {getPaintRepairDurationViolationMessage(paintRepairN, durationHours)} — hãy bớt{' '}
                                                        <strong>dịch vụ con</strong> hoặc giảm số hạng mục.
                                                    </div>
                                                ) : null}
                                            </>
                                        ) : null}
                                        {!paintRepairMode ? (
                                            <div className="pj-duration-group">
                                                {durationOptionsWithCurrent.map((h) => (
                                                    <button
                                                        key={h}
                                                        type="button"
                                                        className={`pj-duration-btn ${baseDurationHours === h ? 'active' : ''}`}
                                                        style={
                                                            baseDurationHours === h
                                                                ? {
                                                                      backgroundColor: serviceInfo.color,
                                                                      borderColor: serviceInfo.color,
                                                                  }
                                                                : {}
                                                        }
                                                        onClick={() => applyMainDurationHours(h)}
                                                    >
                                                        {h} giờ
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </div>
                            ) : null}

                            {gardeningMode ? (
                                <div className="pj-form-group pj-cooking-block">
                                    <label className="pj-label" htmlFor="pj-garden-m2">
                                        🌿 Diện tích vườn (workSize) *
                                    </label>
                                    <p className="pj-cleaning-lead pj-cooking-hint">
                                        Nhập tổng diện tích khu vườn/sân cần chăm sóc theo m² — giá trị này gửi thẳng lên backend như{' '}
                                        <strong>workSize</strong> (khớp JobService).
                                    </p>
                                    <input
                                        id="pj-garden-m2"
                                        type="number"
                                        className="pj-input pj-input--narrow"
                                        min={GARDEN_AREA_M2_MIN}
                                        max={GARDEN_AREA_M2_MAX}
                                        step={0.5}
                                        value={gardenAreaM2}
                                        onChange={(e) => {
                                            const t = e.target.value;
                                            if (t === '') return;
                                            const v = Number(t);
                                            if (!Number.isFinite(v)) return;
                                            setGardenAreaM2(
                                                Math.min(GARDEN_AREA_M2_MAX, Math.max(GARDEN_AREA_M2_MIN, v))
                                            );
                                        }}
                                    />
                                    <span className="pj-hint" style={{ display: 'block', marginTop: 6 }}>
                                        Phạm vi nhập: {GARDEN_AREA_M2_MIN}–{GARDEN_AREA_M2_MAX} m².
                                    </span>
                                    {getGardeningDurationViolationMessage(gardenAreaM2, durationHours) ? (
                                        <div className="pj-error" role="alert" style={{ marginTop: 10 }}>
                                            {getGardeningDurationViolationMessage(gardenAreaM2, durationHours)} — hãy tăng{' '}
                                            <strong>tổng</strong> giờ (giờ phần chính hoặc điều chỉnh dịch vụ con).
                                        </div>
                                    ) : null}
                                    <label className="pj-switch-item pj-switch-item--block" style={{ marginTop: 14 }}>
                                        <input
                                            type="checkbox"
                                            checked={bringTools}
                                            onChange={(e) => setBringTools(e.target.checked)}
                                        />
                                        <span>Thợ mang theo dụng cụ làm vườn</span>
                                    </label>
                                    <label className="pj-switch-item pj-switch-item--block" style={{ marginTop: 8 }}>
                                        <input
                                            type="checkbox"
                                            checked={isPremium}
                                            onChange={(e) => setIsPremium(e.target.checked)}
                                        />
                                        <span>
                                            Gói cao cấp — phụ phí{' '}
                                            <strong className="pj-cooking-fee-tag">+50.000 ₫</strong> (áp dụng mọi danh mục)
                                        </span>
                                    </label>
                                    {detailConfig ? (
                                        <div className="pj-form-group pj-cleaning-scope" style={{ marginTop: 16, marginBottom: 0 }}>
                                            <div className="pj-detail-head">
                                                <label className="pj-label">📋 Phạm vi & dụng cụ tham khảo</label>
                                                <button
                                                    type="button"
                                                    className="pj-detail-toggle"
                                                    onClick={() => setShowGardeningDetail((v) => !v)}
                                                >
                                                    {showGardeningDetail ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                                                </button>
                                            </div>
                                            {showGardeningDetail ? (
                                                <div className="pj-cleaning-scope-grid">
                                                    <div className="pj-cleaning-scope-card">
                                                        <h4>{detailConfig.equipmentTitle}</h4>
                                                        <ul>
                                                            {detailConfig.equipmentItems.map((text) => (
                                                                <li key={text}>{text}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    {detailConfig.scopeSections.map((section) => (
                                                        <div key={section.title} className="pj-cleaning-scope-card">
                                                            <h4>{section.title}</h4>
                                                            <ul>
                                                                {section.items.map((item) => (
                                                                    <li key={item}>{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            {childcareMode ? (
                                <div className="pj-form-group pj-cooking-block">
                                    <label className="pj-label">👶 Số bé cần trông *</label>
                                    <p className="pj-cleaning-lead pj-cooking-hint">
                                        Chỉ chọn <strong>1 bé</strong> hoặc <strong>2 bé</strong>. Hệ thống gửi{' '}
                                        <strong>workSize</strong> = số bé (khớp backend).
                                        {Number(childCount) === 2 ? (
                                            <>
                                                {' '}
                                                <strong>Lưu ý giá:</strong> ca trông <strong>2 bé</strong> áp dụng mức giá tăng khoảng{' '}
                                                <strong>30%</strong> so với ca 1 bé (theo chính sách hiển thị).
                                            </>
                                        ) : null}
                                    </p>
                                    <p className="pj-cleaning-lead pj-cooking-hint" style={{ marginTop: 6, marginBottom: 10 }}>
                                        Số tiền cụ thể theo <strong>báo giá bên phải</strong>. Backend còn tính phụ phí bé thứ 2 theo{' '}
                                        <strong>tổng giờ</strong> làm việc (phần chính + dịch vụ con nếu có).
                                    </p>
                                    <div className="pj-duration-group pj-childcare-chips" role="group" aria-label="Chọn số bé">
                                        {[1, 2].map((n) => {
                                            const active = Number(childCount) === n;
                                            return (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    className={`pj-duration-btn ${active ? 'active' : ''}`}
                                                    style={
                                                        active
                                                            ? {
                                                                  backgroundColor: serviceInfo.color,
                                                                  borderColor: serviceInfo.color,
                                                              }
                                                            : {}
                                                    }
                                                    onClick={() => {
                                                        setChildCount(n);
                                                        if (n === 1) setChildAgeBand2('');
                                                    }}
                                                >
                                                    {n} bé
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="pj-cooking-flavor" style={{ marginTop: 16 }}>
                                        <label className="pj-label">
                                            {Number(childCount) === 2
                                                ? '🧒 Độ tuổi bé thứ nhất *'
                                                : '🧒 Độ tuổi bé *'}
                                        </label>
                                        <p className="pj-cleaning-lead pj-cooking-hint">
                                            Chọn một trong hai khoảng: <strong>12 tháng – 6 tuổi</strong> hoặc{' '}
                                            <strong>7 – 11 tuổi</strong>.
                                        </p>
                                        <div
                                            className="pj-cleaning-cards pj-cooking-flavor-cards"
                                            role="radiogroup"
                                            aria-label="Độ tuổi bé"
                                        >
                                            {CHILDCARE_AGE_OPTIONS.map((opt) => {
                                                const active = childAgeBand1 === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={active}
                                                        className={`pj-cleaning-card pj-cooking-flavor-card ${active ? 'active' : ''}`}
                                                        style={
                                                            active
                                                                ? {
                                                                      borderColor: serviceInfo.color,
                                                                      boxShadow: `0 0 0 2px ${serviceInfo.color}33`,
                                                                  }
                                                                : {}
                                                        }
                                                        onClick={() => setChildAgeBand1(opt.value)}
                                                    >
                                                        <span className="pj-cleaning-card-hours">{opt.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {Number(childCount) === 2 ? (
                                        <div className="pj-cooking-flavor" style={{ marginTop: 14 }}>
                                            <label className="pj-label">👧 Độ tuổi bé thứ hai *</label>
                                            <div
                                                className="pj-cleaning-cards pj-cooking-flavor-cards"
                                                role="radiogroup"
                                                aria-label="Độ tuổi bé thứ hai"
                                            >
                                                {CHILDCARE_AGE_OPTIONS.map((opt) => {
                                                    const active = childAgeBand2 === opt.value;
                                                    return (
                                                        <button
                                                            key={`age2-${opt.value}`}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={active}
                                                            className={`pj-cleaning-card pj-cooking-flavor-card ${active ? 'active' : ''}`}
                                                            style={
                                                                active
                                                                    ? {
                                                                          borderColor: serviceInfo.color,
                                                                          boxShadow: `0 0 0 2px ${serviceInfo.color}33`,
                                                                      }
                                                                    : {}
                                                            }
                                                            onClick={() => setChildAgeBand2(opt.value)}
                                                        >
                                                            <span className="pj-cleaning-card-hours">{opt.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : null}

                                    {detailConfig ? (
                                        <div className="pj-form-group pj-cleaning-scope" style={{ marginTop: 16, marginBottom: 0 }}>
                                            <div className="pj-detail-head">
                                                <label className="pj-label">📋 Chi tiết cô trông trẻ sẽ thực hiện</label>
                                                <button
                                                    type="button"
                                                    className="pj-detail-toggle"
                                                    onClick={() => setShowChildcareWorkDetail((v) => !v)}
                                                >
                                                    {showChildcareWorkDetail ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                                                </button>
                                            </div>
                                            {showChildcareWorkDetail ? (
                                                <div className="pj-cleaning-scope-grid">
                                                    <div className="pj-cleaning-scope-card">
                                                        <h4>{detailConfig.equipmentTitle}</h4>
                                                        <ul>
                                                            {detailConfig.equipmentItems.map((text) => (
                                                                <li key={text}>{text}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    {detailConfig.scopeSections.map((section) => (
                                                        <div key={section.title} className="pj-cleaning-scope-card">
                                                            <h4>{section.title}</h4>
                                                            <ul>
                                                                {section.items.map((item) => (
                                                                    <li key={item}>{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div className="pj-form-group pj-cleaning-scope" style={{ marginTop: 12, marginBottom: 0 }}>
                                        <div className="pj-detail-head">
                                            <label className="pj-label">📜 Điều khoản dịch vụ trông trẻ theo giờ</label>
                                            <button
                                                type="button"
                                                className="pj-detail-toggle"
                                                onClick={() => setShowChildcareTermsDetail((v) => !v)}
                                            >
                                                {showChildcareTermsDetail ? 'Ẩn điều khoản' : 'Xem điều khoản'}
                                            </button>
                                        </div>
                                        {showChildcareTermsDetail ? (
                                            <div className="pj-cleaning-scope-card" style={{ padding: '12px 1rem' }}>
                                                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                                                    {CHILDCARE_HOURLY_TERMS.map((line, idx) => (
                                                        <li key={idx} style={{ marginBottom: 8 }}>
                                                            {line}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : null}
                                    </div>

                                    <label className="pj-switch-item pj-switch-item--block" style={{ marginTop: 14 }}>
                                        <input
                                            type="checkbox"
                                            checked={isPremium}
                                            onChange={(e) => setIsPremium(e.target.checked)}
                                        />
                                        <span>
                                            Gói cao cấp — phụ phí{' '}
                                            <strong className="pj-cooking-fee-tag">+50.000 ₫</strong> (áp dụng mọi danh mục)
                                        </span>
                                    </label>
                                </div>
                            ) : null}

                            {cookingMode ? (
                                <div className="pj-form-group pj-cooking-block">
                                    <div className="pj-cooking-eaters">
                                        <label className="pj-label" htmlFor="pj-eater-count">
                                            👥 Số người ăn *
                                        </label>
                                        <input
                                            id="pj-eater-count"
                                            type="number"
                                            className="pj-input pj-input--narrow"
                                            min={1}
                                            max={50}
                                            step={1}
                                            value={eaterCount}
                                            onChange={(e) => {
                                                const t = e.target.value;
                                                if (t === '') return;
                                                const v = Number(t);
                                                if (!Number.isFinite(v)) return;
                                                setEaterCount(Math.min(50, Math.max(1, Math.round(v))));
                                            }}
                                        />
                                        <p className="pj-cleaning-lead pj-cooking-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                                            Giúp thợ ước lượng khẩu phần và chuẩn bị nguyên liệu phù hợp.
                                        </p>
                                    </div>

                                    <label className="pj-label">🍽️ Số món chính cần nấu *</label>
                                    <p className="pj-cleaning-lead pj-cooking-hint">
                                        Số món gửi lên hệ thống để kiểm tra thời lượng: trên <strong>3 món</strong> cần tối thiểu{' '}
                                        <strong>3 giờ tổng</strong>; trên <strong>5 món</strong> cần tối thiểu <strong>4 giờ tổng</strong>{' '}
                                        (tổng = giờ phần chính + dịch vụ con).
                                    </p>
                                    <div className="pj-duration-group pj-cooking-dish-chips" role="group" aria-label="Chọn nhanh số món">
                                        {[2, 3, 4, 5, 6].map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                className={`pj-duration-btn ${Number(dishCount) === n ? 'active' : ''}`}
                                                style={
                                                    Number(dishCount) === n
                                                        ? { backgroundColor: serviceInfo.color, borderColor: serviceInfo.color }
                                                        : {}
                                                }
                                                onClick={() => setDishCount(n)}
                                            >
                                                {n} món
                                            </button>
                                        ))}
                                    </div>
                                    <div className="pj-form-row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
                                        <div className="pj-form-group half">
                                            <label className="pj-label" htmlFor="pj-dish-count-input">
                                                Hoặc nhập số món (1–12)
                                            </label>
                                            <input
                                                id="pj-dish-count-input"
                                                type="number"
                                                className="pj-input"
                                                min={1}
                                                max={12}
                                                step={1}
                                                value={dishCount}
                                                onChange={(e) => {
                                                    const t = e.target.value;
                                                    if (t === '') return;
                                                    const v = Number(t);
                                                    if (!Number.isFinite(v)) return;
                                                    setDishCount(Math.min(12, Math.max(1, Math.round(v))));
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {!isCookingDishHoursValid(dishCount, durationHours) ? (
                                        <div className="pj-error" role="alert">
                                            Với {Number(dishCount) || '—'} món, hãy tăng <strong>tổng</strong> thời lượng (thêm giờ phần
                                            chính hoặc điều chỉnh dịch vụ con): trên 3 món cần ≥3 giờ tổng, trên 5 món cần ≥4 giờ tổng.
                                        </div>
                                    ) : null}

                                    <div className="pj-cooking-dish-names">
                                        <label className="pj-label">✏️ Tên từng món *</label>
                                        <p className="pj-cleaning-lead pj-cooking-hint">
                                            Mỗi ô tương ứng một món; nên điền rõ để thợ chuẩn bị đúng mong muốn.
                                        </p>
                                        <div className="pj-dish-name-list">
                                            {normalizeDishNamesLength(
                                                Math.min(12, Math.max(1, Math.round(Number(dishCount)))),
                                                dishNames
                                            ).map((name, idx) => (
                                                <label key={`dish-${idx}`} className="pj-dish-name-row">
                                                    <span className="pj-dish-name-label">Món {idx + 1}</span>
                                                    <input
                                                        type="text"
                                                        className="pj-input"
                                                        maxLength={120}
                                                        value={name}
                                                        placeholder={`Ví dụ: Món ${idx + 1}…`}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setDishNames((prev) => {
                                                                const n = Math.min(
                                                                    12,
                                                                    Math.max(1, Math.round(Number(dishCount)))
                                                                );
                                                                const next = normalizeDishNamesLength(n, prev);
                                                                next[idx] = v;
                                                                return next;
                                                            });
                                                        }}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                        {!cookingHasAtLeastOneDishName ? (
                                            <div className="pj-error" role="alert">
                                                Vui lòng nhập ít nhất một tên món.
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="pj-cooking-flavor">
                                        <label className="pj-label">🧂 Khẩu vị *</label>
                                        <p className="pj-cleaning-lead pj-cooking-hint">Chọn khẩu vị theo vùng miền bạn mong muốn.</p>
                                        <div className="pj-cleaning-cards pj-cooking-flavor-cards" role="radiogroup" aria-label="Khẩu vị">
                                            {COOKING_FLAVOR_OPTIONS.map((opt) => {
                                                const active = flavorRegion === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={active}
                                                        className={`pj-cleaning-card pj-cooking-flavor-card ${active ? 'active' : ''}`}
                                                        style={
                                                            active
                                                                ? {
                                                                      borderColor: serviceInfo.color,
                                                                      boxShadow: `0 0 0 2px ${serviceInfo.color}33`,
                                                                  }
                                                                : {}
                                                        }
                                                        onClick={() => setFlavorRegion(opt.value)}
                                                    >
                                                        <span className="pj-cleaning-card-hours">{opt.label}</span>
                                                        <span className="pj-cleaning-card-hint">
                                                            {opt.value === 'BAC' && 'Nhạt, ít cay, nhiều món kho'}
                                                            {opt.value === 'TRUNG' && 'Vừa miệng, món xào/nướng'}
                                                            {opt.value === 'NAM' && 'Ngọt mặn, nhiều rau, thường cay vừa'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="pj-cooking-fruit">
                                        <label className="pj-switch-item pj-switch-item--block">
                                            <input
                                                type="checkbox"
                                                checked={fruitDessert}
                                                onChange={(e) => setFruitDessert(e.target.checked)}
                                            />
                                            <span>
                                                Có thêm <strong>món tráng miệng trái cây</strong> (ghi nhận yêu cầu kèm đơn; chi tiết có thể
                                                trao đổi với thợ)
                                            </span>
                                        </label>
                                    </div>

                                    <div className="pj-cooking-shopping">
                                        <label className="pj-switch-item pj-switch-item--block">
                                            <input
                                                type="checkbox"
                                                checked={isTaskerShopping}
                                                onChange={(e) => setIsTaskerShopping(e.target.checked)}
                                            />
                                            <span>
                                                Nhờ thợ đi chợ mua nguyên liệu — phụ phí{' '}
                                                <strong className="pj-cooking-fee-tag">+50.000 ₫</strong>
                                            </span>
                                        </label>
                                        <label className="pj-switch-item pj-switch-item--block" style={{ marginTop: 10 }}>
                                            <input
                                                type="checkbox"
                                                checked={isPremium}
                                                onChange={(e) => setIsPremium(e.target.checked)}
                                            />
                                            <span>
                                                Gói cao cấp — phụ phí{' '}
                                                <strong className="pj-cooking-fee-tag">+50.000 ₫</strong> (áp dụng mọi danh mục)
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            ) : null}

                            {detailConfig && !gardeningMode ? (
                                <div className="pj-form-group pj-cleaning-equipment">
                                    <div className="pj-detail-head">
                                        <label className="pj-label">{detailConfig.equipmentTitle}</label>
                                        <button
                                            type="button"
                                            className="pj-detail-toggle"
                                            onClick={() => setShowCleaningEquipmentDetail((v) => !v)}
                                        >
                                            {showCleaningEquipmentDetail ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                                        </button>
                                    </div>
                                    {showCleaningEquipmentDetail ? (
                                        <>
                                            <ul className="pj-cleaning-tools-list">
                                                {detailConfig.equipmentItems.map((text) => (
                                                    <li key={text}>{text}</li>
                                                ))}
                                            </ul>
                                            <p className="pj-cleaning-note">
                                                {cookingMode
                                                    ? 'Số người ăn, tên món và khẩu vị đã chọn ở trên; phần ghi chú dùng cho dị ứng, nguyên liệu có sẵn hoặc yêu cầu riêng.'
                                                    : shoppingMode
                                                      ? 'Ghi chi tiết danh sách mua, ngân sách, siêu thị/điểm mua ưu tiên và lưu ý hạn sử dụng ở phần ghi chú bên dưới.'
                                                      : gardeningMode
                                                        ? 'Ghi loại cây, mức độ cắt tỉa, khu vực ưu tiên và dụng cụ/phân bón gia đình có sẵn ở phần ghi chú bên dưới.'
                                                        : paintRepairMode
                                                          ? 'Ghi rõ từng hạng mục (vị trí, màu, diện tích ước lượng) ở phần ghi chú; số hạng mục đã chọn ở trên gửi lên backend làm workSize.'
                                                          : 'Bạn có thể ghi rõ yêu cầu riêng (hóa chất, dụng cụ sẵn có) trong phần ghi chú bên dưới.'}
                                            </p>
                                        </>
                                    ) : null}
                                    {paintRepairMode ? (
                                        <div style={{ marginTop: 12 }}>
                                            <label className="pj-switch-item pj-switch-item--block">
                                                <input
                                                    type="checkbox"
                                                    checked={bringTools}
                                                    onChange={(e) => setBringTools(e.target.checked)}
                                                />
                                                <span>Thợ mang theo dụng cụ sơn sửa cơ bản</span>
                                            </label>
                                            <label className="pj-switch-item pj-switch-item--block" style={{ marginTop: 10 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isPremium}
                                                    onChange={(e) => setIsPremium(e.target.checked)}
                                                />
                                                <span>
                                                    Gói cao cấp — phụ phí{' '}
                                                    <strong className="pj-cooking-fee-tag">+50.000 ₫</strong> (áp dụng mọi danh mục)
                                                </span>
                                            </label>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            {!officeCleaningMode ? (
                                <div className="pj-form-group">
                                    <label className="pj-label">🔧 Dịch vụ con (tùy chọn)</label>
                                    <p className="pj-hint pj-sub-service-rule">
                                        Giờ phần chính (thẻ thời lượng) giữ nguyên khi bật/tắt dịch vụ con. Mỗi mục con cộng{' '}
                                        <strong>+{HOURS_PER_SUB_SERVICE} giờ</strong> vào <strong>tổng</strong> gửi hệ thống (tối đa{' '}
                                        {maxJobDurationHours} giờ tổng); backend trừ {HOURS_PER_SUB_SERVICE} giờ/mục khi tính giá nền — cùng
                                        quy tắc.
                                        {cookingMode ? (
                                            <>
                                                {' '}
                                                Với <strong>nấu ăn</strong>, điều kiện số món so với thời lượng được kiểm tra trên{' '}
                                                <strong>tổng giờ</strong> (không chỉ giờ phần chính).
                                            </>
                                        ) : null}
                                        {shoppingMode && !cookingMode ? (
                                            <>
                                                {' '}
                                                Với <strong>đi chợ</strong>, giờ phần chính cố định {SHOPPING_DEFAULT_BASE_DURATION_HOURS}{' '}
                                                giờ (không chọn trên app); sản phẩm và tiền ứng nằm ở đầu form.
                                            </>
                                        ) : null}
                                        {childcareMode && !cookingMode && !shoppingMode ? (
                                            <>
                                                {' '}
                                                Với <strong>trông trẻ</strong>, ca <strong>2 bé</strong> áp dụng mức giá tăng khoảng{' '}
                                                <strong>30%</strong> so với 1 bé; backend còn tính phụ phí bé thứ 2 theo{' '}
                                                <strong>tổng giờ</strong> — dịch vụ con (nếu có) làm tăng tổng giờ.
                                            </>
                                        ) : null}
                                        {gardeningMode && !cookingMode && !shoppingMode && !childcareMode ? (
                                            <>
                                                {' '}
                                                Với <strong>làm vườn</strong>, <strong>workSize</strong> là diện tích m²; backend kiểm tra{' '}
                                                <strong>tổng giờ</strong> với m² (trên 50 m² cần ≥3h, trên 80 m² cần ≥4h).
                                            </>
                                        ) : null}
                                        {paintRepairMode &&
                                        !cookingMode &&
                                        !shoppingMode &&
                                        !childcareMode &&
                                        !gardeningMode ? (
                                            <>
                                                {' '}
                                                Với <strong>sơn sửa</strong>, <strong>workSize</strong> là số hạng mục; tổng giờ được hệ
                                                thống tự điều chỉnh theo quy tắc hạng mục (JobService).
                                            </>
                                        ) : null}
                                    </p>
                                    {subServiceBlockMessage ? (
                                        <div className="pj-error" role="alert">
                                            {subServiceBlockMessage}
                                        </div>
                                    ) : null}
                                    {loadingSubServices && <div className="pj-hint">Đang tải danh sách...</div>}
                                    {!loadingSubServices && subServiceError && <div className="pj-error">{subServiceError}</div>}
                                    {!loadingSubServices && !subServiceError && subServices.length > 0 && (
                                        <div className="pj-services-grid">
                                            {subServices.map((item) => {
                                                const sid = Number(item?.id ?? item?.serviceId);
                                                if (!Number.isFinite(sid)) return null;
                                                const checked = selectedSubServiceIds.includes(sid);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={sid}
                                                        className={`pj-service-chip ${checked ? 'active' : ''}`}
                                                        onClick={() => toggleSubService(sid)}
                                                    >
                                                        <span className="pj-service-name">{item?.name || 'Dịch vụ phụ'}</span>
                                                        <span className="pj-service-hour-note">+{HOURS_PER_SUB_SERVICE}h tổng</span>
                                                        <span className="pj-service-price">
                                                            {Number(item?.basePrice || 0).toLocaleString('vi-VN')} đ
                                                        </span>
                                                        {checked && <span className="pj-service-check">✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {!loadingSubServices && !subServiceError && subServices.length === 0 && (
                                        <div className="pj-hint">ℹ️ Không có dịch vụ con cho danh mục này</div>
                                    )}
                                </div>
                            ) : null}
                            {cleaningMode ? (
                                <>
                                    {!officeCleaningMode ? (
                                        <div className="pj-form-group">
                                            <label className="pj-label">⚙️ Tùy chọn thêm</label>
                                            <div className="pj-cleaning-switches">
                                                <label className="pj-switch-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={hasPets}
                                                        onChange={(e) => setHasPets(e.target.checked)}
                                                    />
                                                    <span>Nhà có vật nuôi</span>
                                                </label>
                                                <label className="pj-switch-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={bringTools}
                                                        onChange={(e) => setBringTools(e.target.checked)}
                                                    />
                                                    <span>Thợ mang theo dụng cụ vệ sinh</span>
                                                </label>
                                                <label className="pj-switch-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={isPremium}
                                                        onChange={(e) => setIsPremium(e.target.checked)}
                                                    />
                                                    <span>Gói cao cấp (+50.000 ₫ — hóa chất/dụng cụ chuyên dụng)</span>
                                                </label>
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="pj-form-group pj-cleaning-scope">
                                        <div className="pj-detail-head">
                                            <label className="pj-label">{detailConfig.scopeTitle}</label>
                                            <button
                                                type="button"
                                                className="pj-detail-toggle"
                                                onClick={() => setShowCleaningScopeDetail((v) => !v)}
                                            >
                                                {showCleaningScopeDetail ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                                            </button>
                                        </div>
                                        {showCleaningScopeDetail && (
                                            <div className="pj-cleaning-scope-grid">
                                                {detailConfig.scopeSections.map((section) => (
                                                    <div key={section.title} className="pj-cleaning-scope-card">
                                                        <h4>{section.title}</h4>
                                                        <ul>
                                                            {section.items.map((item) => (
                                                                <li key={item}>{item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : null}

                            <div className="pj-form-group">
                                <label className="pj-label">✏️ Tiêu đề công việc</label>
                                <input
                                    type="text"
                                    className="pj-input"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={
                                        cookingMode
                                            ? 'Ví dụ: Nấu bữa tối 4 món, ưu thích món Việt...'
                                            : shoppingMode
                                              ? 'Ví dụ: Đi chợ theo list rau củ, thịt cá, siêu thị gần nhà...'
                                              : childcareMode
                                                ? 'Ví dụ: Trông 2 bé (3 tuổi và 5 tuổi), giờ ngủ trưa, dị ứng...'
                                                : gardeningMode
                                                  ? 'Ví dụ: Cắt cỏ + tỉa hàng rào, vườn sau ~60 m²...'
                                                  : 'Ví dụ: Dọn dẹp chung cư 2 phòng ngủ...'
                                    }
                                />
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">📝 Ghi chú thêm</label>
                                <textarea
                                    className="pj-textarea"
                                    rows="3"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder={
                                        shoppingMode
                                            ? 'Danh sách mua chi tiết, khối lượng, thương hiệu ưu tiên, ngân sách từng nhóm...'
                                            : childcareMode
                                              ? 'Độ tuổi từng bé, giờ ăn/ngủ, dị ứng, số liên hệ phụ huynh, ghi chú an toàn...'
                                              : gardeningMode
                                                ? 'Loại cây, mức độ tỉa, khu vực ưu tiên, phân bón/thuốc gia đình có sẵn, lối vào vườn...'
                                                : 'Nhập yêu cầu đặc biệt, hướng dẫn cụ thể cho người làm...'
                                    }
                                />
                            </div>

                            {!initialData.addressId && (
                                <div className="pj-warning">
                                    ⚠️ Bạn cần chọn địa chỉ ở bước trước
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cột phải - Tóm tắt và giá */}
                    <div className="pj-column">
                        <div className="pj-sidebar">
                            <h3 className="pj-sidebar-title">💰 Tóm tắt & giá dự kiến</h3>

                            {!officeCleaningMode ? (
                                <>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Dịch vụ con</span>
                                        <span className="pj-sidebar-value">{selectedSubServiceItems.length} mục</span>
                                    </div>

                                    {selectedSubServiceItems.length > 0 && (
                                        <div className="pj-sidebar-detail">
                                            {selectedSubServiceItems.slice(0, 3).map((s) => s?.name).filter(Boolean).join(', ')}
                                            {selectedSubServiceItems.length > 3 && ` +${selectedSubServiceItems.length - 3}`}
                                        </div>
                                    )}
                                </>
                            ) : null}

                            <div className="pj-sidebar-item">
                                <span className="pj-sidebar-label">Thời gian</span>
                                <span className="pj-sidebar-value">{startTime} - {workDate}</span>
                            </div>

                            <div className="pj-sidebar-item">
                                <span className="pj-sidebar-label">📍 Địa chỉ</span>
                                <span className="pj-sidebar-value">{initialData.addressDetail || 'Chưa chọn địa chỉ'}</span>
                            </div>

                            {!paintRepairMode ? (
                                <>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Số giờ</span>
                                        <span className="pj-sidebar-value">{durationHours} giờ</span>
                                    </div>

                                    {subServiceCount > 0 ? (
                                        <div className="pj-sidebar-item pj-sidebar-item--stack">
                                            <span className="pj-sidebar-label">Giờ tính giá nền (ước lượng)</span>
                                            <span className="pj-sidebar-value">{baseDurationHours} giờ</span>
                                            <div className="pj-sidebar-sub">
                                                {durationHours}h tổng − {subServiceCount} dịch vụ con × {HOURS_PER_SUB_SERVICE}h
                                            </div>
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <div className="pj-sidebar-item pj-sidebar-item--stack">
                                    <span className="pj-sidebar-label">Số hạng mục (workSize)</span>
                                    <span className="pj-sidebar-value">{paintRepairN}</span>
                                    <div className="pj-sidebar-sub">
                                        Giá & kiểm tra backend theo số hạng mục; thời lượng do hệ thống tự đặt cho khớp quy tắc.
                                    </div>
                                </div>
                            )}

                            {cleaningMode && areaMeta ? (
                                <div className="pj-sidebar-item pj-sidebar-item--area">
                                    <span className="pj-sidebar-label">
                                        {officeCleaningMode ? 'Gói diện tích (workSize)' : 'Diện tích gợi ý'}
                                    </span>
                                    <div className="pj-sidebar-value-wrap">
                                        <span className="pj-sidebar-value">
                                            {officeCleaningMode || areaMeta.minM2 === areaMeta.maxM2
                                                ? `${areaMeta.maxM2} m²`
                                                : `${areaMeta.minM2}–${areaMeta.maxM2} m²`}
                                        </span>
                                        <div className="pj-sidebar-sub">{areaMeta.hint}</div>
                                    </div>
                                </div>
                            ) : null}

                            {cookingMode ? (
                                <>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Số người ăn</span>
                                        <span className="pj-sidebar-value">{eaterCount}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Số món</span>
                                        <span className="pj-sidebar-value">{dishCount} món</span>
                                    </div>
                                    <div className="pj-sidebar-item pj-sidebar-item--stack">
                                        <span className="pj-sidebar-label">Tên món</span>
                                        <div className="pj-sidebar-sub">
                                            {(() => {
                                                const names = cookingNamesForValid
                                                    .map((s) => String(s || '').trim())
                                                    .filter(Boolean);
                                                if (names.length === 0) return '—';
                                                const head = names.slice(0, 3).join(', ');
                                                return names.length > 3 ? `${head} +${names.length - 3}` : head;
                                            })()}
                                        </div>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Khẩu vị</span>
                                        <span className="pj-sidebar-value">Miền {getCookingFlavorLabel(flavorRegion)}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Tráng miệng trái cây</span>
                                        <span className="pj-sidebar-value">{fruitDessert ? 'Có' : 'Không'}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Nhờ thợ đi chợ</span>
                                        <span className="pj-sidebar-value">{isTaskerShopping ? 'Có (+50k)' : 'Không'}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Gói cao cấp</span>
                                        <span className="pj-sidebar-value">{isPremium ? 'Có (+50k)' : 'Không'}</span>
                                    </div>
                                </>
                            ) : null}

                            {childcareMode ? (
                                <>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Số bé (workSize)</span>
                                        <span className="pj-sidebar-value">{childCount}</span>
                                    </div>
                                    {Number(childCount) === 2 ? (
                                        <div className="pj-sidebar-item pj-sidebar-item--stack">
                                            <span className="pj-sidebar-label">Chính sách giá 2 bé</span>
                                            <span className="pj-sidebar-value">~+30% so với 1 bé</span>
                                            <div className="pj-sidebar-sub">
                                                Số tiền cụ thể theo báo giá; ngoài ra backend cộng phụ phí theo giờ (ước tính:{' '}
                                                {(
                                                    (Number(childCount) - 1) *
                                                    durationHours *
                                                    CHILDCARE_EXTRA_FEE_PER_CHILD_PER_HOUR_VND
                                                ).toLocaleString('vi-VN')}{' '}
                                                ₫ = 1 bé phụ × {durationHours} giờ tổng ×{' '}
                                                {CHILDCARE_EXTRA_FEE_PER_CHILD_PER_HOUR_VND.toLocaleString('vi-VN')} ₫).
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="pj-sidebar-item pj-sidebar-item--stack">
                                        <span className="pj-sidebar-label">Độ tuổi</span>
                                        <span className="pj-sidebar-value">
                                            {CHILDCARE_AGE_SET.has(childAgeBand1) ? getChildcareAgeLabel(childAgeBand1) : '—'}
                                            {Number(childCount) === 2 && CHILDCARE_AGE_SET.has(childAgeBand2)
                                                ? ` · bé 2: ${getChildcareAgeLabel(childAgeBand2)}`
                                                : ''}
                                        </span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Gói cao cấp</span>
                                        <span className="pj-sidebar-value">{isPremium ? 'Có (+50k)' : 'Không'}</span>
                                    </div>
                                </>
                            ) : null}

                            {gardeningMode ? (
                                <>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Diện tích vườn (workSize)</span>
                                        <span className="pj-sidebar-value">
                                            {Number.isFinite(Number(gardenAreaM2)) ? `${gardenAreaM2} m²` : '—'}
                                        </span>
                                    </div>
                                    <div className="pj-sidebar-item pj-sidebar-item--stack">
                                        <span className="pj-sidebar-label">Quy tắc giờ / m² (backend)</span>
                                        <div className="pj-sidebar-sub">
                                            &gt;50 m² cần ≥3h tổng; &gt;80 m² cần ≥4h tổng. Hiện tại: {durationHours}h tổng.
                                        </div>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Thợ mang dụng cụ</span>
                                        <span className="pj-sidebar-value">{bringTools ? 'Có' : 'Không'}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Gói cao cấp</span>
                                        <span className="pj-sidebar-value">{isPremium ? 'Có (+50k)' : 'Không'}</span>
                                    </div>
                                </>
                            ) : null}

                            {paintRepairMode ? (
                                <>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Thợ mang dụng cụ</span>
                                        <span className="pj-sidebar-value">{bringTools ? 'Có' : 'Không'}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Gói cao cấp</span>
                                        <span className="pj-sidebar-value">{isPremium ? 'Có (+50k)' : 'Không'}</span>
                                    </div>
                                </>
                            ) : null}

                            {shoppingMode ? (
                                <>
                                    <div className="pj-sidebar-item pj-sidebar-item--stack">
                                        <span className="pj-sidebar-label">Sản phẩm (rút gọn)</span>
                                        <div className="pj-sidebar-sub">
                                            {(() => {
                                                const names = normalizeShoppingItemNames(shoppingItemRowCount, shoppingItemNames)
                                                    .map((s) => String(s || '').trim())
                                                    .filter(Boolean);
                                                if (names.length === 0) return '—';
                                                const head = names.slice(0, 3).join(', ');
                                                return names.length > 3 ? `${head} +${names.length - 3}` : head;
                                            })()}
                                        </div>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Giờ gói (cố định)</span>
                                        <span className="pj-sidebar-value">
                                            {SHOPPING_DEFAULT_BASE_DURATION_HOURS} giờ (+{subServiceCount} con → {durationHours}h tổng)
                                        </span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Ứng tiền mua hàng</span>
                                        <span className="pj-sidebar-value">
                                            {Number(shoppingMoneyVnd) >= SHOPPING_MONEY_MIN_VND &&
                                            Number(shoppingMoneyVnd) <= SHOPPING_MONEY_MAX_VND
                                                ? 'Có'
                                                : 'Chưa đủ điều kiện'}
                                        </span>
                                    </div>
                                    {Number(shoppingMoneyVnd) >= SHOPPING_MONEY_MIN_VND &&
                                    Number(shoppingMoneyVnd) <= SHOPPING_MONEY_MAX_VND ? (
                                        <>
                                            <div className="pj-sidebar-item">
                                                <span className="pj-sidebar-label">Phí ứng tiền (dịch vụ)</span>
                                                <span className="pj-sidebar-value">
                                                    {SHOPPING_ADVANCE_SERVICE_FEE_VND.toLocaleString('vi-VN')} ₫
                                                </span>
                                            </div>
                                            <div className="pj-sidebar-item pj-sidebar-item--stack">
                                                <span className="pj-sidebar-label">Dự kiến tiền hàng</span>
                                                <span className="pj-sidebar-value">
                                                    {Number(shoppingMoneyVnd).toLocaleString('vi-VN')} ₫
                                                </span>
                                            </div>
                                        </>
                                    ) : null}
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Gói cao cấp</span>
                                        <span className="pj-sidebar-value">{isPremium ? 'Có (+50k)' : 'Không'}</span>
                                    </div>
                                </>
                            ) : null}

                            <div className="pj-divider"></div>
                            {cleaningMode ? (
                                <>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Nhà có vật nuôi</span>
                                        <span className="pj-sidebar-value">{hasPets ? 'Có' : 'Không'}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Thợ mang dụng cụ</span>
                                        <span className="pj-sidebar-value">{bringTools ? 'Có' : 'Không'}</span>
                                    </div>
                                    <div className="pj-sidebar-item">
                                        <span className="pj-sidebar-label">Gói cao cấp</span>
                                        <span className="pj-sidebar-value">{isPremium ? 'Có (+50k)' : 'Không'}</span>
                                    </div>
                                    <div className="pj-divider"></div>
                                </>
                            ) : null}

                            {loadingPrice ? (
                                <div className="pj-sidebar-loading">⏳ Đang tính giá...</div>
                            ) : preEstimate ? (
                                <>
                                    <div className="pj-price-label">Tổng thanh toán dự kiến</div>
                                    <div className="pj-price-value" style={{ color: serviceInfo.color }}>
                                        {formatCurrency(preEstimate.estimatedPrice)}
                                    </div>
                                    {preEstimate.basePrice !== undefined && preEstimate.basePrice !== null ? (
                                        <div className="pj-price-note">
                                            (Giá cơ bản: {formatCurrency(preEstimate.basePrice)})
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <div className="pj-sidebar-loading">📝 Chọn dịch vụ để tính giá</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pj-actions">
                    <button
                        className={`pj-btn-primary ${!isFormValid ? 'disabled' : ''}`}
                        disabled={!isFormValid}
                        onClick={handleSubmit}
                        style={{ backgroundColor: serviceInfo.color }}
                    >
                        Tiếp tục →
                    </button>
                </div>
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 3: Confirm & Pay Step                                                 */
/* -------------------------------------------------------------------------- */
const ConfirmPayStep = ({ onBack, onConfirm, jobData, estimateData, loadingEstimate, loadingSubmit, serviceInfo }) => {
    const confirmCleaning = isCleaningCategoryId(jobData.categoryId);
    const confirmCooking = isCookingCategoryId(jobData.categoryId);
    const confirmShopping = isShoppingCategoryId(jobData.categoryId);
    const confirmChildcare = isChildcareCategoryId(jobData.categoryId);
    const confirmGardening = isGardeningCategoryId(jobData.categoryId);
    const confirmPaintRepair = isPaintRepairCategoryId(jobData.categoryId);
    const confirmSubServiceCount = Array.isArray(jobData.serviceIds) ? jobData.serviceIds.length : 0;
    const confirmEffectiveBaseLaborHours = Math.max(
        0,
        Number(jobData.durationHours) - confirmSubServiceCount * HOURS_PER_SUB_SERVICE
    );
    const confirmHomeAreaMeta =
        confirmCleaning &&
        isHomeCleaningCategoryId(jobData.categoryId) &&
        jobData.durationHours != null
            ? getCleaningAreaMeta(jobData.categoryId, confirmEffectiveBaseLaborHours)
            : null;

    const confirmOfficePackage = useMemo(() => {
        if (!confirmCleaning || !isOfficeCleaningCategoryId(jobData.categoryId)) return null;
        const ws = Number(jobData.workSize);
        if (!Number.isFinite(ws)) return null;
        const matchExact = OFFICE_CLEANING_PRESETS.find(
            (p) => p.maxM2 === ws && p.baseHours === confirmEffectiveBaseLaborHours
        );
        const matchWs = OFFICE_CLEANING_PRESETS.find((p) => p.maxM2 === ws);
        const m = matchExact || matchWs;
        if (m) {
            return {
                title: `${m.lineM2} · ${m.lineTime}`,
                sub: `${m.maxM2} m² (workSize) · ${confirmEffectiveBaseLaborHours} giờ phần chính · tổng ${jobData.durationHours} giờ`,
            };
        }
        return {
            title: `Ước tính ~${ws} m² (workSize)`,
            sub: `${confirmEffectiveBaseLaborHours} giờ phần chính · tổng ${jobData.durationHours} giờ`,
        };
    }, [
        confirmCleaning,
        jobData.categoryId,
        jobData.workSize,
        jobData.durationHours,
        confirmEffectiveBaseLaborHours,
    ]);

    const formatCurrency = (val) => formatMoneyVnd(val);

    const selectedServiceNames = useMemo(() => {
        const fees = Array.isArray(estimateData?.serviceFees) ? estimateData.serviceFees : [];
        return fees.map((f) => f?.name).filter(Boolean);
    }, [estimateData]);

    const confirmCookingNames = useMemo(() => {
        if (!confirmCooking) return [];
        const raw = jobData.additionalData?.dishNames;
        if (!Array.isArray(raw)) return [];
        return raw.map((s) => String(s || '').trim()).filter(Boolean);
    }, [confirmCooking, jobData.additionalData]);

    return (
        <div className="pj-card">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>
                    ←
                </button>
                <div className="pj-header-title">
                    <span className="pj-icon">✓</span>
                    Xác nhận đăng tin
                </div>
                <div className="pj-step">Bước 3/3</div>
            </div>

            <div className="pj-body">
                {loadingEstimate ? (
                    <div className="pj-loading">💰 Đang tính toán giá...</div>
                ) : (
                    <>
                        <div className="pj-summary">
                            <h3 className="pj-summary-title">📋 Thông tin công việc</h3>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Dịch vụ</div>
                                <div className="pj-summary-value">{serviceInfo.name}</div>
                            </div>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Dịch vụ con</div>
                                <div className="pj-summary-value">
                                    {(jobData.serviceIds?.length || 0) === 0
                                        ? 'Không chọn'
                                        : `${jobData.serviceIds.length} mục`}
                                    {selectedServiceNames.length > 0 && (
                                        <div className="pj-summary-subvalue">
                                            {selectedServiceNames.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Thời gian</div>
                                <div className="pj-summary-value">{jobData.startTime} - Ngày {jobData.workDate}</div>
                            </div>

                            {!confirmPaintRepair ? (
                                <>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Số giờ</div>
                                        <div className="pj-summary-value">{jobData.durationHours} giờ</div>
                                    </div>

                                    {confirmSubServiceCount > 0 ? (
                                        <div className="pj-summary-row">
                                            <div className="pj-summary-label">Giờ tính giá nền (ước lượng)</div>
                                            <div className="pj-summary-value">{confirmEffectiveBaseLaborHours} giờ</div>
                                            <div className="pj-summary-subvalue">
                                                {jobData.durationHours}h tổng − {confirmSubServiceCount} dịch vụ con ×{' '}
                                                {HOURS_PER_SUB_SERVICE}h
                                            </div>
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <div className="pj-summary-row">
                                    <div className="pj-summary-label">Số hạng mục (workSize)</div>
                                    <div className="pj-summary-value">
                                        {jobData.workSize != null && Number.isFinite(Number(jobData.workSize))
                                            ? `${Number(jobData.workSize)} hạng mục`
                                            : '—'}
                                    </div>
                                    <div className="pj-summary-subvalue">
                                        Backend kiểm tra tổng thời lượng theo số hạng mục (trên 2 mục ≥3h tổng, trên 4 mục ≥4h tổng)
                                        — ứng dụng tự đặt giờ cho khớp; khách không chọn số giờ.
                                    </div>
                                </div>
                            )}

                            {confirmHomeAreaMeta ? (
                                <div className="pj-summary-row">
                                    <div className="pj-summary-label">Diện tích (ước lượng)</div>
                                    <div className="pj-summary-value">
                                        {confirmHomeAreaMeta.minM2}–{confirmHomeAreaMeta.maxM2} m²
                                        <div className="pj-summary-subvalue">{confirmHomeAreaMeta.hint}</div>
                                    </div>
                                </div>
                            ) : null}
                            {confirmOfficePackage ? (
                                <div className="pj-summary-row">
                                    <div className="pj-summary-label">Gói vệ sinh VP</div>
                                    <div className="pj-summary-value">{confirmOfficePackage.title}</div>
                                    <div className="pj-summary-subvalue">{confirmOfficePackage.sub}</div>
                                </div>
                            ) : null}
                            {confirmHomeAreaMeta || confirmOfficePackage ? (
                                <>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Nhà có vật nuôi</div>
                                        <div className="pj-summary-value">{jobData.hasPets ? 'Có' : 'Không'}</div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Thợ mang dụng cụ</div>
                                        <div className="pj-summary-value">{jobData.bringTools ? 'Có' : 'Không'}</div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Gói cao cấp</div>
                                        <div className="pj-summary-value">
                                            {jobData.isPremium ? 'Có (+50.000 ₫)' : 'Không'}
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {confirmCooking ? (
                                <>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Số người ăn</div>
                                        <div className="pj-summary-value">{jobData.additionalData?.eaterCount ?? '—'}</div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Số món</div>
                                        <div className="pj-summary-value">{jobData.workSize} món</div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Tên món</div>
                                        <div className="pj-summary-value">
                                            {confirmCookingNames.length > 0 ? (
                                                <div className="pj-summary-subvalue">{confirmCookingNames.join(', ')}</div>
                                            ) : (
                                                '—'
                                            )}
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Khẩu vị</div>
                                        <div className="pj-summary-value">
                                            Miền {getCookingFlavorLabel(String(jobData.additionalData?.flavorRegion || '').toUpperCase())}
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Tráng miệng trái cây</div>
                                        <div className="pj-summary-value">
                                            {jobData.additionalData?.fruitDessert ? 'Có' : 'Không'}
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Nhờ thợ đi chợ</div>
                                        <div className="pj-summary-value">
                                            {jobData.additionalData?.isTaskerShopping ? 'Có (+50.000 ₫)' : 'Không'}
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Gói cao cấp</div>
                                        <div className="pj-summary-value">
                                            {jobData.isPremium ? 'Có (+50.000 ₫)' : 'Không'}
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {confirmChildcare ? (
                                <>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Số bé (workSize)</div>
                                        <div className="pj-summary-value">
                                            {jobData.workSize != null && Number.isFinite(Number(jobData.workSize))
                                                ? `${Number(jobData.workSize)} bé`
                                                : '—'}
                                        </div>
                                    </div>
                                    {Number(jobData.workSize) === 2 ? (
                                        <div className="pj-summary-row">
                                            <div className="pj-summary-label">Chính sách giá 2 bé</div>
                                            <div className="pj-summary-value">
                                                Mức giá tăng khoảng <strong>30%</strong> so với ca 1 bé (theo chính sách hiển thị).
                                            </div>
                                            {Number(jobData.durationHours) > 0 ? (
                                                <div className="pj-summary-subvalue">
                                                    Ước tính phụ phí theo giờ (backend):{' '}
                                                    {(
                                                        (Number(jobData.workSize) - 1) *
                                                        Number(jobData.durationHours) *
                                                        CHILDCARE_EXTRA_FEE_PER_CHILD_PER_HOUR_VND
                                                    ).toLocaleString('vi-VN')}{' '}
                                                    ₫ — xem tổng trong báo giá.
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Độ tuổi bé</div>
                                        <div className="pj-summary-value">
                                            {(() => {
                                                const a1 = String(
                                                    jobData.additionalData?.childAgeBand1 || ''
                                                )
                                                    .toUpperCase()
                                                    .trim();
                                                const a2 = String(
                                                    jobData.additionalData?.childAgeBand2 || ''
                                                )
                                                    .toUpperCase()
                                                    .trim();
                                                const l1 = CHILDCARE_AGE_SET.has(a1) ? getChildcareAgeLabel(a1) : '—';
                                                if (Number(jobData.workSize) !== 2)
                                                    return l1;
                                                const l2 = CHILDCARE_AGE_SET.has(a2) ? getChildcareAgeLabel(a2) : '—';
                                                return (
                                                    <>
                                                        Bé 1: {l1}
                                                        <div className="pj-summary-subvalue">Bé 2: {l2}</div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Gói cao cấp</div>
                                        <div className="pj-summary-value">
                                            {jobData.isPremium ? 'Có (+50.000 ₫)' : 'Không'}
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {confirmGardening ? (
                                <>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Diện tích vườn (workSize)</div>
                                        <div className="pj-summary-value">
                                            {jobData.workSize != null && Number.isFinite(Number(jobData.workSize))
                                                ? `${Number(jobData.workSize)} m²`
                                                : '—'}
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Quy tắc thời lượng (backend)</div>
                                        <div className="pj-summary-value">
                                            Trên 50 m² cần tối thiểu 3 giờ tổng; trên 80 m² cần tối thiểu 4 giờ tổng.
                                        </div>
                                        <div className="pj-summary-subvalue">
                                            {jobData.durationHours} giờ tổng — đã kiểm tra khớp với diện tích (workSize).
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Thợ mang dụng cụ</div>
                                        <div className="pj-summary-value">{jobData.bringTools ? 'Có' : 'Không'}</div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Gói cao cấp</div>
                                        <div className="pj-summary-value">
                                            {jobData.isPremium ? 'Có (+50.000 ₫)' : 'Không'}
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {confirmPaintRepair ? (
                                <>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Thợ mang dụng cụ</div>
                                        <div className="pj-summary-value">{jobData.bringTools ? 'Có' : 'Không'}</div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Gói cao cấp</div>
                                        <div className="pj-summary-value">
                                            {jobData.isPremium ? 'Có (+50.000 ₫)' : 'Không'}
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {confirmShopping ? (
                                <>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Sản phẩm cần mua</div>
                                        <div className="pj-summary-value">
                                            {Array.isArray(jobData.additionalData?.shoppingItemNames) &&
                                            jobData.additionalData.shoppingItemNames.length > 0 ? (
                                                <div className="pj-summary-subvalue">
                                                    {jobData.additionalData.shoppingItemNames.join(', ')}
                                                </div>
                                            ) : (
                                                '—'
                                            )}
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Giờ gói đi chợ</div>
                                        <div className="pj-summary-value">
                                            {jobData.durationHours} giờ tổng (gói cố định {SHOPPING_DEFAULT_BASE_DURATION_HOURS} giờ +
                                            dịch vụ con)
                                        </div>
                                    </div>
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Ứng tiền mua hàng</div>
                                        <div className="pj-summary-value">
                                            {jobData.additionalData?.isTaskerAdvance ? 'Có' : 'Không'}
                                        </div>
                                    </div>
                                    {jobData.additionalData?.isTaskerAdvance ? (
                                        <>
                                            <div className="pj-summary-row">
                                                <div className="pj-summary-label">Phí ứng tiền (dịch vụ)</div>
                                                <div className="pj-summary-value">
                                                    {SHOPPING_ADVANCE_SERVICE_FEE_VND.toLocaleString('vi-VN')} ₫
                                                </div>
                                            </div>
                                            <div className="pj-summary-row">
                                                <div className="pj-summary-label">Dự kiến tiền hàng</div>
                                                <div className="pj-summary-value">
                                                    {Number(jobData.additionalData?.shoppingAmount) >= SHOPPING_MONEY_MIN_VND
                                                        ? `${Number(jobData.additionalData.shoppingAmount).toLocaleString('vi-VN')} ₫`
                                                        : '—'}
                                                </div>
                                            </div>
                                        </>
                                    ) : null}
                                    <div className="pj-summary-row">
                                        <div className="pj-summary-label">Gói cao cấp</div>
                                        <div className="pj-summary-value">
                                            {jobData.isPremium ? 'Có (+50.000 ₫)' : 'Không'}
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Địa chỉ</div>
                                <div className="pj-summary-value">{jobData.addressDetail}</div>
                            </div>

                            {jobData.title && (
                                <div className="pj-summary-row">
                                    <div className="pj-summary-label">Tiêu đề</div>
                                    <div className="pj-summary-value">{jobData.title}</div>
                                </div>
                            )}

                            {jobData.description && (
                                <div className="pj-summary-row">
                                    <div className="pj-summary-label">Ghi chú</div>
                                    <div className="pj-summary-value">{jobData.description}</div>
                                </div>
                            )}
                        </div>

                        {estimateData && (
                            <div className="pj-payment">
                                <div className="pj-payment-row">
                                    <span>💰 Giá dịch vụ cơ bản</span>
                                    <span>{formatCurrency(estimateData.basePrice)}</span>
                                </div>
                                {estimateData.serviceFees && estimateData.serviceFees.length > 0 && (
                                    <div className="pj-payment-detail">
                                        <div className="pj-payment-detail-title">Chi tiết dịch vụ con:</div>
                                        {estimateData.serviceFees.map((fee, idx) => (
                                            <div key={idx} className="pj-payment-detail-item">
                                                <span>{fee.name}</span>
                                                <span>{formatCurrency(fee.price)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="pj-payment-row total">
                                    <span>💎 Tổng thanh toán</span>
                                    <span style={{ color: serviceInfo.color, fontSize: '20px', fontWeight: 'bold' }}>
                                        {formatCurrency(estimateData.estimatedPrice)}
                                    </span>
                                </div>
                                <div className="pj-payment-note">
                                    🔒 Hệ thống sẽ tạm giữ số tiền này. Tiền sẽ được hoàn lại nếu không tìm được người làm.
                                </div>
                            </div>
                        )}

                        <div className="pj-actions">
                            <button
                                className={`pj-btn-primary ${loadingSubmit ? 'disabled' : ''}`}
                                disabled={loadingSubmit}
                                onClick={onConfirm}
                                style={{ backgroundColor: serviceInfo.color }}
                            >
                                {loadingSubmit ? '⏳ Đang xử lý...' : '✓ Đăng tin & Giữ tiền'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CustomerPostJobPage;
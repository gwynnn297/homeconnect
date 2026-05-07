/**
 * Gom thông tin tối thiểu helper cần để nắm công việc (không hiển thị mã nội bộ / JSON / bảng giá chi tiết).
 */

const HOME_CLEANING_CATEGORY_ID = 1;
const COOKING_CATEGORY_ID = 2;
const SHOPPING_CATEGORY_ID = 3;
const OFFICE_CLEANING_CATEGORY_ID = 4;
const CHILDCARE_CATEGORY_ID = 5;
const GARDENING_CATEGORY_ID = 6;
const PAINT_REPAIR_CATEGORY_ID = 7;

const COOKING_FLAVOR_LABELS = { BAC: 'Bắc', TRUNG: 'Trung', NAM: 'Nam' };

const CHILDCARE_AGE_LABELS = {
    MONTHS_12_TO_6Y: '12 tháng – 6 tuổi',
    AGE_7_TO_11Y: '7 tuổi – 11 tuổi',
};

const formatVnd = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
    if (!Number.isFinite(n)) return null;
    return `${Math.round(n).toLocaleString('vi-VN')} đ`;
};

const resolveHelperCompensation = (job) => {
    // Hiển thị thù lao thực nhận = giá gốc trừ phí hoa hồng 15%
    const rawPrice = job?.originalPrice ?? job?.offerPrice;
    const originalPrice = Number(rawPrice);
    if (!Number.isFinite(originalPrice)) return formatVnd(job?.offerPrice);

    const commissionRate = 0.15; // 15% phí nền tảng
    const helperCompensation = originalPrice * (1 - commissionRate);
    return formatVnd(helperCompensation);
};

const formatWorkDate = (value) => {
    if (!value) return null;
    const [y, m, d] = String(value).split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return String(value);
};

const getAdditional = (job) =>
    job?.additionalData && typeof job.additionalData === 'object' && !Array.isArray(job.additionalData)
        ? job.additionalData
        : {};

const resolveWorkSize = (job) => {
    const add = getAdditional(job);
    if (job?.workSize != null && job.workSize !== '') {
        const n = Number(job.workSize);
        if (Number.isFinite(n)) return n;
    }
    if (add.workSize != null && add.workSize !== '') {
        const n = Number(add.workSize);
        if (Number.isFinite(n)) return n;
    }
    return null;
};

function collectWorkScope(job) {
    const cat = Number(job?.categoryId);
    const ws = resolveWorkSize(job);
    const add = getAdditional(job);
    const bullets = [];
    const lists = [];

    if (job?.serviceNames) {
        bullets.push(`Dịch vụ thêm: ${job.serviceNames}`);
    }

    if (cat === HOME_CLEANING_CATEGORY_ID) {
        if (ws != null && Number.isFinite(ws)) bullets.push(`Diện tích ước lượng khoảng ${ws} m²`);
        return { bullets, lists };
    }

    if (cat === OFFICE_CLEANING_CATEGORY_ID) {
        if (ws != null && Number.isFinite(ws)) bullets.push(`Diện tích sàn ước lượng khoảng ${ws} m²`);
        return { bullets, lists };
    }

    if (cat === COOKING_CATEGORY_ID) {
        if (ws != null && Number.isFinite(ws)) bullets.push(`${Math.round(ws)} món cần nấu`);
        if (add.eaterCount != null) bullets.push(`Dự kiến ${add.eaterCount} người ăn`);
        const flavor = String(add.flavorRegion || '').toUpperCase();
        if (flavor) bullets.push(`Khẩu vị: ${COOKING_FLAVOR_LABELS[flavor] || flavor}`);
        if (add.isTaskerShopping === true) bullets.push('Khách nhờ thợ đi chợ mua thêm nguyên liệu');
        if (add.fruitDessert === true) bullets.push('Có thêm món tráng miệng / trái cây');
        const names = Array.isArray(add.dishNames) ? add.dishNames.map((s) => String(s || '').trim()).filter(Boolean) : [];
        if (names.length) lists.push({ title: 'Danh sách món', items: names });
        return { bullets, lists };
    }

    if (cat === SHOPPING_CATEGORY_ID) {
        if (add.isTaskerAdvance === true) {
            const amt = formatVnd(add.shoppingAmount);
            bullets.push(amt ? `Khách ứng tiền mua hộ: ${amt}` : 'Khách ứng tiền mua hộ');
        } else {
            bullets.push('Khách tự thanh toán tại chỗ (không ứng tiền trước)');
        }
        const items = Array.isArray(add.shoppingItemNames)
            ? add.shoppingItemNames.map((s) => String(s || '').trim()).filter(Boolean)
            : [];
        if (items.length) lists.push({ title: 'Món hàng cần mua', items });
        return { bullets, lists };
    }

    if (cat === CHILDCARE_CATEGORY_ID) {
        const n = ws != null && Number.isFinite(ws) ? Math.round(ws) : null;
        if (n != null) bullets.push(`Trông ${n} bé trong ca`);
        const a1 = String(add.childAgeBand1 || '').toUpperCase().trim();
        if (a1) bullets.push(`Bé 1: ${CHILDCARE_AGE_LABELS[a1] || a1}`);
        const a2 = String(add.childAgeBand2 || '').toUpperCase().trim();
        if (n === 2 && a2) bullets.push(`Bé 2: ${CHILDCARE_AGE_LABELS[a2] || a2}`);
        return { bullets, lists };
    }

    if (cat === GARDENING_CATEGORY_ID) {
        if (ws != null && Number.isFinite(ws)) bullets.push(`Diện tích vườn khoảng ${ws} m²`);
        return { bullets, lists };
    }

    if (cat === PAINT_REPAIR_CATEGORY_ID) {
        if (ws != null && Number.isFinite(ws)) bullets.push(`${Math.round(ws)} hạng mục sơn / sửa chữa`);
        return { bullets, lists };
    }

    return { bullets, lists };
}

/**
 * @returns {{
 *   title: string,
 *   serviceLine: string,
 *   postRef: string | null,
 *   schedule: { date: string | null, time: string | null, duration: string | null },
 *   location: { area: string, extra: string | null },
 *   offerPrice: string | null,
 *   flags: { premium: boolean, pets: boolean, bringTools: boolean },
 *   booking: { id: number, status: string | null } | null,
 *   workBullets: string[],
 *   workLists: { title: string, items: string[] }[],
 * } | null}
 */
export function buildHelperJobModalModel(job) {
    if (!job) return null;

    const { bullets, lists } = collectWorkScope(job);
    const areaOnly = [job.wardName, job.districtName, job.provinceName].filter(Boolean).join(', ');
    const fullAddress = (job.fullAddress && String(job.fullAddress).trim()) || '';
    const composedAddress = [job.addressDetail, job.wardName, job.districtName, job.provinceName].filter(Boolean).join(', ');
    const preferredAddress = fullAddress || composedAddress || areaOnly || '—';

    return {
        title: job.title || 'Công việc',
        serviceLine: [job.categoryName, job.serviceNames].filter(Boolean).join(' · ') || 'Dịch vụ',
        postRef: job.postId != null ? `#${job.postId}` : null,
        schedule: {
            date: formatWorkDate(job.workDate),
            time: job.startTime || null,
            duration: job.durationHours != null ? `${job.durationHours} giờ` : null,
        },
        location: {
            area: preferredAddress,
            extra: null,
        },
        offerPrice: resolveHelperCompensation(job),
        flags: {},
        booking:
            job.bookingId != null
                ? {
                    id: job.bookingId,
                    status: job.bookingStatus ? String(job.bookingStatus) : null,
                }
                : null,
        workBullets: bullets,
        workLists: lists,
    };
}

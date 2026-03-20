import apiClient from './apiClient';

const SCHEDULE_BASE_URL = '/api/v1/schedules';

const buildOptionalParams = (params) =>
    Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null));

const sanitizeSlotRequest = (slot) => {
    if (!slot) return null;
    // DTO ScheduleSlotRequest chỉ có startTime/endTime.
    // Frontend có thể đang truyền thêm `id` -> loại bỏ để khớp backend.
    return {
        startTime: slot.startTime,
        endTime: slot.endTime
    };
};

const HelperScheduleService = {
    /**
     * Đăng ký lịch rảnh hàng loạt
     * Endpoint: POST /api/v1/schedules/register
     * @param {Object} data - ScheduleRegisterRequest
     */
    registerSchedule: async (data) => {
        return apiClient.post(`${SCHEDULE_BASE_URL}/register`, data);
    },

    /**
     * Cập nhật lịch cho 1 ngày
     * Endpoint: PUT /api/v1/schedules/day
     * @param {Object} data - ScheduleUpdateDayRequest
     */
    updateDaySchedule: async (data) => {
        const payload = {
            ...data,
            slots: Array.isArray(data?.slots)
                ? data.slots.map(sanitizeSlotRequest).filter(Boolean)
                : []
        };
        return apiClient.put(`${SCHEDULE_BASE_URL}/day`, payload);
    },

    /**
     * Cập nhật lịch theo chuỗi group
     * Endpoint: PUT /api/v1/schedules/{id}/group
     * @param {number} scheduleId - ID slot lịch bất kỳ thuộc group
     * @param {Array<Object>} newSlots - Danh sách ScheduleSlotRequest mới
     */
    updateGroupSchedule: async (scheduleId, newSlots) => {
        const slotsPayload = Array.isArray(newSlots)
            ? newSlots.map(sanitizeSlotRequest).filter(Boolean)
            : [];
        return apiClient.put(`${SCHEDULE_BASE_URL}/${scheduleId}/group`, slotsPayload);
    },

    /**
     * Lấy lịch theo tháng
     * Endpoint: GET /api/v1/schedules/monthly
     * @param {Object} params
     * @param {number} params.month - Tháng (1-12)
     * @param {number} params.year - Năm (vd: 2026)
     * @param {number} [params.helperId] - ID helper (optional)
     */
    getMonthlySchedule: async ({ month, year, helperId } = {}) => {
        return apiClient.get(`${SCHEDULE_BASE_URL}/monthly`, {
            params: buildOptionalParams({ month, year, helperId })
        });
    },

    /**
     * Lấy toàn bộ lịch làm việc
     * Endpoint: GET /api/v1/schedules/all
     * @param {number} [helperId] - ID helper (optional)
     */
    getAllSchedules: async (helperId) => {
        return apiClient.get(`${SCHEDULE_BASE_URL}/all`, {
            params: buildOptionalParams({ helperId })
        });
    },

    /**
     * Lấy chi tiết 1 slot lịch
     * Endpoint: GET /api/v1/schedules/{id}
     * @param {number} scheduleId - ID slot lịch
     */
    getScheduleDetail: async (scheduleId) => {
        return apiClient.get(`${SCHEDULE_BASE_URL}/${scheduleId}`);
    },

    /**
     * Xóa 1 slot lịch
     * Endpoint: DELETE /api/v1/schedules/{id}
     * @param {number} scheduleId - ID slot lịch
     */
    deleteSchedule: async (scheduleId) => {
        return apiClient.delete(`${SCHEDULE_BASE_URL}/${scheduleId}`);
    },

    /**
     * Hủy 1 ca đã đăng ký (xin nghỉ)
     * Endpoint: PATCH /api/v1/schedules/{id}/cancel
     * @param {number} scheduleId - ID slot lịch
     * @param {string} reason - Lý do nghỉ
     */
    cancelSchedule: async (scheduleId, reason) => {
        return apiClient.patch(`${SCHEDULE_BASE_URL}/${scheduleId}/cancel`, { reason: reason ?? 'No reason provided' });
    },

    /**
     * Hủy nhiều ca theo chu kỳ (từ ca hiện tại trở về sau)
     * Endpoint: PATCH /api/v1/schedules/{id}/cancel-bulk
     * @param {number} scheduleId - ID slot lịch
     * @param {string} reason - Lý do nghỉ
     */
    bulkCancelSchedule: async (scheduleId, reason) => {
        return apiClient.patch(`${SCHEDULE_BASE_URL}/${scheduleId}/cancel-bulk`, { reason: reason ?? 'No reason provided' });
    }
};

export default HelperScheduleService;

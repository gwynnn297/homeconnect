import apiClient from './apiClient';

const HELPER_JOB_BASE_URL = '/api/v1/helper/jobs';

const HelperJobService = {
    /**
     * Lấy danh sách việc làm phù hợp (Job feed)
     * Backend: GET /api/v1/helper/jobs
     * Response: ApiResponse<List<JobPostResponse>>
     */
    getJobFeed: async () => {
        return apiClient.get(`${HELPER_JOB_BASE_URL}`);
    },

    /**
     * Lấy toàn bộ bài đăng việc làm đang mở (không lọc kỹ năng/khu vực)
     * Backend: GET /api/v1/helper/jobs/all
     * Response: ApiResponse<List<JobPostResponse>>
     */
    getAllJobs: async () => {
        return apiClient.get(`${HELPER_JOB_BASE_URL}/all`);
    },

    /**
     * Ứng tuyển công việc
     * Backend: POST /api/v1/helper/jobs/{id}/apply
     * Response: ApiResponse<Void>
     * @param {number|string} jobId
     */
    applyForJob: async (jobId) => {
        return apiClient.post(`${HELPER_JOB_BASE_URL}/${jobId}/apply`);
    }
};

export default HelperJobService;

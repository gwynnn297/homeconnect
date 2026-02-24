const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dpunavotw';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'homeconnect_kyc';

/**
 * Service quản lý upload ảnh lên Cloudinary
 */
const CloudinaryService = {
    /**
     * Upload 1 file ảnh lên Cloudinary
     * @param {File} file - File ảnh cần upload
     * @param {string} folder - Thư mục con (ví dụ: 'kyc/cccd', 'kyc/avatar')
     * @returns {Promise<string>} URL ảnh đã upload
     */
    uploadImage: async (file, folder = 'kyc') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', folder);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Upload ảnh thất bại');
        }

        const data = await response.json();
        return data.secure_url; // URL HTTPS của ảnh
    },

    /**
     * Upload nhiều ảnh cùng lúc
     * @param {Array<{file: File, folder: string}>} files - Mảng các file và folder tương ứng
     * @returns {Promise<string[]>} Mảng URL ảnh đã upload
     */
    uploadMultiple: async (files) => {
        const promises = files.map(({ file, folder }) =>
            CloudinaryService.uploadImage(file, folder)
        );
        return Promise.all(promises);
    },
};

export default CloudinaryService;

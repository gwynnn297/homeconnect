const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_CAPTCHA_LENGTH = 6;

export const generateCaptcha = (length = DEFAULT_CAPTCHA_LENGTH) => {
    const size = Number.isInteger(length) && length > 0 ? length : DEFAULT_CAPTCHA_LENGTH;
    let captcha = '';

    for (let i = 0; i < size; i += 1) {
        const randomIndex = Math.floor(Math.random() * CAPTCHA_CHARS.length);
        captcha += CAPTCHA_CHARS[randomIndex];
    }

    return captcha;
};

export const isCaptchaValid = (input, expected) => {
    if (!input || !expected) return false;
    return String(input).trim().toUpperCase() === String(expected).trim().toUpperCase();
};

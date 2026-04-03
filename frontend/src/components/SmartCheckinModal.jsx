import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import BookingCheckinService from '../services/BookingCheckinService';
import CloudinaryService from '../services/CloudinaryService';
import './SmartCheckinModal.css';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
let modelLoadedPromise = null;

const ACTION_LABELS = {
    TURN_LEFT: 'Quay mặt sang trái',
    TURN_RIGHT: 'Quay mặt sang phải',
    OPEN_MOUTH: 'Mở miệng',
    BLINK: 'Chớp mắt'
};

const toActionLabel = (action) => ACTION_LABELS[action] || action;
const formatActionList = (actions) => actions.map(toActionLabel).join(', ');

const ensureModelsLoaded = async () => {
    if (!modelLoadedPromise) {
        modelLoadedPromise = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
        ]);
    }
    return modelLoadedPromise;
};

const CENTER_SMOOTH_ALPHA = 0.25;

const SmartCheckinModal = ({ isOpen, bookingId, onClose, onSuccess }) => {
    const videoRef = useRef(null);
    const overlayRef = useRef(null);
    const captureCanvasRef = useRef(null);
    const streamRef = useRef(null);
    const detectLoopRef = useRef(null);
    const holdStartRef = useRef(null);
    const challengeRef = useRef(null);
    const actionDoneRef = useRef(new Set());
    const isProcessingRef = useRef(false);
    const latestFaceBoxRef = useRef(null);
    const centerEmaRef = useRef({ x: 0.5, y: 0.5, initialized: false });
    const proofImageUrlRef = useRef('');
    const proofUploadingRef = useRef(false);

    const [challenge, setChallenge] = useState(null);
    const [statusText, setStatusText] = useState('Chuẩn bị camera...');
    const [statusType, setStatusType] = useState('idle');
    const [errorText, setErrorText] = useState('');
    const [finalResult, setFinalResult] = useState(null);
    const [proofImagePreview, setProofImagePreview] = useState('');
    const [proofUploading, setProofUploading] = useState(false);

    const requiredActions = useMemo(() => challenge?.requiredActions || [], [challenge]);
    const getActiveRequiredActions = () => challengeRef.current?.requiredActions || [];

    const stopCamera = () => {
        if (detectLoopRef.current) {
            cancelAnimationFrame(detectLoopRef.current);
            detectLoopRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        holdStartRef.current = null;
        actionDoneRef.current = new Set();
        isProcessingRef.current = false;
        centerEmaRef.current = { x: 0.5, y: 0.5, initialized: false };
    };

    const resetUi = () => {
        challengeRef.current = null;
        setChallenge(null);
        setStatusText('Chuẩn bị camera...');
        setStatusType('idle');
        setErrorText('');
        setFinalResult(null);
        setProofImagePreview('');
        setProofUploading(false);
        proofImageUrlRef.current = '';
        proofUploadingRef.current = false;
    };

    const onProofFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (!dataUrl) {
                setErrorText('Không đọc được ảnh chứng minh. Vui lòng thử lại.');
                return;
            }
            setProofImagePreview(dataUrl);
            setErrorText('');
        };
        reader.onerror = () => setErrorText('Không đọc được ảnh chứng minh. Vui lòng thử lại.');
        reader.readAsDataURL(file);

        try {
            setProofUploading(true);
            proofUploadingRef.current = true;
            setStatusType('loading');
            setStatusText('Đang tải ảnh chứng minh lên Cloudinary...');

            const uploadedUrl = await CloudinaryService.uploadImage(file, 'checkin/arrival-proof');
            proofImageUrlRef.current = uploadedUrl;

            setStatusType('idle');
            setStatusText('Đã tải ảnh chứng minh. Tiếp tục xác thực khuôn mặt.');
            setErrorText('');
        } catch (error) {
            proofImageUrlRef.current = '';
            setStatusType('error');
            setStatusText('Tải ảnh chứng minh thất bại');
            setErrorText(error?.message || 'Không tải được ảnh chứng minh lên Cloudinary.');
        } finally {
            setProofUploading(false);
            proofUploadingRef.current = false;
        }
    };

    const drawGuide = (box, okZone) => {
        const video = videoRef.current;
        const canvas = overlayRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        if (box) {
            ctx.strokeStyle = okZone ? '#16a34a' : '#ef4444';
            ctx.lineWidth = 4;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
        }

        ctx.font = '20px sans-serif';
        ctx.fillStyle = okZone ? '#16a34a' : '#ef4444';
        ctx.fillText(statusText, 16, 32);
    };

    const checkAction = (action, landmarks) => {
        if (!landmarks) return false;

        const nose = landmarks.getNose?.()[3];
        const jaw = landmarks.getJawOutline?.();
        const mouth = landmarks.getMouth?.();

        if (!nose || !jaw) return false;

        const faceCenterX = (jaw[0].x + jaw[16].x) / 2;

        if (action === 'TURN_LEFT') return nose.x < faceCenterX - 10;
        if (action === 'TURN_RIGHT') return nose.x > faceCenterX + 10;

        if (action === 'OPEN_MOUTH') {
            if (!mouth || mouth.length < 11) return false;
            const vertical = Math.abs(mouth[13].y - mouth[19].y);
            const horizontal = Math.abs(mouth[0].x - mouth[6].x);
            const ratio = horizontal > 0 ? vertical / horizontal : 0;
            return ratio > 0.22;
        }

        return false;
    };

    const verifyAndCheckin = async () => {
        if (isProcessingRef.current) return;

        const activeChallenge = challengeRef.current;
        const activeRequiredActions = getActiveRequiredActions();

        if (!activeChallenge?.challengeId || !activeRequiredActions.length) {
            setStatusType('error');
            setStatusText('Challenge không hợp lệ');
            setErrorText('Challenge thiếu hoặc đã hết hạn, vui lòng thử lại.');
            return;
        }

        isProcessingRef.current = true;

        try {
            setStatusText('Đang xác thực khuôn mặt...');
            setStatusType('loading');

            const video = videoRef.current;
            const captureCanvas = captureCanvasRef.current;
            const frameWidth = video.videoWidth || 640;
            const frameHeight = video.videoHeight || 480;
            const faceBox = latestFaceBoxRef.current;

            let sx = 0;
            let sy = 0;
            let sw = frameWidth;
            let sh = frameHeight;

            if (faceBox) {
                const padX = faceBox.width * 0.35;
                const padY = faceBox.height * 0.45;
                sx = Math.max(0, Math.floor(faceBox.x - padX));
                sy = Math.max(0, Math.floor(faceBox.y - padY));
                const maxRight = Math.min(frameWidth, Math.ceil(faceBox.x + faceBox.width + padX));
                const maxBottom = Math.min(frameHeight, Math.ceil(faceBox.y + faceBox.height + padY));
                sw = Math.max(1, maxRight - sx);
                sh = Math.max(1, maxBottom - sy);
            }

            const targetSize = 640;
            captureCanvas.width = targetSize;
            captureCanvas.height = targetSize;
            const cctx = captureCanvas.getContext('2d');
            cctx.fillStyle = '#000';
            cctx.fillRect(0, 0, targetSize, targetSize);

            const scale = Math.min(targetSize / sw, targetSize / sh);
            const dw = sw * scale;
            const dh = sh * scale;
            const dx = (targetSize - dw) / 2;
            const dy = (targetSize - dh) / 2;

            cctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);

            const imageBase64 = captureCanvas.toDataURL('image/jpeg', 0.95);
            const performedActions = activeRequiredActions.filter((action) => actionDoneRef.current.has(action));

            if (!performedActions.length) {
                setStatusType('error');
                setStatusText('Thiếu thao tác liveness');
                setErrorText('Bạn chưa hoàn thành thao tác liveness, vui lòng thử lại.');
                return;
            }

            if (!proofImageUrlRef.current) {
                setStatusType('warning');
                setStatusText('Thiếu ảnh chứng minh địa điểm');
                setErrorText('Vui lòng chụp/tải ảnh nơi làm việc để xác nhận đã đến đúng nhà.');
                setFinalResult({
                    type: 'error',
                    message: 'Thiếu ảnh chứng minh địa điểm. Vui lòng chụp/tải ảnh trước khi xác thực khuôn mặt.'
                });
                return;
            }

            const resp = await BookingCheckinService.verifyCheckin(bookingId, {
                challengeId: activeChallenge.challengeId,
                liveImageBase64: imageBase64,
                proofImageUrl: proofImageUrlRef.current,
                performedActions
            });

            if (resp?.data?.matched) {
                setStatusText('Check-in thành công');
                setStatusType('success');
                setFinalResult({ type: 'success', message: 'Check-in thành công. Booking đã chuyển sang ARRIVED.' });
                stopCamera();
                onSuccess?.(resp.data);
                return;
            }

            const failedMessage = resp?.data?.message || 'Không khớp khuôn mặt, vui lòng thử lại';
            setStatusText(failedMessage);
            setStatusType('error');
            setFinalResult({ type: 'error', message: failedMessage });
            stopCamera();
        } catch (error) {
            const message = error?.message || 'Xác thực thất bại, vui lòng thử lại.';
            setErrorText(message);
            setStatusType('error');
            setStatusText('Xác thực thất bại');
            setFinalResult({ type: 'error', message });
            stopCamera();
        } finally {
            holdStartRef.current = null;
            isProcessingRef.current = false;
        }
    };

    const startDetectLoop = () => {
        const run = async () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2 || !isOpen) {
                detectLoopRef.current = requestAnimationFrame(run);
                return;
            }

            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 }))
                .withFaceLandmarks(true);

            if (!detection) {
                latestFaceBoxRef.current = null;
                holdStartRef.current = null;
                setStatusText('Đưa khuôn mặt vào khung hình');
                setStatusType('warning');
                drawGuide(null, false);
                detectLoopRef.current = requestAnimationFrame(run);
                return;
            }

            const box = detection.detection.box;
            latestFaceBoxRef.current = box;

            const ratio = box.width / (video.videoWidth || 1);
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            const normalizedX = centerX / (video.videoWidth || 1);
            const normalizedY = centerY / (video.videoHeight || 1);

            if (!centerEmaRef.current.initialized) {
                centerEmaRef.current = { x: normalizedX, y: normalizedY, initialized: true };
            } else {
                centerEmaRef.current.x = (1 - CENTER_SMOOTH_ALPHA) * centerEmaRef.current.x + CENTER_SMOOTH_ALPHA * normalizedX;
                centerEmaRef.current.y = (1 - CENTER_SMOOTH_ALPHA) * centerEmaRef.current.y + CENTER_SMOOTH_ALPHA * normalizedY;
            }

            const dx = Math.abs(centerEmaRef.current.x - 0.5) / 0.5;
            const dy = Math.abs(centerEmaRef.current.y - 0.5) / 0.5;

            const activeRequiredActions = getActiveRequiredActions();
            activeRequiredActions.forEach((action) => {
                if (!actionDoneRef.current.has(action) && checkAction(action, detection.landmarks)) {
                    actionDoneRef.current.add(action);
                }
            });

            const actionsReady = activeRequiredActions.length > 0;
            const actionsDone = actionsReady && activeRequiredActions.every((action) => actionDoneRef.current.has(action));

            let okZone = false;
            if (ratio < 0.22) {
                setStatusText('Vui lòng đưa mặt lại gần hơn');
                setStatusType('warning');
            } else if (ratio > 0.7) {
                setStatusText('Vui lòng để điện thoại xa ra một chút');
                setStatusType('warning');
            } else if (dx > 0.35 || dy > 0.35) {
                setStatusText('Vui lòng đưa khuôn mặt vào giữa màn hình');
                setStatusType('warning');
            } else if (!actionsReady) {
                setStatusText('Đang đồng bộ challenge, vui lòng giữ nguyên vị trí...');
                setStatusType('warning');
            } else if (!actionsDone) {
                const missing = activeRequiredActions.filter((action) => !actionDoneRef.current.has(action));
                setStatusText(`Thực hiện thao tác: ${formatActionList(missing)}`);
                setStatusType('warning');
            } else if (proofUploadingRef.current) {
                setStatusText('Đang tải ảnh chứng minh lên Cloudinary...');
                setStatusType('warning');
            } else if (!proofImageUrlRef.current) {
                setStatusText('Vui lòng chụp/tải ảnh chứng minh địa điểm trước khi xác thực');
                setStatusType('warning');
            } else {
                okZone = true;
                const now = Date.now();
                if (!holdStartRef.current) holdStartRef.current = now;
                const elapsed = (now - holdStartRef.current) / 1000;
                const remain = Math.max(0, 2 - elapsed);
                setStatusText(`Xin giữ yên trong ${remain.toFixed(1)} giây...`);
                setStatusType('success');

                if (elapsed >= 2 && !isProcessingRef.current) {
                    await verifyAndCheckin();
                }
            }

            if (!okZone) holdStartRef.current = null;

            drawGuide(detection.detection, okZone);
            detectLoopRef.current = requestAnimationFrame(run);
        };

        detectLoopRef.current = requestAnimationFrame(run);
    };

    const startFlow = async () => {
        try {
            setErrorText('');
            setStatusText('Đang tạo challenge...');

            const challengeResp = await BookingCheckinService.createChallenge(bookingId);
            challengeRef.current = challengeResp.data;
            setChallenge(challengeResp.data);

            setStatusText('Đang mở camera...');
            await ensureModelsLoaded();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            });

            streamRef.current = stream;
            const video = videoRef.current;
            video.srcObject = stream;
            await video.play();

            setStatusText('Đã sẵn sàng, hãy thực hiện theo hướng dẫn');
            setStatusType('idle');
            startDetectLoop();
        } catch (error) {
            setErrorText(error?.message || 'Không thể khởi tạo camera/check-in');
            setStatusType('error');
            setStatusText('Khởi tạo thất bại');
        }
    };

    useEffect(() => {
        if (!isOpen || !bookingId) return undefined;
        startFlow();

        return () => {
            stopCamera();
            resetUi();
        };
    }, [isOpen, bookingId]);

    if (!isOpen) return null;

    const handleRetry = () => {
        stopCamera();
        resetUi();
        startFlow();
    };

    const handleClose = () => {
        stopCamera();
        resetUi();
        onClose?.();
    };

    return (
        <div className="scm-overlay" onClick={handleClose}>
            <div className="scm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="scm-header">
                    <h3>Check-in thông minh</h3>
                    <button type="button" className="scm-close" onClick={handleClose}>×</button>
                </div>

                <div className="scm-body">
                    <div className="scm-video-wrap">
                        <video ref={videoRef} className="scm-video" muted playsInline />
                        <canvas ref={overlayRef} className="scm-overlay-canvas" />
                        <canvas ref={captureCanvasRef} className="scm-hidden-canvas" />
                    </div>

                    {requiredActions.length > 0 && (
                        <div className="scm-actions">
                            <strong>Yêu cầu:</strong> {requiredActions.map(toActionLabel).join(' → ')}
                        </div>
                    )}

                    <div className="scm-actions">
                        <strong>Ảnh chứng minh đã đến nơi:</strong>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={onProofFileChange}
                        />
                        {proofUploading && (
                            <div style={{ marginTop: 8, color: '#0369a1', fontSize: 13 }}>
                                Đang tải ảnh lên Cloudinary...
                            </div>
                        )}
                        {proofImagePreview && (
                            <div style={{ marginTop: 8 }}>
                                <img src={proofImagePreview} alt="Proof" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }} />
                            </div>
                        )}
                    </div>

                    <div className={`scm-status ${statusType}`}>{statusText}</div>
                    {errorText && <div className="scm-error">{errorText}</div>}

                    {finalResult && (
                        <div className={`scm-result scm-result--${finalResult.type}`}>
                            {finalResult.message}
                        </div>
                    )}

                    {finalResult && (
                        <div className="scm-actions-row">
                            {finalResult.type === 'error' && (
                                <button type="button" className="scm-btn scm-btn--retry" onClick={handleRetry}>
                                    Thử lại
                                </button>
                            )}
                            <button type="button" className="scm-btn scm-btn--close" onClick={handleClose}>
                                Đóng
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartCheckinModal;

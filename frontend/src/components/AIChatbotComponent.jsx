import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIChatNLPService from '../services/AIChatNLPService';
import ProfileService from '../services/ProfileService';
import './AIChatbotComponent.css';

const EXAMPLE_PROMPTS = [
    'Dọn nhà 3 tiếng sáng mai',
    'Trông trẻ 4 tiếng chiều thứ 7',
    'Nấu ăn 2 tiếng tối mai',
];

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const CATEGORY_ID_TO_SERVICE_NAME = {
    1: 'Dọn dẹp nhà cửa',
    2: 'Nấu ăn',
    3: 'Đi chợ',
    4: 'Vệ sinh văn phòng',
    5: 'Trông trẻ',
    6: 'Làm vườn',
    7: 'Sơn sửa',
};
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

const resolveAvatarUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw;
    }
    if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
    return `${API_BASE_URL}/${raw}`;
};

const formatDateDisplay = (value) => {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return raw;
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
};

const formatParsedSummary = (parsed) => {
    const parts = [];
    if (parsed?.categoryId) {
        const serviceName = CATEGORY_ID_TO_SERVICE_NAME[Number(parsed.categoryId)];
        parts.push(serviceName ? `Dịch vụ: ${serviceName}` : `Dịch vụ #${parsed.categoryId}`);
    }
    if (parsed?.durationHours) parts.push(`${parsed.durationHours} giờ`);
    if (parsed?.workDate) parts.push(formatDateDisplay(parsed.workDate));
    if (parsed?.startTime) parts.push(parsed.startTime);
    return parts.join(' • ') || 'Chưa parse được đủ dữ liệu.';
};

const PARSE_FIELDS = ['categoryId', 'durationHours', 'workDate', 'startTime', 'addressId'];

const parseDescriptionToSaveRequest = (description = '') => {
    const parts = String(description)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 4) return null;

    const provinceName = parts[parts.length - 1];
    const districtName = parts[parts.length - 2];
    const wardName = parts[parts.length - 3];
    const addressDetail = parts.slice(0, parts.length - 3).join(', ');
    if (!addressDetail || !wardName || !districtName || !provinceName) return null;

    return { addressDetail, wardName, districtName, provinceName };
};

const buildFullAddress = (address = {}) => {
    const parts = [
        address?.addressDetail,
        address?.wardName,
        address?.districtName,
        address?.provinceName,
    ]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
    return parts.join(', ');
};

const normalizeText = (value = '') =>
    String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const createWelcomeMessage = () => ({
    id: 'welcome',
    role: 'assistant',
    type: 'text',
    text: 'Xin chào! Bạn có thể nhập yêu cầu như "Dọn nhà 3 tiếng sáng mai" để mình hiểu và gợi ý đặt lịch.',
});

const getAvatarFallback = (fullName = '') => {
    const text = String(fullName || '').trim();
    if (!text) return 'H';
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
    return `${words[0].slice(0, 1)}${words[words.length - 1].slice(0, 1)}`.toUpperCase();
};

const mapSessionMessage = (m) => ({
    id: m.id,
    role: m.sender === 'customer' ? 'user' : 'assistant',
    type: m.messageType || 'text',
    text: m.content || '',
    followUpQuestion: m.content || '',
    ...(m.structuredData || {}),
    ...((m.structuredData || {}).parsed ? { parsed: m.structuredData.parsed } : {}),
    ...((m.structuredData || {}).helpers ? { helpers: m.structuredData.helpers } : {}),
    ...((m.structuredData || {}).addresses ? { addresses: m.structuredData.addresses } : {}),
    ...((m.structuredData || {}).missingFields ? { missingFields: m.structuredData.missingFields } : {}),
    topupUrl: (m.structuredData || {}).topupUrl,
    requiredTopup: (m.structuredData || {}).requiredTopup,
    bookingUrl: (m.structuredData || {}).bookingUrl,
});

const toSessionTitle = (rawValue) => {
    const rawTitle = String(rawValue || '').trim();
    if (!rawTitle) return 'Đoạn chat mới';
    return rawTitle.length > 40 ? `${rawTitle.slice(0, 40)}...` : rawTitle;
};

const mapSessionHistoryItem = (session, resolvedTitle) => {
    const context = session?.context && typeof session.context === 'object' ? session.context : {};
    const title = toSessionTitle(resolvedTitle || context.firstUserMessage || context.lastUserMessage);
    return {
        id: session?.id,
        title,
        updatedAt: session?.updatedAt || session?.createdAt || null,
    };
};

const AIChatbotComponent = () => {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const addressDebounceRef = useRef(null);
    const latestAddressQueryRef = useRef('');
    const resumedSessionRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [addressQuery, setAddressQuery] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isAddressSuggestLoading, setIsAddressSuggestLoading] = useState(false);
    const [addressSuggestError, setAddressSuggestError] = useState('');
    const [isSavingAddress, setIsSavingAddress] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [selectedAddressDisplay, setSelectedAddressDisplay] = useState('');
    const [messages, setMessages] = useState([createWelcomeMessage()]);
    const [helperProfileModal, setHelperProfileModal] = useState({
        open: false,
        loading: false,
        error: '',
        helperId: null,
        helperName: '',
        helperAvatarUrl: '',
        profile: null,
    });

    const canSubmit = useMemo(
        () => !isLoading && String(inputValue || '').trim().length > 0,
        [isLoading, inputValue]
    );
    const currentCity = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const msg = messages[i];
            if (msg?.type !== 'address_list' || !Array.isArray(msg?.addresses)) continue;
            const list = msg.addresses;
            const preferred = list.find((a) => a?.isDefault && a?.provinceName) || list.find((a) => a?.provinceName);
            if (preferred?.provinceName) return String(preferred.provinceName).trim();
            const fromFullAddress = list
                .map((a) => String(a?.fullAddress || '').split(',').map((x) => x.trim()).filter(Boolean))
                .find((parts) => parts.length > 0);
            if (fromFullAddress && fromFullAddress.length > 0) {
                return fromFullAddress[fromFullAddress.length - 1];
            }
        }
        return '';
    }, [messages]);

    const FIELD_VI_LABELS = useMemo(
        () => ({
            categoryId: 'dịch vụ',
            durationHours: 'số giờ',
            workDate: 'ngày làm',
            startTime: 'giờ bắt đầu',
            addressId: 'địa chỉ làm việc',
        }),
        []
    );
    const REQUIRED_PARSE_FIELDS = useMemo(
        () => ['categoryId', 'durationHours', 'workDate', 'startTime'],
        []
    );

    const isFieldPresent = (field, parsed) => parsed?.[field] != null && parsed?.[field] !== '';

    const computeDisplayMissingFields = (parsed, missingFields) => {
        const rawMissing = Array.isArray(missingFields) ? missingFields : [];
        const normalizedMissing = rawMissing.filter((field) => REQUIRED_PARSE_FIELDS.includes(field));
        const hasAnyParsedData = REQUIRED_PARSE_FIELDS.some((field) => isFieldPresent(field, parsed));

        // Message chào hoặc text thường không có parsed/missingFields => không hiển thị parse-card.
        if (normalizedMissing.length === 0 && !hasAnyParsedData) {
            return [];
        }

        if (normalizedMissing.length > 0) {
            return normalizedMissing.filter((field) => !isFieldPresent(field, parsed));
        }

        return REQUIRED_PARSE_FIELDS.filter((field) => !isFieldPresent(field, parsed));
    };

    const buildMissingFieldsFollowUp = (missingFields) => {
        if (!Array.isArray(missingFields) || missingFields.length === 0) return '';
        const labels = missingFields.map((field) => FIELD_VI_LABELS[field] ?? field).join(', ');
        return `Mình còn thiếu ${labels}. Bạn bổ sung giúp mình nhé?`;
    };

    const resolveDisplayFollowUpQuestion = (rawFollowUpQuestion, missingFields) => {
        const raw = String(rawFollowUpQuestion || '').trim();
        const normalized = normalizeText(raw);
        const isGenericMissingPrompt = normalized.startsWith('minh con thieu ');
        if (isGenericMissingPrompt) {
            return buildMissingFieldsFollowUp(missingFields) || raw;
        }
        return raw || buildMissingFieldsFollowUp(missingFields);
    };

    const addressDisplayById = useMemo(() => {
        const map = new Map();
        messages.forEach((msg) => {
            if (!Array.isArray(msg?.addresses)) return;
            msg.addresses.forEach((addr) => {
                const id = Number(addr?.addressId);
                if (!Number.isFinite(id)) return;
                const fullAddress = String(addr?.fullAddress || '').trim();
                if (fullAddress) map.set(id, fullAddress);
            });
        });
        return map;
    }, [messages]);
    const formatFieldDisplayValue = (field, value) => {
        if (value == null || value === '') return 'Chưa có';
        if (field === 'categoryId') {
            return CATEGORY_ID_TO_SERVICE_NAME[Number(value)] ?? 'Chưa có';
        }
        if (field === 'addressId') {
            const id = Number(value);
            if (Number.isFinite(id)) {
                if (selectedAddressId != null && Number(selectedAddressId) === id && selectedAddressDisplay) {
                    return selectedAddressDisplay;
                }
                return addressDisplayById.get(id) || String(value);
            }
        }
        if (field === 'workDate') {
            return formatDateDisplay(value);
        }
        return String(value);
    };
    const hasParsedData = (parsed) => {
        if (!parsed || typeof parsed !== 'object') return false;
        return PARSE_FIELDS.some((field) => parsed[field] != null && parsed[field] !== '');
    };
    const getPresentFields = (parsed) =>
        PARSE_FIELDS.filter((field) => parsed?.[field] != null && parsed?.[field] !== '');

    const appendMessage = (message) => {
        setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...message }]);
    };

    const refreshSessionHistory = async () => {
        const sessionsRes = await AIChatNLPService.getSessions();
        const sessionsPayload = extractPayload(sessionsRes);
        const list = Array.isArray(sessionsPayload) ? sessionsPayload : [];
        const resolvedItems = await Promise.all(
            list.map(async (session) => {
                const context = session?.context && typeof session.context === 'object' ? session.context : {};
                const contextTitle = String(context.firstUserMessage || '').trim();
                if (contextTitle) {
                    return mapSessionHistoryItem(session, contextTitle);
                }

                try {
                    const messagesRes = await AIChatNLPService.getSessionMessages(session?.id);
                    const messagesPayload = extractPayload(messagesRes);
                    const firstUserMessage = Array.isArray(messagesPayload)
                        ? messagesPayload.find(
                            (m) => m?.sender === 'customer' && String(m?.content || '').trim().length > 0
                        )
                        : null;
                    return mapSessionHistoryItem(session, firstUserMessage?.content);
                } catch {
                    return mapSessionHistoryItem(session);
                }
            })
        );
        setSessionHistory(resolvedItems.filter((item) => item.id));
    };

    useEffect(() => {
        refreshSessionHistory().catch(() => {
            setSessionHistory([]);
        });
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const restoredSessionId = params.get('chatSessionId');
        if (!restoredSessionId) return;
        if (resumedSessionRef.current === restoredSessionId) return;
        resumedSessionRef.current = restoredSessionId;

        const restore = async () => {
            setIsLoading(true);
            try {
                setSessionId(restoredSessionId);
                const historyRes = await AIChatNLPService.getSessionMessages(restoredSessionId);
                const historyPayload = extractPayload(historyRes);
                const restoredMessages = Array.isArray(historyPayload)
                    ? historyPayload.map(mapSessionMessage)
                    : [];
                if (restoredMessages.length > 0) {
                    setMessages(restoredMessages);
                }
                await refreshSessionHistory();

                const resumeRes = await AIChatNLPService.resumeAfterTopup(restoredSessionId);
                const resumePayload = extractPayload(resumeRes);
                const assistant = resumePayload?.assistantMessage;
                const type = assistant?.messageType || 'text';
                const text = assistant?.content || 'Mình đã resume phiên chat trước đó.';
                const structured = assistant?.structuredData ?? {};
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    const isDuplicateResumeMessage =
                        last?.role === 'assistant' &&
                        last?.type === type &&
                        String(last?.text || '').trim() === String(text).trim();
                    if (isDuplicateResumeMessage) return prev;
                    return [...prev, { id: `${Date.now()}-${Math.random()}`, role: 'assistant', type, text, ...structured }];
                });

                const currentUrl = new URL(window.location.href);
                if (currentUrl.searchParams.has('chatSessionId')) {
                    currentUrl.searchParams.delete('chatSessionId');
                    window.history.replaceState({}, '', currentUrl.toString());
                }
            } catch (error) {
                appendMessage({
                    role: 'assistant',
                    type: 'error',
                    text: error?.message || 'Không thể khôi phục phiên chat trước đó.',
                });
            } finally {
                setIsLoading(false);
            }
        };

        restore();
    }, []);

    const handleSend = async (rawMessage) => {
        const message = String(rawMessage ?? inputValue).trim();
        if (!message || isLoading) return;

        appendMessage({ role: 'user', type: 'text', text: message });
        setInputValue('');
        setIsLoading(true);

        try {
            let activeSessionId = sessionId;
            if (!activeSessionId) {
                const sessionRes = await AIChatNLPService.createSession('web');
                const createdSession = extractPayload(sessionRes);
                activeSessionId = createdSession?.id;
                setSessionId(activeSessionId);
                await refreshSessionHistory();
            }

            const res = await AIChatNLPService.sendSessionMessage(activeSessionId, message);
            const payload = extractPayload(res);
            const assistant = payload?.assistantMessage;
            const structured = assistant?.structuredData ?? {};
            const parsed = structured?.parsed ?? {};
            const helpers = Array.isArray(structured?.helpers) ? structured.helpers : [];
            const addresses = Array.isArray(structured?.addresses) ? structured.addresses : [];
            const requiredTopup = structured?.requiredTopup;
            const topupUrl = structured?.topupUrl;
            const bookingUrl = structured?.bookingUrl;
            const bookingDetailUrl = structured?.bookingDetailUrl;
            const missingFields = Array.isArray(structured?.missingFields)
                ? structured.missingFields
                : Array.isArray(parsed?.missingFields)
                    ? parsed.missingFields
                    : [];
            const displayMissingFields = computeDisplayMissingFields(parsed, missingFields);
            const followUpQuestion = resolveDisplayFollowUpQuestion(
                assistant?.content || parsed?.followUpQuestion || '',
                displayMissingFields
            );

            appendMessage({
                role: 'assistant',
                type: assistant?.messageType || 'text',
                text: followUpQuestion || 'Mình đã hiểu yêu cầu sơ bộ của bạn.',
                followUpQuestion,
                parsed,
                missingFields: displayMissingFields,
                helpers,
                addresses,
                topupUrl,
                bookingUrl,
                requiredTopup,
                bookingDetailUrl,
                canConfirm: structured?.canConfirm,
            });
            await refreshSessionHistory();
        } catch (error) {
            appendMessage({
                role: 'assistant',
                type: 'error',
                text: error?.message || 'Chưa gọi được AI parser. Bạn thử lại sau nhé.',
            });
        } finally {
            setIsLoading(false);
            window.setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    const handleStartNewChat = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const sessionRes = await AIChatNLPService.createSession('web');
            const createdSession = extractPayload(sessionRes);
            const newSessionId = createdSession?.id;
            setSessionId(newSessionId || null);
            setMessages([createWelcomeMessage()]);
            setInputValue('');
            setAddressQuery('');
            setAddressSuggestions([]);
            setAddressSuggestError('');
            setSelectedAddressDisplay('');
            setSelectedAddressId(null);
            if (newSessionId) await refreshSessionHistory();
            setIsHistoryOpen(false);
        } catch (error) {
            appendMessage({
                role: 'assistant',
                type: 'error',
                text: error?.message || 'Không thể tạo đoạn chat mới lúc này.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadSession = async (targetSessionId) => {
        if (!targetSessionId || isLoading) return;
        setIsLoading(true);
        try {
            const historyRes = await AIChatNLPService.getSessionMessages(targetSessionId);
            const historyPayload = extractPayload(historyRes);
            const restoredMessages = Array.isArray(historyPayload)
                ? historyPayload.map(mapSessionMessage)
                : [];
            setSessionId(targetSessionId);
            setMessages(restoredMessages.length > 0 ? restoredMessages : [createWelcomeMessage()]);
            setSelectedAddressDisplay('');
            setSelectedAddressId(null);
            await refreshSessionHistory();
            setIsHistoryOpen(false);
        } catch (error) {
            appendMessage({
                role: 'assistant',
                type: 'error',
                text: error?.message || 'Không thể tải lịch sử đoạn chat này.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteSession = async (targetSessionId) => {
        if (!targetSessionId || isLoading) return;
        setIsLoading(true);
        try {
            await AIChatNLPService.deleteSession(targetSessionId);
            if (sessionId === targetSessionId) {
                setSessionId(null);
                setMessages([createWelcomeMessage()]);
                setSelectedAddressDisplay('');
                setSelectedAddressId(null);
            }
            await refreshSessionHistory();
        } catch (error) {
            appendMessage({
                role: 'assistant',
                type: 'error',
                text: error?.message || 'Không thể xóa đoạn chat lúc này.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const handleSelectHelper = async (helperId) => {
        if (!sessionId || !helperId || isLoading) return;
        setIsLoading(true);
        try {
            const res = await AIChatNLPService.selectHelper(sessionId, helperId);
            const payload = extractPayload(res);
            const assistant = payload?.assistantMessage;
            const structured = assistant?.structuredData ?? {};

            appendMessage({
                role: 'assistant',
                type: assistant?.messageType || 'text',
                text: assistant?.content || 'Mình đã xử lý lựa chọn helper của bạn.',
                topupUrl: structured?.topupUrl,
                bookingUrl: structured?.bookingUrl,
                requiredTopup: structured?.requiredTopup,
                canConfirm: structured?.canConfirm,
            });
        } catch (error) {
            appendMessage({
                role: 'assistant',
                type: 'error',
                text: error?.message || 'Chưa chọn được helper. Bạn thử lại nhé.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectAddress = async (addressId, fullAddress) => {
        if (!sessionId || !addressId || isLoading) return;
        setIsLoading(true);
        try {
            const res = await AIChatNLPService.selectAddress(sessionId, addressId);
            const payload = extractPayload(res);
            const assistant = payload?.assistantMessage;
            const structured = assistant?.structuredData ?? {};
            const selectedLabel = String(fullAddress || '').trim();
            if (selectedLabel) {
                setSelectedAddressDisplay(selectedLabel);
                setSelectedAddressId(addressId);
            }
            appendMessage({
                role: 'assistant',
                type: assistant?.messageType || 'text',
                text: assistant?.content || 'Đã chọn địa chỉ thành công.',
                parsed: structured?.parsed,
                missingFields: structured?.missingFields,
                helpers: structured?.helpers,
                addresses: structured?.addresses,
            });
        } catch (error) {
            appendMessage({
                role: 'assistant',
                type: 'error',
                text: error?.message || 'Không thể chọn địa chỉ lúc này.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmBooking = async () => {
        if (!sessionId || isLoading) return;
        setIsLoading(true);
        try {
            const res = await AIChatNLPService.confirmBooking(sessionId);
            const payload = extractPayload(res);
            const assistant = payload?.assistantMessage;
            const structured = assistant?.structuredData ?? {};
            appendMessage({
                role: 'assistant',
                type: assistant?.messageType || 'text',
                text: assistant?.content || 'Đã tạo booking thành công.',
                bookingDetailUrl: structured?.bookingDetailUrl,
                bookingId: structured?.bookingId,
            });
        } catch (error) {
            appendMessage({
                role: 'assistant',
                type: 'error',
                text: error?.message || 'Không thể xác nhận booking lúc này.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenHelperProfile = async (helper) => {
        const helperId = Number(helper?.helperId);
        if (!Number.isFinite(helperId) || isLoading) return;

        setHelperProfileModal({
            open: true,
            loading: true,
            error: '',
            helperId,
            helperName: String(helper?.fullName || '').trim(),
            helperAvatarUrl: String(helper?.avatarUrl || '').trim(),
            profile: null,
        });

        try {
            const res = await ProfileService.getPublicHelperProfile(helperId);
            const payload = extractPayload(res);
            setHelperProfileModal((prev) => ({
                ...prev,
                loading: false,
                profile: payload || null,
            }));
        } catch (error) {
            setHelperProfileModal((prev) => ({
                ...prev,
                loading: false,
                error: error?.message || 'Không thể tải hồ sơ helper lúc này.',
            }));
        }
    };

    const handleCloseHelperProfile = () => {
        setHelperProfileModal({
            open: false,
            loading: false,
            error: '',
            helperId: null,
            helperName: '',
            helperAvatarUrl: '',
            profile: null,
        });
    };

    const fetchAddressSuggestions = async (query) => {
        const q = String(query || '').trim();
        if (q.length < 3) {
            setAddressSuggestions([]);
            setAddressSuggestError('');
            setIsAddressSuggestLoading(false);
            return;
        }

        setIsAddressSuggestLoading(true);
        setAddressSuggestError('');
        try {
            const res = await AIChatNLPService.autocompleteAddress(q);
            const payload = extractPayload(res);
            if (latestAddressQueryRef.current !== q) return;

            const suggestions = Array.isArray(payload) ? payload : [];
            setAddressSuggestions(suggestions);
            if (suggestions.length === 0) {
                setAddressSuggestError('Không tìm thấy gợi ý địa chỉ phù hợp. Bạn nhập chi tiết hơn giúp mình nhé.');
            }
        } catch (error) {
            if (latestAddressQueryRef.current !== q) return;
            setAddressSuggestions([]);
            setAddressSuggestError(error?.message || 'Không thể lấy gợi ý địa chỉ lúc này.');
        } finally {
            if (latestAddressQueryRef.current === q) {
                setIsAddressSuggestLoading(false);
            }
        }
    };

    useEffect(() => {
        latestAddressQueryRef.current = String(addressQuery || '').trim();
        if (addressDebounceRef.current) {
            clearTimeout(addressDebounceRef.current);
        }
        addressDebounceRef.current = setTimeout(() => {
            fetchAddressSuggestions(latestAddressQueryRef.current);
        }, 1000);

        return () => {
            if (addressDebounceRef.current) {
                clearTimeout(addressDebounceRef.current);
            }
        };
    }, [addressQuery]);

    useEffect(() => {
        if (!isOpen) return;
        const container = messagesContainerRef.current;
        if (!container) return;

        const rafId = window.requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });

        return () => window.cancelAnimationFrame(rafId);
    }, [messages, isLoading, isOpen]);

    const handlePickAddressSuggestion = async (suggestion) => {
        const placeId = suggestion?.place_id || suggestion?.placeId;
        const description = suggestion?.description || '';
        const parsed = parseDescriptionToSaveRequest(description);
        if (!placeId || !parsed) {
            setAddressSuggestError('Địa chỉ gợi ý chưa đủ thông tin. Bạn thử gợi ý khác hoặc nhập chi tiết hơn.');
            return;
        }
        if (!sessionId) {
            setAddressSuggestError('Phiên chat chưa sẵn sàng. Bạn gửi lại yêu cầu giúp mình.');
            return;
        }

        setIsSavingAddress(true);
        setAddressSuggestError('');
        try {
            const saveRes = await AIChatNLPService.createAddress({
                ...parsed,
                placeId,
                type: 'HOME',
                isDefault: false,
            });
            const savedAddress = extractPayload(saveRes);
            const addressId = savedAddress?.addressId;
            if (!addressId) {
                throw new Error('Lưu địa chỉ mới thất bại.');
            }

            const selectRes = await AIChatNLPService.selectAddress(sessionId, addressId);
            const payload = extractPayload(selectRes);
            const assistant = payload?.assistantMessage;
            const structured = assistant?.structuredData ?? {};
            const selectedLabel = buildFullAddress(savedAddress) || description;
            setAddressSuggestions([]);
            setAddressQuery('');
            setSelectedAddressDisplay(selectedLabel);
            setSelectedAddressId(addressId);
            appendMessage({
                role: 'assistant',
                type: assistant?.messageType || 'text',
                text: assistant?.content || 'Đã lưu và chọn địa chỉ mới thành công.',
                parsed: structured?.parsed,
                missingFields: structured?.missingFields,
                helpers: structured?.helpers,
                addresses: structured?.addresses,
            });
        } catch (error) {
            setAddressSuggestError(error?.message || 'Không thể lưu/chọn địa chỉ mới lúc này.');
        } finally {
            setIsSavingAddress(false);
        }
    };

    const handleAddressInputKeyDown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const q = String(addressQuery || '').trim();
        latestAddressQueryRef.current = q;
        if (addressDebounceRef.current) {
            clearTimeout(addressDebounceRef.current);
        }
        fetchAddressSuggestions(q);
    };

    return (
        <div className="ai-chatbot-shell">
            {isOpen && (
                <div className="ai-chatbot-panel" role="dialog" aria-label="AI chatbot đặt lịch">
                    <div className="ai-chatbot-header">
                        <div className="ai-chatbot-header-left">
                            <button
                                type="button"
                                className="ai-chatbot-menu-btn"
                                onClick={() => setIsHistoryOpen((prev) => !prev)}
                                aria-label="Mở lịch sử chat"
                            >
                                ☰
                            </button>
                            <div>
                                <div className="ai-chatbot-title">AI Đặt Lịch</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="ai-chatbot-close"
                            onClick={() => setIsOpen(false)}
                            aria-label="Đóng chatbot"
                        >
                            ×
                        </button>
                    </div>

                    <div className="ai-chatbot-body">
                        {isHistoryOpen && (
                            <button
                                type="button"
                                className="ai-chatbot-history-backdrop"
                                onClick={() => setIsHistoryOpen(false)}
                                aria-label="Đóng lịch sử chat"
                            />
                        )}
                        <div className={`ai-chatbot-history-panel ${isHistoryOpen ? 'open' : ''}`}>
                            <button
                                type="button"
                                className="ai-chatbot-history-new"
                                onClick={handleStartNewChat}
                                disabled={isLoading}
                            >
                                + Đoạn chat mới
                            </button>
                            <div className="ai-chatbot-history-list">
                                {sessionHistory.length === 0 ? (
                                    <div className="ai-chatbot-history-empty">Chưa có lịch sử chat.</div>
                                ) : (
                                    sessionHistory.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`ai-chatbot-history-item ${sessionId === item.id ? 'active' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className="ai-chatbot-history-title"
                                                onClick={() => handleLoadSession(item.id)}
                                                disabled={isLoading}
                                            >
                                                {item.title || 'Đoạn chat'}
                                            </button>
                                            <button
                                                type="button"
                                                className="ai-chatbot-history-delete"
                                                onClick={() => handleDeleteSession(item.id)}
                                                disabled={isLoading}
                                                aria-label="Xóa đoạn chat"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="ai-chatbot-examples">
                            {EXAMPLE_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    className="ai-chatbot-chip"
                                    onClick={() => handleSend(prompt)}
                                    disabled={isLoading}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        <div className="ai-chatbot-messages" ref={messagesContainerRef}>
                            {messages.map((message) => {
                                const displayMissingFields = computeDisplayMissingFields(message.parsed, message.missingFields);
                                const displayFollowUpQuestion = resolveDisplayFollowUpQuestion(
                                    message.followUpQuestion || message.text,
                                    displayMissingFields
                                );
                                return (
                                    <div
                                        key={message.id}
                                        className={`ai-chatbot-message ${message.role === 'user' ? 'user' : 'assistant'}`}
                                    >
                                        <div className="ai-chatbot-bubble">
                                            <div>{message.text}</div>

                                            {message.role === 'assistant' && (hasParsedData(message.parsed) || displayMissingFields.length > 0) && (
                                                <div className="ai-chatbot-parse-card">
                                                    <div className="ai-chatbot-parse-title">Kết quả hiểu yêu cầu</div>
                                                    {hasParsedData(message.parsed) && (
                                                        <div className="ai-chatbot-parse-summary">
                                                            {formatParsedSummary(message.parsed)}
                                                        </div>
                                                    )}

                                                    {(getPresentFields(message.parsed).length > 0 || displayMissingFields.length > 0) && (
                                                        <div className="ai-chatbot-parse-list">
                                                            {PARSE_FIELDS.map((field) => {
                                                                const label = FIELD_VI_LABELS[field] ?? field;
                                                                const value = message.parsed?.[field];
                                                                const isMissing = displayMissingFields.includes(field);
                                                                return (
                                                                    <div key={field} className="ai-chatbot-parse-row">
                                                                        <span className="ai-chatbot-parse-row-label">{label}:</span>{' '}
                                                                        <span className={`ai-chatbot-parse-row-value ${isMissing ? 'is-missing' : ''}`}>
                                                                            {formatFieldDisplayValue(field, value)}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {displayMissingFields.length > 0 ? (
                                                        <div className="ai-chatbot-warning">
                                                            {displayFollowUpQuestion}
                                                        </div>
                                                    ) : null}

                                                </div>
                                            )}

                                            {message.type === 'helper_list' && Array.isArray(message.helpers) && message.helpers.length > 0 && (
                                                <div className="ai-chatbot-parse-card">
                                                    <div className="ai-chatbot-parse-title">Helper phù hợp</div>
                                                    <div className="ai-chatbot-helper-list">
                                                        {message.helpers.map((helper) => (
                                                            <div key={helper.helperId} className="ai-chatbot-helper-card">
                                                                {(() => {
                                                                    const discountRate = Number(helper.discountRate ?? 0);
                                                                    const discountPercent = Number.isFinite(discountRate)
                                                                        ? (discountRate * 100).toFixed(0)
                                                                        : '0';
                                                                    const originalPrice = helper.originalPrice ?? helper.estimatedPrice ?? 0;
                                                                    const finalPrice = helper.finalPrice ?? helper.estimatedPrice ?? 0;
                                                                    return (
                                                                        <>
                                                                <div className="ai-chatbot-helper-header">
                                                                    <button
                                                                        type="button"
                                                                        className="ai-chatbot-helper-avatar-button"
                                                                        onClick={() => handleOpenHelperProfile(helper)}
                                                                        title="Xem hồ sơ helper"
                                                                    >
                                                                        {helper.avatarUrl ? (
                                                                            <img
                                                                                src={resolveAvatarUrl(helper.avatarUrl)}
                                                                                alt={helper.fullName || 'Helper'}
                                                                                className="ai-chatbot-helper-avatar"
                                                                            />
                                                                        ) : (
                                                                            <span className="ai-chatbot-helper-avatar-fallback">
                                                                                {getAvatarFallback(helper.fullName)}
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                    <div className="ai-chatbot-helper-name-wrap">
                                                                        <div className="ai-chatbot-helper-name">{helper.fullName}</div>
                                                                        <button
                                                                            type="button"
                                                                            className="ai-chatbot-helper-profile-link"
                                                                            onClick={() => handleOpenHelperProfile(helper)}
                                                                        >
                                                                            Xem hồ sơ
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="ai-chatbot-helper-meta">
                                                                    ⭐ {helper.ratingAverage ?? 0} ({helper.totalReviews ?? 0} đánh giá)
                                                                </div>
                                                                <div className="ai-chatbot-helper-meta">
                                                                    Giá gốc: {originalPrice} VNĐ
                                                                </div>
                                                                <div className="ai-chatbot-helper-meta">
                                                                    % ưu đãi theo hạng hiện tại: {discountPercent}%{helper.customerTierLabel ? ` (${helper.customerTierLabel})` : ''}
                                                                </div>
                                                                <div className="ai-chatbot-helper-meta">
                                                                    Giá sau ưu đãi: {finalPrice} VNĐ
                                                                </div>
                                                                {helper.premiumFee != null && Number(helper.premiumFee) > 0 && (
                                                                    <div className="ai-chatbot-helper-meta">
                                                                        Premium: {helper.premiumFee} VNĐ
                                                                    </div>
                                                                )}
                                                                {helper.subServiceTotal != null && Number(helper.subServiceTotal) > 0 && (
                                                                    <div className="ai-chatbot-helper-meta">
                                                                        Dịch vụ thêm: {helper.subServiceTotal} VNĐ
                                                                    </div>
                                                                )}
                                                                {helper.otherFee != null && Number(helper.otherFee) > 0 && (
                                                                    <div className="ai-chatbot-helper-meta">
                                                                        Phụ phí khác: {helper.otherFee} VNĐ
                                                                    </div>
                                                                )}
                                                                {Array.isArray(helper.subServices) && helper.subServices.length > 0 && (
                                                                    <div className="ai-chatbot-helper-meta">
                                                                        Chi tiết thêm: {helper.subServices.map((s) => `${s.name} (${s.price}đ)`).join(', ')}
                                                                    </div>
                                                                )}
                                                                {helper.distanceKm != null && (
                                                                    <div className="ai-chatbot-helper-meta">
                                                                        Khoảng cách: {helper.distanceKm} km
                                                                    </div>
                                                                )}
                                                                {helper.districtName && (
                                                                    <div className="ai-chatbot-helper-meta">Khu vực: {helper.districtName}</div>
                                                                )}
                                                                {(helper.availableStartTime || helper.availableEndTime) && (
                                                                    <div className="ai-chatbot-helper-meta">
                                                                        Slot rảnh: {helper.availableStartTime ?? '--:--'} - {helper.availableEndTime ?? '--:--'}
                                                                    </div>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className="ai-chatbot-action primary"
                                                                    onClick={() => handleSelectHelper(helper.helperId)}
                                                                    disabled={isLoading}
                                                                >
                                                                    Chọn helper
                                                                </button>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {message.type === 'address_list' && Array.isArray(message.addresses) && (
                                                <div className="ai-chatbot-parse-card">
                                                    <div className="ai-chatbot-parse-title">Chọn địa chỉ làm việc</div>
                                                    {selectedAddressDisplay && (
                                                        <div className="ai-chatbot-helper-meta">
                                                            Địa chỉ đang chọn: {selectedAddressDisplay}
                                                        </div>
                                                    )}
                                                    <div className="ai-chatbot-address-search">
                                                        <input
                                                            type="text"
                                                            className="ai-chatbot-address-input"
                                                            placeholder={
                                                                currentCity
                                                                    ? `Nhập địa chỉ mới ở ${currentCity}...`
                                                                    : 'Nhập địa chỉ mới để tìm gợi ý...'
                                                            }
                                                            value={addressQuery}
                                                            onChange={(e) => setAddressQuery(e.target.value)}
                                                            onKeyDown={handleAddressInputKeyDown}
                                                            disabled={isLoading || isAddressSuggestLoading || isSavingAddress}
                                                        />
                                                    </div>

                                                    {isAddressSuggestLoading && (
                                                        <div className="ai-chatbot-helper-meta">Đang tìm gợi ý địa chỉ...</div>
                                                    )}
                                                    {addressSuggestError && (
                                                        <div className="ai-chatbot-warning">{addressSuggestError}</div>
                                                    )}
                                                    {Array.isArray(addressSuggestions) && addressSuggestions.length > 0 && (
                                                        <div className="ai-chatbot-address-suggestions">
                                                            {addressSuggestions.map((s) => (
                                                                <button
                                                                    key={s.place_id || s.placeId || s.description}
                                                                    type="button"
                                                                    className="ai-chatbot-address-item"
                                                                    onClick={() => handlePickAddressSuggestion(s)}
                                                                    disabled={isSavingAddress}
                                                                >
                                                                    {s.description}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {message.addresses.length === 0 ? (
                                                        <div className="ai-chatbot-helper-meta">
                                                            Bạn chưa có địa chỉ lưu sẵn. Hãy nhập địa chỉ mới ở ô bên trên.
                                                        </div>
                                                    ) : (
                                                        <div className="ai-chatbot-helper-list">
                                                            {message.addresses.map((address) => (
                                                                <div key={address.addressId} className="ai-chatbot-helper-card">
                                                                    <div className="ai-chatbot-helper-name">
                                                                        {address.isDefault ? 'Địa chỉ mặc định' : 'Địa chỉ'}
                                                                    </div>
                                                                    <div className="ai-chatbot-helper-meta">{address.fullAddress}</div>
                                                                    <button
                                                                        type="button"
                                                                        className="ai-chatbot-action primary"
                                                                        onClick={() => handleSelectAddress(address.addressId, address.fullAddress)}
                                                                        disabled={isLoading}
                                                                    >
                                                                        Chọn địa chỉ này
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {message.type === 'payment_redirect' && message.topupUrl && (
                                                <div className="ai-chatbot-actions">
                                                    <button
                                                        type="button"
                                                        className="ai-chatbot-action primary"
                                                        onClick={() => {
                                                            navigate(message.topupUrl);
                                                            setIsOpen(false);
                                                        }}
                                                    >
                                                        Nạp tiền ngay
                                                    </button>
                                                </div>
                                            )}

                                            {message.type === 'booking_confirm' && (message.canConfirm || message.bookingUrl) && (
                                                <div className="ai-chatbot-actions">
                                                    <button
                                                        type="button"
                                                        className="ai-chatbot-action primary"
                                                        onClick={() => handleConfirmBooking()}
                                                        disabled={isLoading}
                                                    >
                                                        Xác nhận đặt lịch
                                                    </button>
                                                </div>
                                            )}

                                            {message.type === 'booking_created' && message.bookingDetailUrl && (
                                                <div className="ai-chatbot-actions">
                                                    <button
                                                        type="button"
                                                        className="ai-chatbot-action primary"
                                                        onClick={() => {
                                                            navigate(message.bookingDetailUrl);
                                                            setIsOpen(false);
                                                        }}
                                                    >
                                                        Xem chi tiết booking
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {isLoading && (
                                <div className="ai-chatbot-message assistant">
                                    <div className="ai-chatbot-bubble ai-chatbot-loading">
                                        AI đang phân tích yêu cầu...
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="ai-chatbot-footer">
                        <input
                            ref={inputRef}
                            className="ai-chatbot-input"
                            type="text"
                            placeholder="Nhập yêu cầu..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className="ai-chatbot-send"
                            onClick={() => handleSend()}
                            disabled={!canSubmit}
                            aria-label="Gửi tin nhắn"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="22"
                                height="22"
                                role="presentation"
                                focusable="false"
                                aria-hidden="true"
                            >
                                <path
                                    d="M3 20l18-8L3 4v6l12 2-12 2v6z"
                                    fill="currentColor"
                                />
                            </svg>
                        </button>
                    </div>

                    {helperProfileModal.open && (
                        <div className="ai-chatbot-profile-modal-backdrop" onClick={handleCloseHelperProfile}>
                            <div
                                className="ai-chatbot-profile-modal"
                                role="dialog"
                                aria-label="Hồ sơ helper"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="ai-chatbot-profile-modal-header">
                                    <div className="ai-chatbot-profile-modal-title">Hồ sơ helper</div>
                                    <button
                                        type="button"
                                        className="ai-chatbot-close"
                                        onClick={handleCloseHelperProfile}
                                        aria-label="Đóng hồ sơ helper"
                                    >
                                        ×
                                    </button>
                                </div>
                                {helperProfileModal.loading ? (
                                    <div className="ai-chatbot-helper-meta">Đang tải hồ sơ helper...</div>
                                ) : helperProfileModal.error ? (
                                    <div className="ai-chatbot-warning">{helperProfileModal.error}</div>
                                ) : (
                                    <div className="ai-chatbot-profile-modal-content">
                                        <div className="ai-chatbot-helper-header">
                                            <div className="ai-chatbot-helper-avatar-button no-click">
                                                {helperProfileModal.helperAvatarUrl ? (
                                                    <img
                                                        src={resolveAvatarUrl(helperProfileModal.helperAvatarUrl)}
                                                        alt={helperProfileModal.helperName || 'Helper'}
                                                        className="ai-chatbot-helper-avatar"
                                                    />
                                                ) : (
                                                    <span className="ai-chatbot-helper-avatar-fallback">
                                                        {getAvatarFallback(helperProfileModal.helperName)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="ai-chatbot-helper-name-wrap">
                                                <div className="ai-chatbot-helper-name">
                                                    {helperProfileModal.helperName || 'Helper'}
                                                </div>
                                                <div className="ai-chatbot-helper-meta">
                                                    ⭐ {helperProfileModal.profile?.ratingAverage ?? 0}
                                                    {' '}({helperProfileModal.profile?.totalReviews ?? 0} đánh giá)
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ai-chatbot-helper-meta">
                                            Trạng thái: {helperProfileModal.profile?.isOnline ? 'Đang online' : 'Đang offline'}
                                        </div>
                                        <div className="ai-chatbot-helper-meta">
                                            KYC: {helperProfileModal.profile?.kycStatus || 'Chưa xác minh'}
                                        </div>
                                        <div className="ai-chatbot-helper-meta">
                                            Kinh nghiệm: {helperProfileModal.profile?.experienceYears ?? 0} năm
                                        </div>
                                        <div className="ai-chatbot-helper-meta">
                                            Quê quán: {helperProfileModal.profile?.hometownName || '---'}
                                        </div>
                                        <div className="ai-chatbot-helper-meta">
                                            Giới thiệu: {helperProfileModal.profile?.bio || 'Helper chưa cập nhật giới thiệu.'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!isOpen && (
                <button
                    type="button"
                    className="ai-chatbot-fab"
                    onClick={() => setIsOpen(true)}
                    aria-label="Mở AI chatbot"
                >
                    <span className="ai-chatbot-fab-icon" aria-hidden="true">
                        <svg
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            role="presentation"
                            focusable="false"
                        >
                            <path
                                d="M21 12c0 4.418-4.03 8-9 8-1.09 0-2.13-.15-3.07-.43L3 21l.84-3.36C3.31 16.55 3 14.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            <path
                                d="M8 12h.01M12 12h.01M16 12h.01"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                        </svg>
                    </span>
                </button>
            )}
        </div>
    );
};

export default AIChatbotComponent;

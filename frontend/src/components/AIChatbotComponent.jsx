import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIChatNLPService from '../services/AIChatNLPService';
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

const formatParsedSummary = (parsed) => {
    const parts = [];
    if (parsed?.categoryId) {
        const serviceName = CATEGORY_ID_TO_SERVICE_NAME[Number(parsed.categoryId)];
        parts.push(serviceName ? `Dịch vụ: ${serviceName}` : `Dịch vụ #${parsed.categoryId}`);
    }
    if (parsed?.durationHours) parts.push(`${parsed.durationHours} giờ`);
    if (parsed?.workDate) parts.push(parsed.workDate);
    if (parsed?.startTime) parts.push(parsed.startTime);
    return parts.join(' • ') || 'Chưa parse được đủ dữ liệu.';
};

const AIChatbotComponent = () => {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            role: 'assistant',
            type: 'text',
            text: 'Xin chào! Bạn có thể nhập yêu cầu như "Dọn nhà 3 tiếng sáng mai" để mình hiểu và gợi ý đặt lịch.',
        },
    ]);

    const canSubmit = useMemo(
        () => !isLoading && String(inputValue || '').trim().length > 0,
        [isLoading, inputValue]
    );

    const FIELD_VI_LABELS = useMemo(
        () => ({
            categoryId: 'dịch vụ',
            durationHours: 'số giờ',
            workDate: 'ngày làm',
            startTime: 'giờ bắt đầu',
        }),
        []
    );

    const formatFieldValue = (field, value) => {
        const label = FIELD_VI_LABELS[field] ?? field;
        if (field === 'categoryId') {
            const serviceName = CATEGORY_ID_TO_SERVICE_NAME[Number(value)];
            return `${label}: ${serviceName ?? '—'}`;
        }
        return `${label}: ${value ?? '—'}`;
    };

    const appendMessage = (message) => {
        setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...message }]);
    };

    const handleSend = async (rawMessage) => {
        const message = String(rawMessage ?? inputValue).trim();
        if (!message || isLoading) return;

        appendMessage({ role: 'user', type: 'text', text: message });
        setInputValue('');
        setIsLoading(true);

        try {
            const res = await AIChatNLPService.parseMessage(message);
            const parsed = extractPayload(res);

            appendMessage({
                role: 'assistant',
                type: 'parse',
                text: parsed?.followUpQuestion || 'Mình đã hiểu yêu cầu sơ bộ của bạn.',
                parsed,
            });
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

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const handleOpenBooking = (parsed) => {
        if (!parsed?.categoryId) return;
        const params = new URLSearchParams();
        params.set('categoryId', String(parsed.categoryId));

        if (parsed?.workDate) {
            params.set('workDate', String(parsed.workDate));
        }
        if (parsed?.startTime) {
            params.set('startTime', String(parsed.startTime));
        }
        if (parsed?.durationHours) {
            params.set('durationHours', String(parsed.durationHours));
        }
        if (Array.isArray(parsed?.serviceIds) && parsed.serviceIds.length > 0) {
            params.set(
                'serviceIds',
                parsed.serviceIds
                    .map((id) => Math.round(Number(id)))
                    .filter((id) => Number.isFinite(id))
                    .join(',')
            );
        }

        navigate(`/customer/post-job?${params.toString()}`);
        setIsOpen(false);
    };

    return (
        <div className="ai-chatbot-shell">
            {isOpen && (
                <div className="ai-chatbot-panel" role="dialog" aria-label="AI chatbot đặt lịch">
                    <div className="ai-chatbot-header">
                        <div>
                            <div className="ai-chatbot-title">AI Đặt Lịch</div>
                            <div className="ai-chatbot-subtitle">Mô tả nhu cầu để bot hiểu giúp bạn</div>
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

                        <div className="ai-chatbot-messages">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`ai-chatbot-message ${message.role === 'user' ? 'user' : 'assistant'}`}
                                >
                                    <div className="ai-chatbot-bubble">
                                        <div>{message.text}</div>

                                        {message.type === 'parse' && message.parsed && (
                                            <div className="ai-chatbot-parse-card">
                                                <div className="ai-chatbot-parse-title">Kết quả hiểu yêu cầu</div>
                                                <div className="ai-chatbot-parse-summary">
                                                    {formatParsedSummary(message.parsed)}
                                                </div>

                                                <div className="ai-chatbot-parse-grid">
                                                    <span>{formatFieldValue('categoryId', message.parsed.categoryId)}</span>
                                                    <span>{formatFieldValue('durationHours', message.parsed.durationHours)}</span>
                                                    <span>{formatFieldValue('workDate', message.parsed.workDate)}</span>
                                                    <span>{formatFieldValue('startTime', message.parsed.startTime)}</span>
                                                </div>

                                                {Array.isArray(message.parsed.missingFields) &&
                                                    message.parsed.missingFields.length > 0 ? (
                                                    <div className="ai-chatbot-warning">
                                                        Còn thiếu:{' '}
                                                        {message.parsed.missingFields
                                                            .map((field) => FIELD_VI_LABELS[field] ?? field)
                                                            .join(', ')}
                                                    </div>
                                                ) : null}

                                                <div className="ai-chatbot-actions">
                                                    <button
                                                        type="button"
                                                        className="ai-chatbot-action primary"
                                                        onClick={() => handleOpenBooking(message.parsed)}
                                                        disabled={!message.parsed.categoryId}
                                                    >
                                                        Mở trang đặt lịch
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

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
                            placeholder="Ví dụ: Dọn nhà 3 tiếng sáng mai"
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

import React, { useState } from 'react';
import { SUPPORT_HOTLINES } from '../constants/supportHotlines';
import './SupportHotlineFab.css';

const SupportHotlineFab = ({ placement = 'left' }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className={`support-hotline-fab support-hotline-fab--${placement}`}>
            {open && (
                <div className="support-hotline-panel" role="dialog" aria-label="Hotline hỗ trợ">
                    <p className="support-hotline-title">Liên hệ hỗ trợ</p>
                    {SUPPORT_HOTLINES.map((h) => (
                        <a key={h.tel} className="support-hotline-link" href={`tel:${h.tel}`}>
                            <span>{h.label}</span>
                            <strong>{h.display}</strong>
                        </a>
                    ))}
                </div>
            )}
            <button
                type="button"
                className="support-hotline-trigger"
                aria-expanded={open}
                aria-label={open ? 'Đóng danh sách hotline' : 'Mở hotline hỗ trợ'}
                onClick={() => setOpen((v) => !v)}
                title="Gọi hotline"
            >
                <span className="support-hotline-trigger-icon" aria-hidden>
                    📞
                </span>
            </button>
        </div>
    );
};

export default SupportHotlineFab;

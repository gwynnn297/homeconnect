import React, { useState } from 'react';
import HelperLayout from '../../layouts/HelperLayout';
import SmartCheckinModal from '../../components/SmartCheckinModal';
import NotificationModal from '../../components/NotificationModal';
import './HelperCheckinPage.css';

const HelperCheckinPage = () => {
    const [bookingId, setBookingId] = useState('');
    const [openModal, setOpenModal] = useState(false);
    const [toast, setToast] = useState(null);

    const openCheckin = () => {
        if (!bookingId || Number(bookingId) <= 0) {
            setToast({ type: 'warning', message: 'Vui lòng nhập bookingId hợp lệ.' });
            return;
        }
        setOpenModal(true);
    };

    return (
        <HelperLayout>
            <div className="hcp-wrapper">
                <h1>Check-in khuôn mặt</h1>
                <p className="hcp-desc">
                    Nhập mã booking đã nhận, sau đó thực hiện liveness challenge để xác thực trước khi check-in.
                </p>

                <div className="hcp-form">
                    <input
                        type="number"
                        min="1"
                        placeholder="Nhập bookingId"
                        value={bookingId}
                        onChange={(e) => setBookingId(e.target.value)}
                    />
                    <button type="button" onClick={openCheckin}>Bắt đầu check-in</button>
                </div>
            </div>

            <SmartCheckinModal
                isOpen={openModal}
                bookingId={Number(bookingId)}
                onClose={() => setOpenModal(false)}
                onSuccess={() => setToast({ type: 'success', message: 'Check-in thành công, booking đã chuyển ARRIVED.' })}
            />

            {toast && (
                <NotificationModal
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </HelperLayout>
    );
};

export default HelperCheckinPage;

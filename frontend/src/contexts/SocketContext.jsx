import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

const resolveSocketUrl = () => {
    const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
    if (envSocketUrl) return envSocketUrl;

    // Production (Docker/nginx): same origin → /socket.io/ proxied to backend:9092
    if (typeof window !== 'undefined' && window.location?.origin) {
        const { hostname } = window.location;
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return window.location.origin;
        }
    }

    const apiUrl = import.meta.env.VITE_API_URL;
    const fallbackPort = import.meta.env.VITE_SOCKET_PORT || '9092';
    try {
        if (apiUrl) {
            const parsed = new URL(apiUrl);
            return `${parsed.protocol}//${parsed.hostname}:${fallbackPort}`;
        }
    } catch (_) {
        /* ignore */
    }

    return `http://localhost:${fallbackPort}`;
};

const getStoredUserId = (user) => {
    const rawId = user?.id ?? user?.userId ?? user?.user_id;
    if (rawId === undefined || rawId === null || rawId === '') return null;
    return String(rawId);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const SOCKET_URL = resolveSocketUrl();

    useEffect(() => {
        const checkUserAndConnect = () => {
            let user = null;
            try {
                const userJson = localStorage.getItem('user');
                user = userJson ? JSON.parse(userJson) : null;
            } catch (e) {
                console.error('[SocketContext] Failed to parse user from localStorage', e);
            }
            
            const userIdStr = getStoredUserId(user);

            if (!user || !userIdStr) {
                if (socket) {
                    socket.close();
                    setSocket(null);
                }
                console.debug('[Socket] Skip connect: missing user id in localStorage user payload');
                return;
            }

            // Correct check for socket.io-client v4
            if (
                socket &&
                socket.io &&
                socket.io.opts &&
                socket.io.opts.query &&
                String(socket.io.opts.query.userId) === userIdStr
            ) return;

            // Đảm bảo chỉ có 1 connection sống tại một thời điểm
            if (socket) {
                try {
                    socket.close();
                } catch (e) {
                    console.warn('[Socket] Failed to close existing socket', e);
                }
            }

            const newSocket = io(SOCKET_URL, {
                query: { 
                    userId: userIdStr,
                    role: user.role || user.userRole || '' 
                },
                transports: ['websocket', 'polling'],
                reconnection: true,
            });

            newSocket.on('connect', () => {
                console.log('[Socket] Connected as user:', userIdStr);
                setIsConnected(true);
            });

            newSocket.on('disconnect', () => setIsConnected(false));
            newSocket.on('connect_error', (err) => {
                console.error('[Socket] connect_error:', err?.message || err);
                setIsConnected(false);
            });

            newSocket.on('new_notification', (data) => {
                window.dispatchEvent(new CustomEvent('notification:received', { detail: data }));
            });

            newSocket.on('booking_update', (data) => {
                window.dispatchEvent(new CustomEvent('booking:updated', { detail: data }));
            });

            newSocket.on('new_job_available', (data) => {
                window.dispatchEvent(new CustomEvent('job:new_available', { detail: data }));
            });

            newSocket.on('helper_feed_changed', (data) => {
                window.dispatchEvent(new CustomEvent('job:feed_changed', { detail: data }));
            });

            newSocket.on('job_post_cancelled', (data) => {
                window.dispatchEvent(new CustomEvent('job:post_cancelled', { detail: data }));
            });

            newSocket.on('new_job_application', (data) => {
                window.dispatchEvent(new CustomEvent('job:new_application', { detail: data }));
            });

            newSocket.on('wallet:updated', (data) => {
                window.dispatchEvent(new CustomEvent('wallet:updated', { detail: data }));
            });

            newSocket.on('withdraw:new_request', (data) => {
                window.dispatchEvent(new CustomEvent('withdraw:new_request', { detail: data }));
            });

            setSocket(newSocket);
        };

        checkUserAndConnect();
        
        window.addEventListener('storage', checkUserAndConnect);
        window.addEventListener('auth:login', checkUserAndConnect);

        return () => {
            window.removeEventListener('storage', checkUserAndConnect);
            window.removeEventListener('auth:login', checkUserAndConnect);
            if (socket) {
                try {
                    socket.close();
                } catch (e) {
                    console.warn('[Socket] Failed to close socket on cleanup', e);
                }
            }
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};

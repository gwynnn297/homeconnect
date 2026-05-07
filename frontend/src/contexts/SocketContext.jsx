import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = 'http://localhost:9092'; // Port configured in Backend

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const checkUserAndConnect = () => {
            let user = null;
            try {
                const userJson = localStorage.getItem('user');
                user = userJson ? JSON.parse(userJson) : null;
            } catch (e) {
                console.error('[SocketContext] Failed to parse user from localStorage', e);
            }
            
            if (!user || !user.id) {
                if (socket) {
                    socket.close();
                    setSocket(null);
                }
                return;
            }

            // Correct check for socket.io-client v4
            if (socket && socket.io && socket.io.opts && socket.io.opts.query && socket.io.opts.query.userId === user.id) return;

            const newSocket = io(SOCKET_URL, {
                query: { userId: user.id },
                transports: ['websocket'],
                reconnection: true,
            });

            newSocket.on('connect', () => {
                console.log('[Socket] Connected as user:', user.id);
                setIsConnected(true);
            });

            newSocket.on('disconnect', () => setIsConnected(false));

            newSocket.on('new_notification', (data) => {
                window.dispatchEvent(new CustomEvent('notification:received', { detail: data }));
            });

            newSocket.on('booking_update', (data) => {
                window.dispatchEvent(new CustomEvent('booking:updated', { detail: data }));
            });

            newSocket.on('new_job_available', (data) => {
                window.dispatchEvent(new CustomEvent('job:new_available', { detail: data }));
            });

            newSocket.on('new_job_application', (data) => {
                window.dispatchEvent(new CustomEvent('job:new_application', { detail: data }));
            });

            newSocket.on('wallet:updated', (data) => {
                window.dispatchEvent(new CustomEvent('wallet:updated', { detail: data }));
            });

            setSocket(newSocket);
        };

        checkUserAndConnect();
        
        window.addEventListener('storage', checkUserAndConnect);
        window.addEventListener('auth:login', checkUserAndConnect);

        return () => {
            window.removeEventListener('storage', checkUserAndConnect);
            window.removeEventListener('auth:login', checkUserAndConnect);
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};

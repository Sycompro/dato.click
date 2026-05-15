'use client';
import { Delete, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NumericKeypad({ isOpen, onClose, onKeyPress, onDelete, value = '' }) {
    if (!isOpen) return null;

    const keys = [
        '1', '2', '3',
        '4', '5', '6',
        '7', '8', '9',
        '00', '0', 'DEL'
    ];

    return (
        <AnimatePresence>
            <div 
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }} 
                onClick={onClose}
            >
                <motion.div 
                    initial={{ opacity: 0, scale: 0.85, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '280px',
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        borderRadius: '28px',
                        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                        padding: '20px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px'
                    }}
                >
                <div style={{
                    gridColumn: '1 / -1',
                    background: 'rgba(255, 255, 255, 0.5)',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    marginBottom: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                    textAlign: 'center',
                    minHeight: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '2px' }}>
                        {value || <span style={{ color: '#94a3b8' }}>...</span>}
                    </span>
                </div>

                {keys.map((key) => {
                    const isDel = key === 'DEL';
                    return (
                        <button
                            key={key}
                            onClick={(e) => {
                                e.preventDefault();
                                if (isDel) onDelete();
                                else onKeyPress(key);
                            }}
                            style={{
                                height: '54px',
                                background: isDel ? 'linear-gradient(135deg, #ff4b4b 0%, #dc2626 100%)' : '#ffffff',
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '20px',
                                fontWeight: 800,
                                color: isDel ? '#ffffff' : '#0f172a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: isDel 
                                    ? '0 6px 16px rgba(220, 38, 38, 0.3)' 
                                    : '0 4px 10px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02), inset 0 -2px 0 rgba(0,0,0,0.02)',
                                transition: 'all 0.1s ease-out',
                                userSelect: 'none'
                            }}
                            onMouseDown={e => {
                                e.currentTarget.style.transform = 'scale(0.92) translateY(2px)';
                                e.currentTarget.style.boxShadow = isDel 
                                    ? '0 2px 8px rgba(220, 38, 38, 0.4)' 
                                    : '0 1px 2px rgba(0,0,0,0.05), inset 0 2px 4px rgba(0,0,0,0.05)';
                            }}
                            onMouseUp={e => {
                                e.currentTarget.style.transform = 'scale(1) translateY(0px)';
                                e.currentTarget.style.boxShadow = isDel 
                                    ? '0 6px 16px rgba(220, 38, 38, 0.3)' 
                                    : '0 4px 10px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02), inset 0 -2px 0 rgba(0,0,0,0.02)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'scale(1) translateY(0px)';
                                e.currentTarget.style.boxShadow = isDel 
                                    ? '0 6px 16px rgba(220, 38, 38, 0.3)' 
                                    : '0 4px 10px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02), inset 0 -2px 0 rgba(0,0,0,0.02)';
                            }}
                        >
                            {isDel ? <Delete size={28} strokeWidth={2.5} /> : key}
                        </button>
                    );
                })}
                
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onClose();
                    }}
                    style={{
                        gridColumn: '1 / -1',
                        height: '48px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '16px',
                        fontSize: '13px',
                        fontWeight: 800,
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3), inset 0 -2px 0 rgba(0,0,0,0.1)',
                        transition: 'all 0.1s ease-out',
                        userSelect: 'none'
                    }}
                    onMouseDown={e => {
                        e.currentTarget.style.transform = 'scale(0.96) translateY(2px)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 2px 4px rgba(0,0,0,0.2)';
                    }}
                    onMouseUp={e => {
                        e.currentTarget.style.transform = 'scale(1) translateY(0px)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.3), inset 0 -2px 0 rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1) translateY(0px)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.3), inset 0 -2px 0 rgba(0,0,0,0.1)';
                    }}
                >
                    <ChevronDown size={20} strokeWidth={3} />
                    OCULTAR TECLADO
                </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

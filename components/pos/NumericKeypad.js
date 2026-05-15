'use client';
import { Delete, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';

export default function NumericKeypad({ isOpen, onClose, onKeyPress, onDelete, value = '' }) {
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(e.target)) {
                const parent = containerRef.current.parentElement;
                if (!parent || (parent && !parent.contains(e.target))) {
                    onClose();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const keys = [
        '1', '2', '3',
        '4', '5', '6',
        '7', '8', '9',
        '.', '0', 'DEL'
    ];

    return (
        <AnimatePresence>
            <div 
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}
            >
                <motion.div 
                    ref={containerRef}
                    initial={{ opacity: 0, scale: 0.9, y: 15, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.9, y: 15, filter: 'blur(10px)' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        pointerEvents: 'auto',
                        width: '260px',
                        // ESTILO NEGRO CRISTALIZADO (Deep Spatial UI)
                        background: 'rgba(20, 20, 20, 0.45)', // Negro cristalizado
                        backdropFilter: 'blur(40px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                        borderRadius: '32px',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}
                >
                    {/* Display Superior */}
                    <div style={{
                        width: '100%',
                        textAlign: 'center',
                        minHeight: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        paddingBottom: '10px'
                    }}>
                        <span style={{ 
                            fontSize: '18px',
                            fontWeight: 400, 
                            color: '#ffffff', 
                            letterSpacing: '2px',
                            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                        }}>
                            {value || <span style={{ color: 'rgba(255,255,255,0.4)' }}>...</span>}
                        </span>
                    </div>

                    {/* Botones Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px'
                    }}>
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
                                        height: '46px',
                                        // Botones negros cristalizados
                                        background: isDel ? 'rgba(255, 60, 60, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                                        border: 'none',
                                        borderRadius: '50px',
                                        fontSize: '18px',
                                        fontWeight: 400,
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)',
                                        transition: 'all 0.15s ease-out',
                                        userSelect: 'none'
                                    }}
                                    onMouseDown={e => {
                                        e.currentTarget.style.transform = 'scale(0.85)';
                                        e.currentTarget.style.background = isDel ? 'rgba(255, 60, 60, 0.6)' : 'rgba(255, 255, 255, 0.4)';
                                    }}
                                    onMouseUp={e => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.background = isDel ? 'rgba(255, 60, 60, 0.3)' : 'rgba(255, 255, 255, 0.15)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.background = isDel ? 'rgba(255, 60, 60, 0.3)' : 'rgba(255, 255, 255, 0.15)';
                                    }}
                                >
                                    {isDel ? <Delete size={20} strokeWidth={2} /> : key}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Botón Aceptar */}
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onClose();
                        }}
                        style={{
                            width: '100%',
                            height: '42px',
                            background: 'rgba(255, 255, 255, 0.25)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '50px',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)',
                            transition: 'all 0.15s ease-out',
                            userSelect: 'none'
                        }}
                        onMouseDown={e => {
                            e.currentTarget.style.transform = 'scale(0.95)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        }}
                        onMouseUp={e => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        }}
                    >
                        <Check size={16} strokeWidth={2.5} />
                        Aceptar
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

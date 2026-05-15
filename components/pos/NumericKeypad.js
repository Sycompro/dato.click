'use client';
import { Delete, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

export default function NumericKeypad({ isOpen, onClose, onKeyPress, onDelete, value = '' }) {
    const [pos, setPos] = useState({ top: 'calc(100% + 8px)', left: 0, bottom: 'auto', right: 'auto' });
    const containerRef = useRef(null);

    // Calcular posición inteligente (arriba/abajo, izquierda/derecha)
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const parent = containerRef.current.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                const windowH = window.innerHeight;
                const windowW = window.innerWidth;

                let newPos = { top: 'calc(100% + 8px)', left: 0, bottom: 'auto', right: 'auto' };

                // Si no hay espacio abajo, abrir hacia arriba
                if (rect.bottom + 360 > windowH) {
                    newPos.top = 'auto';
                    newPos.bottom = 'calc(100% + 8px)';
                }
                
                // Si no hay espacio a la derecha, alinear a la derecha del input
                if (rect.left + 260 > windowW) {
                    newPos.left = 'auto';
                    newPos.right = 0;
                }

                setPos(newPos);
            }
        }
    }, [isOpen]);

    // Cerrar al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && containerRef.current) {
                const parent = containerRef.current.parentElement;
                if (!containerRef.current.contains(e.target) && parent && !parent.contains(e.target)) {
                    onClose();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Se cambió '00' por '.' para soportar campos monetarios
    const keys = [
        '1', '2', '3',
        '4', '5', '6',
        '7', '8', '9',
        '.', '0', 'DEL'
    ];

    return (
        <AnimatePresence>
            <motion.div 
                ref={containerRef}
                initial={{ opacity: 0, scale: 0.95, y: pos.top !== 'auto' ? -10 : 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: pos.top !== 'auto' ? -10 : 10 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: 'absolute',
                    top: pos.top,
                    bottom: pos.bottom,
                    left: pos.left,
                    right: pos.right,
                    width: '250px', // Diseño no exagerado, tamaño perfecto
                    background: '#f8fafc', // Fondo pastel gris muy claro
                    borderRadius: '20px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                    padding: '16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    zIndex: 9999
                }}
            >
                {/* Display Superior */}
                <div style={{
                    gridColumn: '1 / -1',
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '4px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#334155', letterSpacing: '1px' }}>
                        {value || <span style={{ color: '#cbd5e1' }}>...</span>}
                    </span>
                </div>

                {/* Botones */}
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
                                height: '48px',
                                background: isDel ? '#fee2e2' : '#ffffff', // Fondo pastel para DEL
                                border: isDel ? '1px solid #fecaca' : '1px solid #e2e8f0',
                                borderRadius: '12px',
                                fontSize: '20px',
                                fontWeight: 800,
                                color: isDel ? '#ef4444' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                transition: 'all 0.1s ease-out',
                                userSelect: 'none'
                            }}
                            onMouseDown={e => {
                                e.currentTarget.style.transform = 'scale(0.92)';
                                e.currentTarget.style.background = isDel ? '#fca5a5' : '#f1f5f9';
                            }}
                            onMouseUp={e => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.background = isDel ? '#fee2e2' : '#ffffff';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.background = isDel ? '#fee2e2' : '#ffffff';
                            }}
                        >
                            {isDel ? <Delete size={22} strokeWidth={2.5} /> : key}
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
                        height: '44px',
                        background: '#e0e7ff', // Azul pastel muy suave y hermoso
                        color: '#4f46e5',
                        border: '1px solid #c7d2fe',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.1s ease-out',
                        userSelect: 'none'
                    }}
                    onMouseDown={e => {
                        e.currentTarget.style.transform = 'scale(0.96)';
                        e.currentTarget.style.background = '#c7d2fe';
                    }}
                    onMouseUp={e => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.background = '#e0e7ff';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.background = '#e0e7ff';
                    }}
                >
                    <ChevronDown size={18} strokeWidth={3} />
                    OK
                </button>
            </motion.div>
        </AnimatePresence>
    );
}

'use client';
import { Delete, Check, Space } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

export default function AlphanumericKeyboard({ isOpen, onClose, onKeyPress, onDelete, value = '' }) {
    const containerRef = useRef(null);
    const [isUpper, setIsUpper] = useState(true);

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

    const rows = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ''],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '-']
    ];

    const handleKey = (key) => {
        const finalKey = isUpper ? key.toUpperCase() : key.toLowerCase();
        onKeyPress(finalKey);
    };

    return (
        <AnimatePresence>
            <div 
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 20, // Un pequeño margen del fondo
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'flex-end', // Al fondo
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}
            >
                <motion.div 
                    ref={containerRef}
                    initial={{ opacity: 0, y: 100, filter: 'blur(10px)' }} // Aparece desde abajo
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 100, filter: 'blur(10px)' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        pointerEvents: 'auto',
                        width: 'min(95vw, 850px)', // Más estirado horizontalmente
                        background: 'rgba(15, 23, 42, 0.7)', 
                        backdropFilter: 'blur(50px) saturate(210%)',
                        WebkitBackdropFilter: 'blur(50px) saturate(210%)',
                        borderRadius: '24px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.12)',
                        padding: '12px 20px', // Menos padding vertical
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px' // Gap reducido para menor altura
                    }}
                >
                    {/* Display */}
                    <div style={{
                        width: '100%',
                        textAlign: 'center',
                        paddingBottom: '10px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '4px'
                    }}>
                        <span style={{ 
                            fontSize: '18px',
                            fontWeight: 400, 
                            color: '#ffffff', 
                            letterSpacing: '1px',
                            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                        }}>
                            {value || <span style={{ color: 'rgba(255,255,255,0.3)' }}>Escribe aqu...</span>}
                        </span>
                    </div>

                    {/* Rows */}
                    {rows.map((row, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {row.map(key => (
                                <button
                                    key={key}
                                    onClick={() => handleKey(key)}
                                    style={keyStyle}
                                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
                                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {isUpper ? key : key.toLowerCase()}
                                </button>
                            ))}
                        </div>
                    ))}

                    {/* Bottom Row */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '4px' }}>
                        <button 
                            onClick={() => setIsUpper(!isUpper)}
                            style={{ ...keyStyle, width: '60px', fontSize: '12px', background: isUpper ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }}
                        >
                            {isUpper ? 'MAYUS' : 'minus'}
                        </button>
                        
                        <button 
                            onClick={() => onKeyPress(' ')}
                            style={{ ...keyStyle, width: '160px' }}
                        >
                            <Space size={20} />
                        </button>

                        <button 
                            onClick={onDelete}
                            style={{ ...keyStyle, width: '60px', background: 'rgba(255, 60, 60, 0.3)' }}
                        >
                            <Delete size={20} />
                        </button>

                        <button 
                            onClick={onClose}
                            style={{ ...keyStyle, width: '80px', background: 'rgba(255,255,255,0.25)', color: '#fff' }}
                        >
                            <Check size={20} />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

const keyStyle = {
    flex: 1, // Para que se estiren proporcionalmente
    minWidth: '30px',
    height: '38px', // Altura reducida
    background: 'rgba(255, 255, 255, 0.15)',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px', // Un poco más pequeño para caber mejor
    fontWeight: 600,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15)',
    transition: 'all 0.15s ease-out',
    userSelect: 'none'
};

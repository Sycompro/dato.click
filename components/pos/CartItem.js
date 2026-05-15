'use client';
import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import NumericKeypad from './NumericKeypad';

export default function CartItem({ item, onUpdateQty, onRemove, onUpdatePrice, useScreenKeyboards }) {
    const [showQtyNumpad, setShowQtyNumpad] = useState(false);
    const [showPriceNumpad, setShowPriceNumpad] = useState(false);

    const handleQtyKeyPress = (key) => {
        if (key === '.') return; // No decimales para cantidad
        const newQty = parseInt(item.quantity.toString() + key);
        onUpdateQty(item.id, newQty - item.quantity);
    };

    const handleQtyDelete = () => {
        const strQty = item.quantity.toString();
        if (strQty.length <= 1) {
            onUpdateQty(item.id, 1 - item.quantity);
        } else {
            const newQty = parseInt(strQty.slice(0, -1));
            onUpdateQty(item.id, newQty - item.quantity);
        }
    };

    const handlePriceKeyPress = (key) => {
        let strPrice = item.price.toString();
        if (key === '.') {
            if (!strPrice.includes('.')) strPrice += '.';
        } else {
            strPrice += key;
        }
        onUpdatePrice(item.id, parseFloat(strPrice));
    };

    const handlePriceDelete = () => {
        const strPrice = item.price.toString();
        if (strPrice.length <= 1) {
            onUpdatePrice(item.id, 0);
        } else {
            onUpdatePrice(item.id, parseFloat(strPrice.slice(0, -1)) || 0);
        }
    };
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #eef2ff',
            padding: '12px',
            marginBottom: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
            transition: 'all 0.2s'
        }}>
            {/* Control de Cantidad */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => onUpdateQty(item.id, 1)} style={qtyBtnStyle} title="Aumentar">
                    <Plus size={10} strokeWidth={3} />
                </button>
                <div style={{ position: 'relative' }}>
                    <input 
                        type="text"
                        inputMode="none"
                        value={item.quantity}
                        onChange={(e) => onUpdateQty(item.id, (parseInt(e.target.value) || 1) - item.quantity)}
                        onFocus={() => useScreenKeyboards && setShowQtyNumpad(true)}
                        style={{ 
                            fontSize: '15px', fontWeight: 900, color: '#4f46e5', 
                            width: '32px', textAlign: 'center', border: 'none', 
                            background: 'transparent', outline: 'none' 
                        }}
                    />
                    <NumericKeypad 
                        isOpen={showQtyNumpad}
                        onClose={() => setShowQtyNumpad(false)}
                        onKeyPress={handleQtyKeyPress}
                        onDelete={handleQtyDelete}
                        value={item.quantity.toString()}
                    />
                </div>
                <button onClick={() => onUpdateQty(item.id, -1)} style={qtyBtnStyle} title="Disminuir">
                    <Minus size={10} strokeWidth={3} />
                </button>
            </div>

            {/* Info del Producto */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ 
                    fontSize: '12px', fontWeight: 700, color: '#1e293b', lineHeight: 1.3, margin: 0,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' 
                }}>
                    {item.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>S/</span>
                    <div style={{ position: 'relative' }}>
                        <input 
                            type="text"
                            inputMode="none"
                            value={item.price}
                            onChange={(e) => onUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                            onFocus={() => useScreenKeyboards && setShowPriceNumpad(true)}
                            style={{ 
                                fontSize: '11px', fontWeight: 700, color: '#64748b', 
                                width: '60px', border: 'none', borderBottom: '1px dashed #cbd5e1',
                                background: 'transparent', outline: 'none', padding: '0 2px'
                            }}
                        />
                        <NumericKeypad 
                            isOpen={showPriceNumpad}
                            onClose={() => setShowPriceNumpad(false)}
                            onKeyPress={handlePriceKeyPress}
                            onDelete={handlePriceDelete}
                            value={item.price.toString()}
                        />
                    </div>
                </div>
            </div>

            {/* Subtotal y Eliminar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                    S/ {(item.price * item.quantity).toFixed(2)}
                </span>
                <button 
                    onClick={() => onRemove(item.id)} 
                    style={{
                        background: '#fef2f2', border: 'none', color: '#ef4444', 
                        cursor: 'pointer', borderRadius: '8px', padding: '6px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                    title="Quitar de la lista"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
}

const qtyBtnStyle = {
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748b',
    padding: 0,
    transition: 'all 0.2s'
};

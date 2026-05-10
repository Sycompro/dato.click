'use client';
import { Banknote, CreditCard, Smartphone, ArrowRight, Plus, Trash2, Split, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function PaymentSection({ 
    total, availableMethods, payments, setPayments, onFinalize, 
    loading, cartEmpty, onAlert,
    showMixed, setShowMixed, cashReceived, setCashReceived
}) {
    const [tempAmount, setTempAmount] = useState('');
    const [selectedMethod, setSelectedMethod] = useState(null);

    const subtotal = total / 1.18;
    const igv = total - subtotal;
    const ICONS = { 1: Banknote, 2: CreditCard, 3: Smartphone };

    const paidAmount = payments.reduce((acc, p) => acc + p.amount, 0);
    const remaining = total - paidAmount;

    // Cálculo del vuelto (solo si el pago es EFECTIVO y el monto recibido es mayor)
    const isCashOnly = !showMixed && payments.length === 1 && payments[0].id === 'EF';
    const change = isCashOnly && parseFloat(cashReceived) > total ? parseFloat(cashReceived) - total : 0;

    const addPayment = () => {
        const amt = parseFloat(tempAmount) || remaining;
        if (amt <= 0 || !selectedMethod) return;
        if (amt > remaining + 0.01) return onAlert('Error de Pago', 'El monto ingresado supera el saldo pendiente del ticket.', 'warning');

        const newPayment = {
            id: selectedMethod.id,
            type: selectedMethod.type,
            name: selectedMethod.name,
            amount: amt
        };

        setPayments([...payments, newPayment]);
        setTempAmount('');
        setSelectedMethod(null);
    };

    const removePayment = (index) => {
        setPayments(payments.filter((_, i) => i !== index));
    };

    const handleSimpleMethod = (m) => {
        setPayments([{
            id: m.id,
            type: m.type,
            name: m.name,
            amount: total
        }]);
        if (m.id !== 'EF') setCashReceived('');
    };

    const handleFinalizeWithChange = () => {
        onFinalize({
            cashReceived: parseFloat(cashReceived) || total,
            changeGiven: change,
            isMixed: showMixed
        });
    };

    return (
        <div style={containerStyle}>
            {/* Cabecera / Selector de Modo */}
            <div style={headerActionStyle}>
                <p style={labelStyle}>Método de pago</p>
                <button
                    disabled={cartEmpty}
                    onClick={() => { setShowMixed(!showMixed); setPayments([]); setCashReceived(''); }}
                    style={{ 
                        ...modeBtnStyle, 
                        color: showMixed ? '#3b82f6' : '#94a3b8',
                        opacity: cartEmpty ? 0.5 : 1,
                        cursor: cartEmpty ? 'not-allowed' : 'pointer'
                    }}
                >
                    <Split size={14} /> {showMixed ? 'Volver a Simple' : 'Pago Mixto'}
                </button>
            </div>

            {/* Area de Selección */}
            <div style={gridStyle}>
                {availableMethods.map(m => {
                    const Icon = ICONS[m.type] || Banknote;
                    const isSelectedInSimple = !showMixed && payments.length === 1 && payments[0].id === m.id;
                    const isSelectedInMixed = showMixed && selectedMethod?.id === m.id;
                    const isActive = isSelectedInSimple || isSelectedInMixed;

                    return (
                        <button 
                            key={m.id} 
                            disabled={cartEmpty}
                            onClick={() => showMixed ? setSelectedMethod(m) : handleSimpleMethod(m)}
                            style={{
                                ...methodBtnStyle,
                                borderColor: isActive ? '#3b82f6' : '#f1f5f9',
                                background: isActive ? '#3b82f6' : '#f8fafc',
                                color: isActive ? '#fff' : '#64748b',
                                opacity: cartEmpty ? 0.5 : 1,
                                cursor: cartEmpty ? 'not-allowed' : 'pointer',
                            }}>
                            <Icon size={14} />
                            <span style={methodNameStyle}>{m.name}</span>
                        </button>
                    );
                })}
            </div>

            {/* Input de Efectivo Recibido (Modo Simple) */}
            {isCashOnly && (
                <div style={mixedPanelStyle}>
                    <p style={{ ...labelStyle, marginBottom: '8px', color: '#64748b' }}>Efectivo Recibido</p>
                    <div style={inputGroupStyle}>
                        <Banknote size={18} style={{ color: '#10b981', alignSelf: 'center' }} />
                        <input
                            type="number"
                            placeholder={`Monto (ej. ${total + 10})`}
                            value={cashReceived}
                            onChange={e => setCashReceived(e.target.value)}
                            style={{ ...inputStyle, fontSize: '18px', fontWeight: 800, color: '#10b981' }}
                        />
                    </div>
                    {change > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '8px', background: '#ecfdf5', borderRadius: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>Vuelto a entregar:</span>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: '#047857' }}>S/ {change.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Panel de Cobro Mixto */}
            {showMixed && (
                <div style={mixedPanelStyle}>
                    <div style={inputGroupStyle}>
                        <input
                            type="number"
                            placeholder={`Monto (S/ ${remaining.toFixed(2)})`}
                            value={tempAmount}
                            onChange={e => setTempAmount(e.target.value)}
                            style={inputStyle}
                        />
                        <button onClick={addPayment} style={addBtnStyle} disabled={!selectedMethod}>
                            <Plus size={18} />
                        </button>
                    </div>

                    {payments.length > 0 && (
                        <div style={paymentsListStyle}>
                            {payments.map((p, i) => (
                                <div key={i} style={paymentRowStyle}>
                                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 900 }}>S/ {p.amount.toFixed(2)}</span>
                                        <button onClick={() => removePayment(i)} style={deleteBtnStyle}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Totales */}
            <div style={totalsBoxStyle}>
                <div style={summaryRowStyle}>
                    <span>Subtotal</span>
                    <span style={{ fontWeight: 700 }}>S/ {subtotal.toFixed(2)}</span>
                </div>
                {showMixed && (
                    <div style={{ ...summaryRowStyle, color: '#10b981' }}>
                        <span>Pagado</span>
                        <span style={{ fontWeight: 800 }}>S/ {paidAmount.toFixed(2)}</span>
                    </div>
                )}
                <div style={totalRowStyle}>
                    <span style={totalLabelStyle}>{showMixed ? 'Pendiente' : 'Total'}</span>
                    <span style={{ ...totalValueStyle, color: (showMixed && remaining > 0) ? '#ef4444' : '#0f172a' }}>
                        S/ {(showMixed ? remaining : total).toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Botón Finalizar */}
            <button
                disabled={cartEmpty || loading || (showMixed && Math.abs(remaining) > 0.01) || (!showMixed && payments.length === 0)}
                onClick={handleFinalizeWithChange}
                style={{
                    ...finalizeBtnStyle,
                    background: (cartEmpty || loading || (showMixed && remaining > 0.01) || (!showMixed && payments.length === 0)) ? '#e2e8f0' : '#3b82f6',
                    color: (cartEmpty || loading || (showMixed && remaining > 0.01) || (!showMixed && payments.length === 0)) ? '#94a3b8' : '#fff',
                    cursor: (cartEmpty || loading || (showMixed && remaining > 0.01) || (!showMixed && payments.length === 0)) ? 'not-allowed' : 'pointer',
                }}
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Finalizar Venta <ArrowRight size={18} /></>}
            </button>
        </div>
    );
}

// Estilos
const containerStyle = { flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '16px' };
const headerActionStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' };
const labelStyle = { fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 };
const modeBtnStyle = { background: 'none', border: 'none', fontSize: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' };
const methodBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', borderRadius: '10px', border: '2px solid', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' };
const methodNameStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const mixedPanelStyle = { background: '#f8fafc', borderRadius: '14px', padding: '12px', marginBottom: '12px', border: '1px solid #e2e8f0' };
const inputGroupStyle = { display: 'flex', gap: '8px', marginBottom: '8px' };
const inputStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' };
const addBtnStyle = { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer' };
const paymentsListStyle = { display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' };
const paymentRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#1e293b' };
const deleteBtnStyle = { background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer' };
const totalsBoxStyle = { background: '#f8fafc', borderRadius: '12px', padding: '14px', marginBottom: '12px', border: '1px solid #f1f5f9' };
const summaryRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' };
const totalRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '8px', borderTop: '1px solid #e2e8f0' };
const totalLabelStyle = { fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' };
const totalValueStyle = { fontSize: '24px', fontWeight: 900, lineHeight: 1 };
const finalizeBtnStyle = { width: '100%', border: 'none', borderRadius: '14px', padding: '16px', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' };

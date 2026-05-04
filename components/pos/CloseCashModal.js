'use client';
import { useState, useEffect } from 'react';
import { X, Lock, Calculator, Banknote, CreditCard, Save, AlertCircle, TrendingDown, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CloseCashModal({ isOpen, onClose, idApeCaj, onConfirm }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen && idApeCaj) {
            fetchSummary();
        }
    }, [isOpen, idApeCaj]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/cash/summary?idapecaj=${idApeCaj}`);
            const data = await res.json();
            if (data.success) {
                setSummary(data.summary);
            }
        } catch (e) {
            console.error('Error fetching summary:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = async () => {
        if (!confirm('¿Desea finalizar la jornada y realizar el arqueo de caja?')) return;
        
        setIsClosing(true);
        try {
            // Mapear el resumen a los códigos de Navasoft para dtl_restpos_arqueo
            const totals = [];

            // 1. Efectivo
            const cashAmount = summary.salesBreakdown.find(s => s.method === 'Efectivo')?.total || 0;
            totals.push({ selpago: 1, codtar: '', totnsis: cashAmount, totnfis: cashAmount });

            // 2. Otros (Digitales/Mixtos)
            const digitalPayments = summary.salesBreakdown.filter(s => s.method === 'Digital/Mixto');
            digitalPayments.forEach(p => {
                // Determinar selpago basado en codtar (aproximado por lógica de Navasoft)
                let selpago = 3; // Default Tarjeta
                if (['06', '07'].includes(p.codtar.trim())) selpago = 7; // Billeteras
                
                totals.push({
                    selpago,
                    codtar: p.codtar,
                    totnsis: p.total,
                    totnfis: p.total
                });
            });

            const res = await fetch('/api/cash/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    idapecaj: idApeCaj,
                    totals
                })
            });
            
            const data = await res.json();
            if (data.success) {
                onConfirm(summary);
            } else {
                alert('Error al cerrar: ' + data.error);
            }
        } catch (e) {
            alert('Error de conexión al cerrar caja');
        } finally {
            setIsClosing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={modalStyle}>
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={iconBoxStyle}><Lock size={20} /></div>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Arqueo y Cierre</h2>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Resumen final de jornada</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                </div>

                <div style={{ padding: '24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div className="animate-spin" style={{ marginBottom: '10px' }}><Calculator size={32} /></div>
                            <p style={{ fontWeight: 600 }}>Calculando totales...</p>
                        </div>
                    ) : summary && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            
                            {/* Saldo Inicial y Ventas */}
                            <div style={summaryGridStyle}>
                                <div style={summaryCardStyle}>
                                    <p style={labelStyle}>Monto Inicial</p>
                                    <p style={valueStyle}>S/ {summary.opening.toFixed(2)}</p>
                                </div>
                                <div style={{ ...summaryCardStyle, background: '#f0fdf4', borderColor: '#dcfce7' }}>
                                    <p style={{ ...labelStyle, color: '#15803d' }}>Total Ventas</p>
                                    <p style={{ ...valueStyle, color: '#166534' }}>S/ {summary.totalSales.toFixed(2)}</p>
                                </div>
                                <div style={{ ...summaryCardStyle, background: '#fef2f2', borderColor: '#fee2e2' }}>
                                    <p style={{ ...labelStyle, color: '#b91c1c' }}>Total Egresos</p>
                                    <p style={{ ...valueStyle, color: '#991b1b' }}>S/ {summary.expenses.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Desglose de Ventas */}
                            <div style={breakdownBoxStyle}>
                                <h3 style={sectionTitleStyle}>Desglose por Medio de Pago</h3>
                                {summary.salesBreakdown.map((s, idx) => (
                                    <div key={idx} style={rowStyle}>
                                        <span style={rowLabelStyle}>
                                            {s.method === 'Efectivo' ? '💵 Efectivo' : (s.codtar.trim() === '07' ? '📱 Yape' : (s.codtar.trim() === '06' ? '📱 Plin' : '💳 Tarjeta'))}
                                        </span>
                                        <span style={rowValueStyle}>S/ {s.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Resultado Final */}
                            <div style={totalBoxStyle}>
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: '4px' }}>Efectivo Esperado en Caja</p>
                                    <p style={{ fontSize: '36px', fontWeight: 900, color: '#fff', margin: 0 }}>S/ {summary.expectedFinal.toFixed(2)}</p>
                                </div>
                                <div style={finalIconStyle}><Banknote size={32} /></div>
                            </div>

                            <button 
                                onClick={handleClose} 
                                disabled={isClosing}
                                style={{
                                    ...closeBtnActionStyle,
                                    background: isClosing ? '#94a3b8' : '#ef4444'
                                }}
                            >
                                {isClosing ? 'Finalizando jornada...' : <><Lock size={18} /> Confirmar Cierre de Caja</>}
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' };
const modalStyle = { background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 30px 100px rgba(0,0,0,0.4)', overflow: 'hidden' };
const headerStyle = { padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const iconBoxStyle = { width: '40px', height: '40px', background: '#fef2f2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };

const summaryGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' };
const summaryCardStyle = { padding: '12px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9', textAlign: 'center' };
const labelStyle = { fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' };
const valueStyle = { fontSize: '14px', fontWeight: 900, color: '#1e293b', margin: 0 };

const breakdownBoxStyle = { background: '#f8fafc', borderRadius: '20px', padding: '20px', border: '1px solid #f1f5f9' };
const sectionTitleStyle = { fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #e2e8f0' };
const rowLabelStyle = { fontSize: '13px', fontWeight: 600, color: '#64748b' };
const rowValueStyle = { fontSize: '14px', fontWeight: 800, color: '#0f172a' };

const totalBoxStyle = { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '28px', borderRadius: '24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const finalIconStyle = { opacity: 0.2, transform: 'rotate(-10deg)' };
const closeBtnActionStyle = { width: '100%', color: '#fff', border: 'none', borderRadius: '18px', padding: '20px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 20px rgba(239,68,68,0.2)', transition: 'all 0.2s' };

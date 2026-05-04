'use client';
import { useState, useEffect } from 'react';
import { 
    X, Lock, Calculator, Banknote, CreditCard, 
    Save, AlertCircle, TrendingDown, ArrowRight, 
    FileText, ShoppingBag, Hash, Receipt
} from 'lucide-react';
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
            // Mapear el resumen dinámico para el guardado
            const totals = [];

            // 1. Efectivo
            const cashRow = summary.salesBreakdown.find(s => s.method === 'EFECTIVO');
            if (cashRow) {
                totals.push({ selpago: 1, codtar: '', totnsis: cashRow.total, totnfis: cashRow.total });
            }

            // 2. Digitales (Dinámicos desde la DB)
            const digitalPayments = summary.salesBreakdown.filter(s => s.method !== 'EFECTIVO');
            digitalPayments.forEach(p => {
                totals.push({
                    selpago: 3, // Generalmente tarjeta para arqueo
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
            <motion.div 
                initial={{ y: 50, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                style={modalStyle}
            >
                {/* HEADER */}
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={iconBoxStyle}><Lock size={20} /></div>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Cierre de Jornada</h2>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: 500 }}>ID Sesión: #{idApeCaj} • {summary?.user || '...'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                </div>

                <div style={scrollAreaStyle}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px' }}>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                <Calculator size={40} style={{ color: '#3b82f6', opacity: 0.5 }} />
                            </motion.div>
                            <p style={{ fontWeight: 700, color: '#64748b', marginTop: '16px' }}>Consolidando transacciones...</p>
                        </div>
                    ) : summary && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
                            
                            {/* MINI DASHBOARD */}
                            <div style={summaryGridStyle}>
                                <div style={summaryCardStyle}>
                                    <p style={labelStyle}>Apertura</p>
                                    <p style={valueStyle}>S/ {summary.opening.toFixed(2)}</p>
                                </div>
                                <div style={{ ...summaryCardStyle, background: '#f0fdf4', border: 'none' }}>
                                    <p style={{ ...labelStyle, color: '#10b981' }}>Ventas</p>
                                    <p style={{ ...valueStyle, color: '#065f46' }}>S/ {summary.totalSales.toFixed(2)}</p>
                                </div>
                                <div style={{ ...summaryCardStyle, background: '#fef2f2', border: 'none' }}>
                                    <p style={{ ...labelStyle, color: '#ef4444' }}>Gastos</p>
                                    <p style={{ ...valueStyle, color: '#991b1b' }}>S/ {summary.expenses.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* DOCUMENTOS EMITIDOS */}
                            <div style={sectionBoxStyle}>
                                <div style={sectionHeaderStyle}>
                                    <FileText size={16} />
                                    <span>Documentos Emitidos</span>
                                </div>
                                {summary.docBreakdown.map((d, idx) => (
                                    <div key={idx} style={rowStyle}>
                                        <div>
                                            <p style={rowTitleStyle}>{d.docName}</p>
                                            <p style={rowSubStyle}>{d.rangeStart} al {d.rangeEnd}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={rowValueStyle}>{d.quantity} docs</p>
                                            <p style={{ ...rowSubStyle, fontWeight: 700 }}>S/ {d.total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* DESGLOSE DE PAGOS (DINÁMICO) */}
                            <div style={sectionBoxStyle}>
                                <div style={sectionHeaderStyle}>
                                    <CreditCard size={16} />
                                    <span>Liquidación de Caja</span>
                                </div>
                                {summary.salesBreakdown.map((s, idx) => (
                                    <div key={idx} style={rowStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {s.method === 'EFECTIVO' ? <Banknote size={14} /> : <Smartphone size={14} />}
                                            <span style={rowTitleStyle}>{s.method.trim()}</span>
                                        </div>
                                        <span style={rowValueStyle}>S/ {s.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* VENTA POR LÍNEAS */}
                            <div style={sectionBoxStyle}>
                                <div style={sectionHeaderStyle}>
                                    <ShoppingBag size={16} />
                                    <span>Venta por Categoría</span>
                                </div>
                                {summary.lineBreakdown.map((l, idx) => (
                                    <div key={idx} style={rowStyle}>
                                        <span style={rowTitleStyle}>{l.category.trim()}</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={rowValueStyle}>S/ {l.total.toFixed(2)}</span>
                                            <p style={{ ...rowSubStyle, fontSize: '9px' }}>{l.itemsSold} items</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* TOTAL ESPERADO (FOOTER MODAL) */}
                            <div style={totalBoxStyle}>
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: '4px' }}>Efectivo en Caja</p>
                                    <p style={{ fontSize: '32px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>S/ {summary.expectedFinal.toFixed(2)}</p>
                                </div>
                                <div style={finalIconStyle}><Banknote size={40} /></div>
                            </div>

                            <button 
                                onClick={handleClose} 
                                disabled={isClosing}
                                style={{
                                    ...closeBtnActionStyle,
                                    background: isClosing ? '#94a3b8' : '#0f172a'
                                }}
                            >
                                {isClosing ? 'Cerrando sesión...' : 'Confirmar Cierre de Caja'}
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// Estilos
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const modalStyle = { background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '480px', maxHeight: '90vh', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const scrollAreaStyle = { overflowY: 'auto', flex: 1 };
const headerStyle = { padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', position: 'sticky', top: 0, zIndex: 10 };
const iconBoxStyle = { width: '40px', height: '40px', background: '#fef2f2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' };
const closeBtnStyle = { background: '#f1f5f9', border: 'none', color: '#94a3b8', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const summaryGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' };
const summaryCardStyle = { padding: '16px 12px', background: '#f8fafc', borderRadius: '18px', textAlign: 'center' };
const labelStyle = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' };
const valueStyle = { fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 };

const sectionBoxStyle = { background: '#fff', borderRadius: '24px', padding: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' };
const sectionHeaderStyle = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', opacity: 0.7 };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f8fafc' };
const rowTitleStyle = { fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: 0 };
const rowSubStyle = { fontSize: '11px', color: '#94a3b8', margin: 0 };
const rowValueStyle = { fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 };

const totalBoxStyle = { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', padding: '32px', borderRadius: '28px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 20px 40px rgba(37,99,235,0.3)' };
const finalIconStyle = { opacity: 0.2, transform: 'rotate(-10deg)' };
const closeBtnActionStyle = { width: '100%', color: '#fff', border: 'none', borderRadius: '20px', padding: '20px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };

// Componentes adicionales de Lucide que no estaban importados
function Smartphone({ size }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg> }

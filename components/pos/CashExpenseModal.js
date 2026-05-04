'use client';
import { X, Banknote, Save, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function CashExpenseModal({ isOpen, onClose, onSaved, idapecaj, codpto }) {
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!concepto || !monto || parseFloat(monto) <= 0) {
            return alert('Ingrese un concepto y monto válido');
        }

        setLoading(true);
        try {
            const res = await fetch('/api/cash/expense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    concepto, 
                    monto: parseFloat(monto), 
                    idapecaj,
                    codpto 
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Gasto registrado correctamente');
                setConcepto('');
                setMonto('');
                onSaved();
                onClose();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <div style={titleGroupStyle}>
                        <div style={iconBoxStyle}><Banknote size={20} /></div>
                        <h2 style={titleStyle}>Registrar Gasto de Caja</h2>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                </div>

                <div style={bodyStyle}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Concepto / Descripción</label>
                        <input 
                            type="text" 
                            placeholder="Ej: Pago de seguridad, Limpieza..." 
                            value={concepto}
                            onChange={e => setConcepto(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Monto (S/)</label>
                        <input 
                            type="number" 
                            placeholder="0.00" 
                            value={monto}
                            onChange={e => setMonto(e.target.value)}
                            style={{ ...inputStyle, fontSize: '20px', fontWeight: 'bold' }}
                        />
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        style={{
                            ...saveBtnStyle,
                            background: loading ? '#e2e8f0' : '#0f172a'
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Guardar Gasto</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const modalStyle = { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const headerStyle = { padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const titleGroupStyle = { display: 'flex', alignItems: 'center', gap: '12px' };
const iconBoxStyle = { width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const titleStyle = { fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 };
const closeBtnStyle = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const bodyStyle = { padding: '24px' };
const inputGroupStyle = { marginBottom: '20px' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', transition: 'all 0.2s' };
const saveBtnStyle = { width: '100%', color: '#fff', border: 'none', borderRadius: '14px', padding: '16px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };

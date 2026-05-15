import { X, Banknote, Save, Loader2, User, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import NumericKeypad from './NumericKeypad';

export default function CashExpenseModal({ isOpen, onClose, onSaved, idapecaj, codpto }) {
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [loading, setLoading] = useState(false);
    const [showNumpad, setShowNumpad] = useState(false);
    
    const [reasons, setReasons] = useState([]);
    const [selectedReasonId, setSelectedReasonId] = useState('');
    
    // Estados para adelanto de sueldo
    const [empSearch, setEmpSearch] = useState('');
    const [employees, setEmployees] = useState([]);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchReasons();
        }
    }, [isOpen]);

    const fetchReasons = async () => {
        try {
            const res = await fetch('/api/cash/expenses/reasons');
            const data = await res.json();
            setReasons(data);
            if (data.length > 0) {
                const defaultReason = data.find(r => r.name.toUpperCase().includes('DIVERSO')) || data[0];
                setSelectedReasonId(defaultReason.id);
            }
        } catch (e) {
            console.error('Error fetching reasons:', e);
        }
    };

    const currentReason = reasons.find(r => r.id === selectedReasonId);
    const isAdelanto = currentReason?.name.toUpperCase().includes('ADELANTO');

    useEffect(() => {
        if (isAdelanto && empSearch.length > 2) {
            const delayDebounce = setTimeout(async () => {
                setIsSearching(true);
                try {
                    const res = await fetch(`/api/employees?q=${empSearch}`);
                    const data = await res.json();
                    setEmployees(Array.isArray(data) ? data : []);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSearching(false);
                }
            }, 300);
            return () => clearTimeout(delayDebounce);
        } else {
            setEmployees([]);
        }
    }, [empSearch, isAdelanto]);

    const handleNumpadKeyPress = (key) => {
        if (key === '.') {
            if (!monto.includes('.')) setMonto(prev => prev + '.');
        } else {
            setMonto(prev => prev + key);
        }
    };

    const handleNumpadDelete = () => {
        setMonto(prev => prev.slice(0, -1));
    };

    if (!isOpen) return null;

    const handleSave = async () => {
        const finalConcepto = isAdelanto ? `ADELANTO DE SUELDO - ${selectedEmp?.nombres} ${selectedEmp?.ap_paterno}` : concepto;
        const finalMonto = parseFloat(monto);

        if (isAdelanto && !selectedEmp) return alert('Debe seleccionar un empleado');
        if (!finalConcepto || !finalMonto || finalMonto <= 0) {
            return alert('Ingrese datos válidos');
        }

        setLoading(true);
        try {
            const res = await fetch('/api/cash/expense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    concepto: finalConcepto, 
                    monto: finalMonto, 
                    idapecaj,
                    codpto,
                    codmotivo: selectedReasonId,
                    nroctacte: selectedEmp?.codigo_emp || ''
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Registro guardado correctamente');
                resetForm();
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

    const resetForm = () => {
        setConcepto('');
        setMonto('');
        setEmpSearch('');
        setSelectedEmp(null);
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <div style={titleGroupStyle}>
                        <div style={iconBoxStyle}><Banknote size={20} /></div>
                        <h2 style={titleStyle}>Movimiento de Caja</h2>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                </div>

                <div style={bodyStyle}>
                    {/* Selector de Motivo Dinámico */}
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Motivo del Movimiento</label>
                        <select 
                            value={selectedReasonId}
                            onChange={e => setSelectedReasonId(e.target.value)}
                            style={inputStyle}
                        >
                            {reasons.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {!isAdelanto ? (
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
                    ) : (
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Buscar Empleado</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} />
                                <input 
                                    type="text" 
                                    placeholder="Nombre o DNI..." 
                                    value={selectedEmp ? `${selectedEmp.nombres} ${selectedEmp.ap_paterno}` : empSearch}
                                    onChange={e => { setEmpSearch(e.target.value); setSelectedEmp(null); }}
                                    style={{ ...inputStyle, paddingLeft: '36px' }}
                                />
                                {isSearching && <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', right: '12px', top: '14px', color: '#3b82f6' }} />}
                                
                                {employees.length > 0 && !selectedEmp && (
                                    <div style={resultsContainerStyle}>
                                        {employees.map(emp => (
                                            <div 
                                                key={emp.codigo_emp} 
                                                onClick={() => setSelectedEmp(emp)}
                                                style={resultItemStyle}
                                            >
                                                <User size={14} />
                                                <span>{emp.nombres} {emp.ap_paterno}</span>
                                                <small style={{ color: '#94a3b8' }}>({emp.dni})</small>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Monto (S/)</label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="text" 
                                inputMode="none"
                                placeholder="0.00" 
                                value={monto}
                                onChange={e => setMonto(e.target.value)}
                                onFocus={() => setShowNumpad(true)}
                                style={{ ...inputStyle, fontSize: '24px', fontWeight: 900, color: '#1e293b', textAlign: 'center' }}
                            />
                            <NumericKeypad 
                                isOpen={showNumpad}
                                onClose={() => setShowNumpad(false)}
                                onKeyPress={handleNumpadKeyPress}
                                onDelete={handleNumpadDelete}
                                value={monto}
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        style={{
                            ...saveBtnStyle,
                            background: loading ? '#e2e8f0' : (isAdelanto ? '#10b981' : '#0f172a')
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> {isAdelanto ? 'Registrar Adelanto' : 'Guardar Gasto'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const modalStyle = { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '420px', overflow: 'visible', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const headerStyle = { padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const titleGroupStyle = { display: 'flex', alignItems: 'center', gap: '12px' };
const iconBoxStyle = { width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const titleStyle = { fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 };
const closeBtnStyle = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const bodyStyle = { padding: '24px' };
const inputGroupStyle = { marginBottom: '20px', position: 'relative' };
const labelStyle = { display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '14px', transition: 'all 0.2s' };
const saveBtnStyle = { width: '100%', color: '#fff', border: 'none', borderRadius: '16px', padding: '18px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const toggleContainerStyle = { display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '20px' };
const toggleBtnStyle = { flex: 1, border: 'none', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' };
const resultsContainerStyle = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 10, marginTop: '4px', maxHeight: '200px', overflowY: 'auto' };
const resultItemStyle = { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', hover: { background: '#f8fafc' } };

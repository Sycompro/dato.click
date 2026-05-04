'use client';
import { useState, useEffect } from 'react';
import { 
    Search, Filter, Plus, Users, Clock, AlertCircle, 
    CheckCircle2, XCircle, ChevronDown, MoreVertical, 
    RefreshCw, Calendar, MessageCircle, Edit3, Trash2,
    FileText, Download, MapPin, CreditCard, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MembershipsView({ onRenew }) {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSede, setFilterSede] = useState('all');
    const [renewingMember, setRenewingMember] = useState(null);
    const [plans, setPlans] = useState([]);
    const [planSearchTerm, setPlanSearchTerm] = useState('');
    const [isExtension, setIsExtension] = useState(false);
    const [expandedMember, setExpandedMember] = useState(null);
    const [memberHistory, setMemberHistory] = useState({});
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        fetchMemberships();
    }, [searchTerm, filterStatus, filterSede]);

    useEffect(() => {
        const t = setTimeout(() => fetchPlans(), 300);
        return () => clearTimeout(t);
    }, [planSearchTerm]);

    const fetchMemberships = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/memberships/list?q=${searchTerm}&status=${filterStatus}&sede=${filterSede}`);
            const data = await res.json();
            setMembers(data.members || []);
            setStats(data.stats || { total: 0, active: 0, expiring: 0, expired: 0 });
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await fetch(`/api/products/search?q=${encodeURIComponent(planSearchTerm)}`);
            const data = await res.json();
            setPlans(Array.isArray(data) ? data : []);
        } catch (e) { console.error('Error fetching plans', e); }
    };

    const fetchHistory = async (member) => {
        if (expandedMember === member.id) {
            setExpandedMember(null);
            return;
        }
        
        setExpandedMember(member.id);
        if (memberHistory[member.id]) return;

        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/memberships/history?codcli=${member.id}`);
            const data = await res.json();
            setMemberHistory(prev => ({ ...prev, [member.id]: data }));
        } catch (e) {
            console.error('Error fetching history:', e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleProcessRenewal = (plan) => {
        if (onRenew) {
            onRenew(renewingMember, plan);
            setRenewingMember(null);
            setPlanSearchTerm('');
            setIsExtension(false);
        } else {
            alert('Función de venta no disponible en este modo');
        }
    };

    return (
        <div style={containerStyle}>
            {/* Cabecera Principal */}
            <div style={{ marginBottom: '4px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Gestión de Membresías</h1>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Seguimiento, renovación y extensión de planes.</p>
            </div>

            {/* Apartado: Resumen de estados */}
            <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Resumen de estados
                </label>
                <div style={statsGridStyle}>
                    <StatCard 
                        title="ACTIVAS" 
                        count={stats.active} 
                        icon={<CheckCircle2 size={20} />} 
                        color="#10b981" 
                        bgColor="#ecfdf5" 
                    />
                    <StatCard 
                        title="POR VENCER" 
                        count={stats.expiring} 
                        icon={<AlertCircle size={20} />} 
                        color="#f59e0b" 
                        bgColor="#fffbeb" 
                    />
                    <StatCard 
                        title="VENCIDAS" 
                        count={stats.expired} 
                        icon={<XCircle size={20} />} 
                        color="#ef4444" 
                        bgColor="#fef2f2" 
                    />
                    <StatCard 
                        title="TOTAL" 
                        count={stats.total} 
                        icon={<Users size={20} />} 
                        color="#3b82f6" 
                        bgColor="#eff6ff" 
                    />
                </div>
            </div>

            {/* Apartado: Listado y Filtros */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Listado detallado de socios
                </label>
                <div style={filterBarStyle}>
                <div style={searchWrapperStyle}>
                    <Search size={18} style={{ color: '#94a3b8' }} />
                    <input 
                        type="text" 
                        placeholder="Buscar por miembro, teléfono o plan..." 
                        style={searchInputStyle}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div style={actionsRowStyle}>
                    <select 
                        style={selectStyle}
                        value={filterSede}
                        onChange={(e) => setFilterSede(e.target.value)}
                    >
                        <option value="all">Todas las sedes</option>
                        <option value="my">Mi sede</option>
                    </select>
                    <select 
                        style={selectStyle} 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">Todos los estados</option>
                        <option value="activo">Activos</option>
                        <option value="por vencer">Por vencer</option>
                        <option value="vencido">Vencidos</option>
                    </select>
                    <select style={selectStyle}><option>Todos los planes</option></select>
                </div>
            </div>

            {/* Tabla de Resultados */}
            <div style={tableContainerStyle}>
                <div style={tableHeaderStyle}>
                    <span style={{ flex: 2 }}>Miembro</span>
                    <span style={{ flex: 1.5 }}>Sede</span>
                    <span style={{ flex: 1.5 }}>Plan</span>
                    <span style={{ flex: 1 }}>Inicio</span>
                    <span style={{ flex: 1.2 }}>Vencimiento</span>
                    <span style={{ flex: 1 }}>Estado</span>
                    <span style={{ flex: 1 }}>Precio</span>
                    <span style={{ flex: 1 }}>Acciones</span>
                </div>

                {loading ? (
                    <div style={loadingStyle}>Cargando membresías...</div>
                ) : (members || []).length === 0 ? (
                    <div style={loadingStyle}>No se encontraron membresías.</div>
                ) : (
                    (members || []).map((member, idx) => (
                        <div key={member.id}>
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                style={{
                                    ...tableRowStyle,
                                    borderLeft: expandedMember === member.id ? '4px solid #3b82f6' : '4px solid transparent',
                                    background: expandedMember === member.id ? '#f8fafc' : '#fff'
                                }}
                            >
                                {/* Miembro */}
                                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={avatarStyle}>{member.name.charAt(0)}</div>
                                    <div>
                                        <div style={memberNameStyle}>{member.name}</div>
                                        <div style={memberPhoneStyle}>{member.phone}</div>
                                    </div>
                                </div>

                                {/* Sede */}
                                <div style={{ flex: 1.5 }}>
                                    <div style={sedeNameStyle}><MapPin size={14} /> {member.sede}</div>
                                    <div style={sedeAddrStyle}>{member.address}</div>
                                </div>

                                {/* Plan */}
                                <div style={{ flex: 1.5, color: '#475569', fontSize: '13px' }}>
                                    {member.planName || 'Sin plan registrado'}
                                </div>

                                {/* Inicio */}
                                <div style={{ flex: 1, color: '#64748b', fontSize: '13px' }}>
                                    {member.startDate ? new Date(member.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                </div>

                                {/* Vencimiento */}
                                <div style={{ flex: 1.2 }}>
                                    <div style={getExpStyle(member.status)}>
                                        {member.endDate && !isNaN(new Date(member.endDate).getTime()) ? new Date(member.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                                    </div>
                                    <div style={daysLeftStyle}>{member.daysLeft > 0 ? `${member.daysLeft}d restantes` : member.daysLeft < 0 ? `Vencido hace ${Math.abs(member.daysLeft)}d` : ''}</div>
                                </div>

                                {/* Estado */}
                                <div style={{ flex: 1 }}>
                                    <span style={getStatusBadgeStyle(member.status)}>{member.status}</span>
                                </div>

                                {/* Precio */}
                                <div style={{ flex: 1, fontWeight: '600', color: '#1e293b' }}>
                                    {member.price ? `S/${parseFloat(member.price).toFixed(2)}` : '-'}
                                </div>

                                <div style={{ flex: 1, display: 'flex', gap: '10px', color: '#94a3b8', alignItems: 'center' }}>
                                    <RefreshCw 
                                        size={16} 
                                        style={{ 
                                            ...actionIconStyle, 
                                            color: member.status === 'Vencido' ? '#3b82f6' : '#cbd5e1',
                                            opacity: member.status === 'Vencido' ? 1 : 0.5
                                        }} 
                                        title="Renovar"
                                        onClick={() => {
                                            if (member.status !== 'Vencido') {
                                                alert('Esta membresía aún se encuentra vigente. Si desea agregar más tiempo antes de que venza, use la opción "Extender" (icono de calendario).');
                                                return;
                                            }
                                            setIsExtension(false);
                                            setRenewingMember(member);
                                        }}
                                    />
                                    <Calendar 
                                        size={16} 
                                        style={{ 
                                            ...actionIconStyle, 
                                            color: (member.status === 'Activo' || member.status === 'Por vencer') ? '#10b981' : '#cbd5e1',
                                            opacity: (member.status === 'Activo' || member.status === 'Por vencer') ? 1 : 0.5
                                        }} 
                                        title="Extender"
                                        onClick={() => {
                                            if (member.status === 'Vencido') {
                                                alert('Esta membresía ya expiró. Use la opción "Renovar" (flechas azules) para iniciar un nuevo periodo hoy mismo.');
                                                return;
                                            }
                                            setIsExtension(true);
                                            setRenewingMember(member);
                                        }}
                                    />
                                    <Clock 
                                        size={16} 
                                        style={{ 
                                            ...actionIconStyle, 
                                            color: (expandedMember === member.id || member.historyCount > 1) ? '#8b5cf6' : '#cbd5e1',
                                            opacity: (expandedMember === member.id || member.historyCount > 1) ? 1 : 0.4
                                        }} 
                                        title={member.historyCount > 1 ? "Ver historial de extensiones" : "Sin historial previo"}
                                        onClick={() => fetchHistory(member)}
                                    />
                                    <Trash2 size={16} style={{ ...actionIconStyle, color: '#fca5a5' }} />
                                </div>
                            </motion.div>

                            {/* Panel Desplegable de Historial */}
                            <AnimatePresence>
                                {expandedMember === member.id && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        style={{ overflow: 'hidden', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}
                                    >
                                        <div style={{ padding: '20px 40px 24px 70px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                <div style={{ width: '4px', height: '14px', background: '#8b5cf6', borderRadius: '2px' }} />
                                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Historial de Operaciones
                                                </span>
                                            </div>

                                            {loadingHistory && !memberHistory[member.id] ? (
                                                <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8' }}>Consultando base de datos...</div>
                                            ) : (memberHistory[member.id] || []).length === 0 ? (
                                                <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8' }}>No se encontraron operaciones previas.</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {(memberHistory[member.id] || []).map((entry, hIdx) => (
                                                        <div key={hIdx} style={{ 
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                                            background: hIdx === 0 ? '#fff' : 'transparent',
                                                            padding: '10px 16px', borderRadius: '10px',
                                                            border: hIdx === 0 ? '1px solid #e2e8f0' : '1px solid transparent',
                                                            boxShadow: hIdx === 0 ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                <div style={{ 
                                                                    width: '32px', height: '32px', borderRadius: '8px', 
                                                                    background: hIdx === 0 ? '#f5f3ff' : '#f1f5f9',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    color: hIdx === 0 ? '#8b5cf6' : '#94a3b8'
                                                                }}>
                                                                    <FileText size={14} />
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{entry.planName}</div>
                                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{entry.document} • {entry.docType === '01' ? 'Factura' : 'Boleta'}</div>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                                                                    {(() => {
                                                                        const parts = entry.date.split('-');
                                                                        if (parts.length === 3) {
                                                                            const [y, m, d] = parts;
                                                                            return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                                                                        }
                                                                        return entry.date;
                                                                    })()}
                                                                </div>
                                                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981' }}>S/ {entry.price.toFixed(2)}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))
                )}
            </div>
        </div>

            {/* Modal de Renovación */}
            {renewingMember && (
                <div style={modalOverlayStyle}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={renewalModalStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ 
                                    ...iconBoxStyle, 
                                    background: isExtension ? '#ecfdf5' : '#eff6ff', 
                                    color: isExtension ? '#10b981' : '#3b82f6' 
                                }}>
                                    {isExtension ? <Calendar size={20} /> : <RefreshCw size={20} />}
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                    {isExtension ? 'Extender membresía' : 'Renovar membresía'}
                                </h2>
                            </div>
                            <button onClick={() => { setRenewingMember(null); setPlanSearchTerm(''); setIsExtension(false); }} style={closeBtnStyle}><X size={20} /></button>
                        </div>

                        <div style={{ 
                            ...infoBannerStyle, 
                            background: isExtension ? '#f0fdf4' : '#eff6ff', 
                            border: `1px solid ${isExtension ? '#dcfce7' : '#dbeafe'}`,
                            borderLeft: `6px solid ${isExtension ? '#10b981' : '#3b82f6'}`,
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Decoración de fondo sutil */}
                            <div style={{ 
                                position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05, transform: 'rotate(15deg)' 
                            }}>
                                {isExtension ? <Calendar size={80} /> : <RefreshCw size={80} />}
                            </div>

                            <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '18px', letterSpacing: '-0.5px' }}>{renewingMember.name}</div>
                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} />
                                {isExtension ? 'Vigencia hasta el: ' : 'Venció el: '}
                                <span style={{ fontWeight: 700, color: '#475569' }}>
                                    {renewingMember.endDate && new Date(renewingMember.endDate).getFullYear() > 1900 
                                        ? new Date(renewingMember.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) 
                                        : 'Sin registro previo'}
                                </span>
                            </div>

                            <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                marginTop: '16px', 
                                padding: '8px 12px',
                                borderRadius: '12px',
                                background: isExtension ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                color: isExtension ? '#059669' : '#2563eb', 
                                fontWeight: 800, 
                                fontSize: '12px' 
                            }}>
                                <div style={{ 
                                    width: '18px', height: '18px', borderRadius: '6px', 
                                    background: isExtension ? '#10b981' : '#3b82f6', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff'
                                }}>
                                    <CheckCircle2 size={12} />
                                </div>
                                {isExtension ? 'NUEVA VIGENCIA CONSECUTIVA' : 'RENOVACIÓN INMEDIATA (DESDE HOY)'}
                            </div>
                        </div>

                        <div style={{ marginTop: '24px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', display: 'block' }}>
                                {isExtension ? 'BUSCAR PLAN PARA EXTENSIÓN' : 'BUSCAR PLAN DE RENOVACIÓN'}
                            </label>
                            
                            {/* Buscador de Planes */}
                            <div style={{ ...searchWrapperStyle, height: '44px', marginBottom: '16px', padding: '0 12px' }}>
                                <Search size={16} style={{ color: '#94a3b8' }} />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Escriba el nombre del plan..." 
                                    style={{ ...searchInputStyle, fontSize: '13px' }}
                                    value={planSearchTerm}
                                    onChange={(e) => setPlanSearchTerm(e.target.value)}
                                />
                            </div>

                            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {plans.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                                        No se encontraron planes que coincidan
                                    </div>
                                ) : plans.map(plan => (
                                    <button 
                                        key={plan.id} 
                                        onClick={() => handleProcessRenewal(plan)}
                                        style={planOptionStyle}
                                    >
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{plan.name}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Código: {plan.userCode}</div>
                                        </div>
                                        <div style={{ fontWeight: 800, color: isExtension ? '#059669' : '#10b981' }}>S/{parseFloat(plan.price).toFixed(2)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

// Sub-componente Tarjeta
function StatCard({ title, count, icon, color, bgColor }) {
    return (
        <div style={{ ...statCardStyle, background: bgColor }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color, letterSpacing: '0.5px' }}>{title}</span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginTop: '2px' }}>{count}</span>
            </div>
            <div style={{ color, opacity: 0.8 }}>{icon}</div>
        </div>
    );
}

// Estilos
const containerStyle = { padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 };

const statsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' };

const statCardStyle = {
    padding: '12px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)'
};

const filterBarStyle = { 
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px',
    background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9'
};

const searchWrapperStyle = { 
    flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc',
    padding: '0 16px', borderRadius: '12px', height: '48px', border: '1px solid #e2e8f0'
};

const searchInputStyle = { background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '14px', color: '#1e293b' };

const actionsRowStyle = { display: 'flex', gap: '12px' };

const selectStyle = { 
    height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #e2e8f0', 
    fontSize: '13px', color: '#475569', background: '#fff', cursor: 'pointer'
};

const tableContainerStyle = { background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' };

const tableHeaderStyle = { 
    display: 'flex', padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
    fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px'
};

const tableRowStyle = { 
    display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.2s', cursor: 'default'
};

const avatarStyle = { 
    width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', 
    color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
};

const memberNameStyle = { fontSize: '14px', fontWeight: '600', color: '#1e293b' };
const memberPhoneStyle = { fontSize: '12px', color: '#94a3b8' };

const sedeNameStyle = { fontSize: '13px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' };
const sedeAddrStyle = { fontSize: '10px', color: '#94a3b8', marginTop: '2px' };

const getStatusBadgeStyle = (status) => ({
    padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700',
    background: status === 'Activo' ? '#ecfdf5' : status === 'Por vencer' ? '#fffbeb' : '#fef2f2',
    color: status === 'Activo' ? '#10b981' : status === 'Por vencer' ? '#f59e0b' : '#ef4444'
});

const getExpStyle = (status) => ({
    fontSize: '13px', fontWeight: '700',
    color: status === 'Activo' ? '#10b981' : status === 'Por vencer' ? '#f59e0b' : '#ef4444'
});

const daysLeftStyle = { fontSize: '10px', color: '#94a3b8', marginTop: '2px' };

const actionIconStyle = { cursor: 'pointer', transition: 'color 0.2s' };

const loadingStyle = { padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' };

const iconBoxStyle = {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const renewalModalStyle = { background: '#fff', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9' };
const closeBtnStyle = { background: '#f8fafc', border: 'none', color: '#94a3b8', borderRadius: '10px', padding: '8px', cursor: 'pointer' };
const infoBannerStyle = { padding: '20px', background: '#eff6ff', borderRadius: '16px', border: '1px solid #dbeafe' };
const planOptionStyle = {
    width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid #f1f5f9', background: '#fff',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s'
};
// Hover effect handled by inline if needed or just simple style

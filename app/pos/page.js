'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
    Search, ShoppingCart, User, Plus, Minus, X, Check, 
    ChevronRight, Loader2, UserPlus, ShieldCheck, Trash2, 
    LayoutGrid, Clock, Settings, LogOut, ShoppingBag, Zap, Sparkles, Package,
    Lock, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

import Sidebar from '@/components/pos/Sidebar';
import ProductCard from '@/components/pos/ProductCard';
import CartItem from '@/components/pos/CartItem';
import PaymentSection from '@/components/pos/PaymentSection';
import SuccessModal from '@/components/pos/SuccessModal';
import CustomerManualModal from '@/components/pos/CustomerManualModal';
import CustomDatePicker from '@/components/pos/CustomDatePicker';
import CartDetailsModal from '@/components/pos/CartDetailsModal';
import SalesHistoryModal from '@/components/pos/SalesHistoryModal';
import CloseCashModal from '@/components/pos/CloseCashModal';

export default function POSPage() {
    const { data: session } = useSession();
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [cart, setCart] = useState([]);
    const [warehouse] = useState('01');
    const [idApeCaj, setIdApeCaj] = useState(null);
    const [isOpeningCash, setIsOpeningCash] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');
    const [docType, setDocType] = useState('03');
    const [paymentMethod, setPaymentMethod] = useState(1);
    const [selectedTar, setSelectedTar] = useState('');
    const [availableMethods, setAvailableMethods] = useState([]);
    const [customer, setCustomer] = useState({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' });
    const [customerSearch, setCustomerSearch] = useState('');
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [showCartModal, setShowCartModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [manualDoc, setManualDoc] = useState('');
    const [orderSuccess, setOrderSuccess] = useState(null);
    const [exchangeRate, setExchangeRate] = useState(1);
    const [mounted, setMounted] = useState(false);
    const [categories, setCategories] = useState([
        { id: 'all', name: 'Todos', icon: LayoutGrid }
    ]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [cartVisible, setCartVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [salespeople, setSalespeople] = useState([]);
    const [selectedSalesperson, setSelectedSalesperson] = useState('');
    const [printData, setPrintData] = useState(null);
    const searchRef = useRef(null);

    // Utilidad para convertir números a letras
    const numeroALetras = (num) => {
        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const especiales = { 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE' };
        
        const entero = Math.floor(num);
        const decimales = Math.round((num - entero) * 100).toString().padStart(2, '0');
        
        let letras = '';
        if (entero === 0) letras = 'CERO';
        else if (entero < 10) letras = unidades[entero];
        else if (entero < 100) {
            const u = entero % 10;
            const d = Math.floor(entero / 10);
            if (especiales[entero]) letras = especiales[entero];
            else letras = `${decenas[d]}${u > 0 ? ' Y ' + unidades[u] : ''}`;
        } else if (entero === 100) letras = 'CIEN';
        else letras = entero.toString();
        
        return `${letras} Y ${decimales}/100 SOLES`;
    };

    const [companySettings, setCompanySettings] = useState(null);

    useEffect(() => {
        setMounted(true);
        const checkSize = () => {
            const mobile = window.innerWidth < 1280;
            setIsMobile(mobile);
            if (!mobile) setCartVisible(true);
        };
        checkSize();
        window.addEventListener('resize', checkSize);
        
        Promise.all([
            fetch('/api/cash/active').then(r => r.json()).catch(() => ({})),
            fetch('/api/payment-methods').then(r => r.json()).catch(() => []),
            fetch('/api/products/categories').then(r => r.json()).catch(() => []),
            fetch('/api/salespeople').then(r => r.json()).catch(() => []),
            fetch('/api/company/settings').then(r => r.json()).catch(() => null),
        ]).then(([cashData, methodsData, catsData, salesData, settingsData]) => {
            if (cashData?.id) setIdApeCaj(cashData.id);
            if (cashData?.exchangeRate) setExchangeRate(cashData.exchangeRate);
            if (Array.isArray(methodsData)) setAvailableMethods(methodsData);
            if (settingsData) setCompanySettings(settingsData);
            if (Array.isArray(salesData)) {
                setSalespeople(salesData);
                if (salesData.length > 0) setSelectedSalesperson(salesData[0].id);
            }
            if (Array.isArray(catsData)) {
                setCategories([
                    { id: 'all', name: 'Todos', icon: LayoutGrid },
                    ...catsData.map(c => ({ id: c.id, name: c.name, icon: Package }))
                ]);
            }
        });

        return () => window.removeEventListener('resize', checkSize);
    }, []);

    const handlePrint = (data) => {
        setPrintData(data);
        setTimeout(() => {
            window.print();
        }, 300);
    };

    useEffect(() => {
        const t = setTimeout(() => fetchProducts(), 250);
        return () => clearTimeout(t);
    }, [searchTerm, selectedCategory]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const url = `/api/products/search?q=${encodeURIComponent(searchTerm)}&alm=${warehouse}&category=${selectedCategory}`;
            const res = await fetch(url);
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch { setProducts([]); }
        finally { setLoading(false); }
    };

    const handleOpenCash = async (e) => {
        e.preventDefault();
        setIsOpeningCash(true);
        try {
            const res = await fetch('/api/cash/open', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(openingAmount) || 0 })
            });
            const data = await res.json();
            if (data.success) setIdApeCaj(data.id);
            else alert(data.error || 'Error al abrir caja');
        } catch { alert('Error de conexión'); }
        finally { setIsOpeningCash(false); }
    };

    const handleCustomerSearch = async (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setCustomerSearch(val);
        
        if (val.length === 11) setDocType('01');
        
        if (val.length === 8 || val.length === 11) {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/customers/search?q=${val}`);
                const { data, message } = await res.json();
                
                if (data) {
                    setCustomer({
                        name: data.nomcli,
                        ruc: data.ruccli || data.nrodni,
                        code: data.codcli,
                        address: data.address,
                        phone: data.phone || '',
                        birthdate: data.birthdate || '',
                        isNew: data.isNew,
                        source: data.source
                    });
                } else {
                    if (message) alert(message);
                    setManualDoc(val);
                    setCustomer({ name: 'NO ENCONTRADO', ruc: val, code: 'MANUAL', isNew: false });
                }
            } catch (err) { console.error('Error searching customer', err); }
            finally { setIsSearchingCustomer(false); }
        }
    };

    const handleSaveInternal = async (formData) => {
        setIsSearchingCustomer(true);
        try {
            const res = await fetch('/api/customers/register-internal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setCustomer({
                    name: `${formData.name} ${formData.lastname}`,
                    ruc: formData.doc,
                    code: 'INTERNO',
                    source: 'RAILWAY'
                });
                setShowManualModal(false);
                alert('Registrado en Base de Datos de Railway');
            }
        } catch { alert('Error al registrar'); }
        finally { setIsSearchingCustomer(false); }
    };

    const registerCustomer = async () => {
        if (!customer.isNew) return;
        setIsSearchingCustomer(true);
        try {
            const payload = {
                nomcli: customer.name,
                ruccli: customer.ruc.length === 11 ? customer.ruc : '',
                nrodni: customer.ruc.length === 8 ? customer.ruc : '',
                dircli: customer.address || ''
            };

            const res = await fetch('/api/customers/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setCustomer(prev => ({ ...prev, code: data.codcli, isNew: false }));
                alert('Cliente registrado exitosamente');
            } else {
                alert('Error al registrar cliente: ' + data.details);
            }
        } catch { alert('Error de conexión'); }
        finally { setIsSearchingCustomer(false); }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === product.id);
            if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...product, quantity: 1 }];
        });
    };
    const updateQuantity = (id, delta) =>
        setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));

    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

    const finalizeSale = async () => {
        if (!cart.length || !idApeCaj) return;
        if (!selectedSalesperson) {
            alert('Por favor, selecciona un vendedor antes de finalizar.');
            return;
        }
        
        setIsFinalizing(true);
        try {
            if (customer.phone || customer.birthdate) {
                const names = customer.name.split(' ');
                await fetch('/api/customers/register-internal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doc: customer.ruc,
                        name: names[0] || customer.name,
                        lastname: names.slice(1).join(' ') || 'EXTERNO',
                        phone: customer.phone,
                        birthdate: customer.birthdate
                    })
                }).catch(e => console.error('Error saving internal data:', e));
            }

            const erpCodCli = (customer.code === 'INTERNO' || customer.code === 'MANUAL') ? '000000' : customer.code;

            const res = await fetch('/api/sales/finalize', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType, pointOfSale: '01', 
                    codcli: erpCodCli,
                    nomcli: customer.name, 
                    ruccli: customer.ruc, 
                    items: cart,
                    idApeCaj, paymentMethod, codtar: selectedTar, warehouse,
                    codven: selectedSalesperson,
                    exchangeRate
                })
            });
            const result = await res.json();
            if (result.success) { 
                const printObj = {
                    documentNumber: result.documentNumber,
                    docType,
                    customer,
                    items: [...cart],
                    total,
                    date: new Date().toISOString(),
                    salesperson: salespeople.find(v => v.id === selectedSalesperson)?.name
                };
                setOrderSuccess(result.documentNumber); 
                setCart([]); 
                setCustomer({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' }); 
                setCustomerSearch(''); 
                handlePrint(printObj);
            }
            else alert('Error: ' + result.details);
        } catch (err) { 
            console.error(err);
            alert('Error al procesar la venta'); 
        }
        finally { setIsFinalizing(false); }
    };

    const total = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const itemCount = cart.reduce((acc, i) => acc + i.quantity, 0);

    if (!mounted) return null;

    if (!idApeCaj) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Inter', sans-serif" }}>
                <form onSubmit={handleOpenCash} style={{
                    background: '#fff', borderRadius: '24px', padding: '40px', width: '100%', maxWidth: '400px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.3)', textAlign: 'center',
                }}>
                    <div style={{ width: '56px', height: '56px', background: '#3b82f6', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Zap size={24} style={{ color: '#fff', fill: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>Abrir Caja</h1>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 28px' }}>Ingresa el monto de apertura</p>
                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', fontWeight: 800, color: '#94a3b8' }}>S/</span>
                        <input type="number" step="0.01" autoFocus required placeholder="0.00"
                            value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
                            style={{
                                width: '100%', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '14px',
                                padding: '20px 16px 20px 48px', fontSize: '28px', fontWeight: 800, color: '#0f172a',
                                outline: 'none', textAlign: 'right', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <button disabled={isOpeningCash} style={{
                        width: '100%', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '14px',
                        padding: '16px', fontSize: '15px', fontWeight: 800, cursor: isOpeningCash ? 'not-allowed' : 'pointer',
                        opacity: isOpeningCash ? 0.6 : 1, boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                    }}>
                        {isOpeningCash ? 'Abriendo...' : 'Abrir Caja y Comenzar'}
                    </button>
                    <button type="button" onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        style={{ marginTop: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                        Cerrar sesión
                    </button>
                </form>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                html, body { font-family: 'Inter', -apple-system, sans-serif; height: 100%; overflow: hidden; -webkit-font-smoothing: antialiased; background: #f1f5f9; }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
                @media (max-width: 1280px) {
                    .ticket-aside { position: fixed !important; top: 0; right: 0; bottom: 0; z-index: 100; transform: translateX(100%); transition: transform 0.3s ease; width: 380px !important; box-shadow: -20px 0 50px rgba(0,0,0,0.1) !important; }
                    .ticket-aside.visible { transform: translateX(0); }
                    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); z-index: 90; }
                }
            `}</style>

            <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f1f5f9', position: 'relative' }}>
                <Sidebar 
                    onSignOut={() => signOut({ callbackUrl: '/auth/signin' })} 
                    onOpenCloseCash={() => setShowCloseModal(true)}
                    onOpenHistory={() => setShowHistoryModal(true)}
                />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f8fafc' }}>
                    {/* BARRA SUPERIOR: BUSCADOR Y DOCUMENTO */}
                    <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input type="text" placeholder="Buscar productos por nombre o código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px 10px 38px', fontSize: '13px', fontWeight: 500, color: '#1e293b', outline: 'none' }} />
                        </div>

                        <div style={{ display: isMobile ? 'none' : 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', gap: '3px', flexShrink: 0 }}>
                            {[{ v: '03', l: 'Boleta' }, { v: '01', l: 'Factura' }, { v: '65', l: 'Nota Venta' }].map(({ v, l }) => {
                                const isRuc = customerSearch.length === 11;
                                const isDisabled = isRuc && v !== '01';
                                return (
                                    <button 
                                        key={v} 
                                        disabled={isDisabled}
                                        onClick={() => setDocType(v)} 
                                        style={{ 
                                            padding: '8px 12px', 
                                            borderRadius: '8px', 
                                            fontSize: '11px', 
                                            fontWeight: 700, 
                                            border: 'none', 
                                            cursor: isDisabled ? 'not-allowed' : 'pointer', 
                                            background: docType === v ? '#fff' : 'transparent', 
                                            color: isDisabled ? '#cbd5e1' : (docType === v ? '#3b82f6' : '#64748b'), 
                                            boxShadow: docType === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                            opacity: isDisabled ? 0.6 : 1,
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {l}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* BARRA DE CLIENTE Y VENDEDOR */}
                    <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ width: '240px', position: 'relative' }}>
                                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={14} />
                                <input 
                                    type="text" 
                                    placeholder="DNI o RUC..." 
                                    value={customerSearch}
                                    onChange={handleCustomerSearch}
                                    style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, outline: 'none' }}
                                />
                                {isSearchingCustomer && <Loader2 style={{ position: 'absolute', right: '10px', top: '30%', animation: 'spin 1s linear infinite', color: '#3b82f6' }} size={14} />}
                            </div>

                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid #f1f5f9', paddingLeft: '20px' }}>
                                <div style={{ minWidth: '130px', borderRight: '1px solid #f1f5f9', paddingRight: '16px' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Vendedor</p>
                                    <select 
                                        value={selectedSalesperson} 
                                        onChange={e => setSelectedSalesperson(e.target.value)}
                                        style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', fontWeight: 700, outline: 'none', color: '#1e293b' }}
                                    >
                                        {salespeople.map(v => <option key={v.id} value={v.id}>{v.name.trim()}</option>)}
                                    </select>
                                </div>

                                <div style={{ width: '120px', borderRight: '1px solid #f1f5f9', paddingRight: '16px' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Celular</p>
                                    <div style={{ position: 'relative' }}>
                                        <Phone size={10} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input 
                                            type="text" 
                                            placeholder="999..." 
                                            value={customer.phone}
                                            onChange={e => setCustomer({...customer, phone: e.target.value})}
                                            style={{ width: '100%', padding: '6px 8px 6px 24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', fontWeight: 700, outline: 'none' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ width: '140px', borderRight: '1px solid #f1f5f9', paddingRight: '16px' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>F. Nacimiento</p>
                                    <CustomDatePicker 
                                        value={customer.birthdate}
                                        onChange={(val) => setCustomer({...customer, birthdate: val})}
                                        compact={true}
                                    />
                                </div>

                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Cliente</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <p style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{customer.name}</p>
                                            <button onClick={() => setCustomer({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' })} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>Limpiar</button>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            {customer.ruc && <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b' }}>ID: {customer.ruc}</span>}
                                            {customer.phone && (
                                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Phone size={10} /> {customer.phone}
                                                </span>
                                            )}
                                            {customer.birthdate && (
                                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={10} /> {customer.birthdate}
                                                </span>
                                            )}
                                            
                                            {/* INFO DE MEMBRESÍA */}
                                            {customer.birthdate !== undefined && ( // Usamos una validación que siempre pase si el objeto cliente está cargado
                                                <>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: '#f1f5f9', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#475569' }}>VENCE:</span>
                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e293b' }}>
                                                            {customer.expirationDate ? new Date(customer.expirationDate).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                        {customer.expirationDate && (
                                                            <span style={{ 
                                                                fontSize: '9px', 
                                                                fontWeight: 900, 
                                                                padding: '1px 5px', 
                                                                borderRadius: '3px',
                                                                marginLeft: '4px',
                                                                background: (new Date(customer.expirationDate) > new Date()) ? '#dcfce7' : '#fee2e2',
                                                                color: (new Date(customer.expirationDate) > new Date()) ? '#166534' : '#991b1b'
                                                            }}>
                                                                {Math.ceil((new Date(customer.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))} DÍAS
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {customer.isNew && (
                                        <button onClick={registerCustomer} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <UserPlus size={14} /> Registrar
                                        </button>
                                    )}
                                    <button onClick={() => { setManualDoc(customerSearch); setShowManualModal(true); }} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ShieldCheck size={14} /> Menor
                                    </button>
                                </div>

                                <div style={{ borderLeft: '1px solid #f1f5f9', paddingLeft: '20px', marginLeft: 'auto', textAlign: 'right' }}>
                                    <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                        {selectedCategory === 'all' ? 'Todos' : categories.find(c => c.id === selectedCategory)?.name}
                                    </h2>
                                    <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, margin: 0 }}>{loading ? '...' : `${products.length} artículos`}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BARRA DE CATEGORÍAS */}
                    <div style={{ flexShrink: 0, background: '#f8fafc', padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="no-scrollbar">
                        {categories.map(cat => (
                            <button 
                                key={cat.id} 
                                onClick={() => setSelectedCategory(cat.id)}
                                style={{
                                    padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, border: 'none', cursor: 'pointer',
                                    background: selectedCategory === cat.id ? '#3b82f6' : '#fff',
                                    color: selectedCategory === cat.id ? '#fff' : '#64748b',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)', transition: 'all 0.2s'
                                }}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
                        {loading ? <div className="pos-grid">{Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ background: '#fff', borderRadius: '16px', height: '160px', border: '1px solid #e2e8f0', opacity: 0.5 }} />)}</div> : <div className="pos-grid">{products.map(p => <ProductCard key={p.id} product={p} onAdd={prod => { addToCart(prod); if(isMobile) setCartVisible(true); }} />)}</div>}
                    </div>
                </div>

                {/* PANEL LATERAL: TICKET ACTUAL */}
                <div className={`ticket-aside ${cartVisible ? 'visible' : ''}`} style={{ width: '360px', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, borderLeft: '1px solid #e2e8f0' }}>
                    <div style={{ padding: '24px 24px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: '#3b82f6', color: '#fff', borderRadius: '12px', padding: '8px' }}>
                                    <ShoppingCart size={20} />
                                </div>
                                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Ticket de Venta</h2>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setCart([])} style={{ background: '#fff1f2', border: 'none', color: '#ef4444', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                <button onClick={() => setShowCartModal(true)} style={{ background: '#eff6ff', border: 'none', color: '#3b82f6', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}><LayoutGrid size={18} /></button>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                        {cart.length === 0 ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><ShoppingCart size={40} style={{ color: '#94a3b8', marginBottom: '8px' }} /><p style={{ fontSize: '12px', fontWeight: 700 }}>Carrito vacío</p></div> : <AnimatePresence mode="popLayout">{cart.map(item => <CartItem key={item.id} item={item} onUpdateQty={updateQuantity} onRemove={removeFromCart} />)}</AnimatePresence>}
                    </div>

                    <PaymentSection total={total} availableMethods={availableMethods} paymentMethod={paymentMethod} selectedTar={selectedTar} onSetMethod={m => { setPaymentMethod(m.type); setSelectedTar(m.id === 'EF' ? '' : m.id); }} onFinalize={finalizeSale} loading={isFinalizing} cartEmpty={cart.length === 0} />
                </div>

                {/* COMPONENTE DE IMPRESIÓN OCULTO - 100% DINÁMICO */}
                {printData && (
                    <div id="print-ticket">
                        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                            {/* Nombre Dinámico de la Empresa */}
                            <div style={{ color: '#000', fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>
                                {companySettings?.company?.name || 'MI EMPRESA'}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>R.U.C.: {companySettings?.company?.ruc || '00000000000'}</div>
                            <div style={{ fontSize: '10px', margin: '2px 0' }}>{companySettings?.company?.address || ''}</div>
                            
                            {/* Nombre de la Tienda/Sucursal */}
                            <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase' }}>
                                SUCURSAL: {companySettings?.pointOfSale?.name || 'TIENDA'}
                            </div>
                            {companySettings?.company?.phone && <div style={{ fontSize: '10px' }}>Telf: {companySettings.company.phone}</div>}
                        </div>
                        
                        <div style={{ textAlign: 'center', margin: '12px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '6px 0' }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold' }}>
                                {printData.docType === '01' ? 'FACTURA ELECTRÓNICA' : printData.docType === '03' ? 'BOLETA DE VENTA' : 'NOTA DE VENTA'}
                            </p>
                            <p style={{ margin: '2px 0', fontSize: '13px', fontWeight: 'bold' }}>Nº {printData.documentNumber}</p>
                        </div>

                        <div style={{ marginBottom: '10px', fontSize: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr' }}>
                                <span>FECHA</span><span>: {new Date(printData.date).toLocaleDateString()}</span>
                                {printData.docType === '65' && (
                                    <>
                                        <span>HORA</span><span>: {new Date(printData.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                    </>
                                )}
                                <span>VENDEDOR</span><span>: {printData.salesperson?.toUpperCase()}</span>
                                <span>{printData.docType === '65' ? 'CONDIC.' : 'COND.VTA'}</span><span>: EFECTIVO</span>
                                {printData.docType === '01' && (
                                    <>
                                        <span>DOC. IDE.</span><span>: R.U.C. {printData.customer.ruc}</span>
                                    </>
                                )}
                                <span>{printData.docType === '65' ? 'SEÑOR' : 'CLIENTE'}</span><span>: {printData.customer.name.toUpperCase()}</span>
                                {printData.docType === '65' && (
                                    <>
                                        <span>DIREC.</span><span>: </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                            <thead>
                                <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                                    <th style={{ textAlign: 'left', fontSize: '10px', padding: '5px 0' }}>CANT.</th>
                                    {printData.docType === '65' && <th style={{ textAlign: 'left', fontSize: '10px' }}>U.M.</th>}
                                    <th style={{ textAlign: 'left', fontSize: '10px' }}>DESCRIPCIÓN</th>
                                    {printData.docType === '65' && <th style={{ textAlign: 'right', fontSize: '10px' }}>P.UNIT.</th>}
                                    <th style={{ textAlign: 'right', fontSize: '10px' }}>TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {printData.items.map((item, idx) => (
                                    <tr key={idx} style={{ verticalAlign: 'top' }}>
                                        <td style={{ fontSize: '10px', padding: '5px 0' }}>{item.quantity.toFixed(2)}</td>
                                        {printData.docType === '65' && <td style={{ fontSize: '10px', padding: '5px 0' }}>UND</td>}
                                        <td style={{ fontSize: '10px', padding: '5px 2px' }}>{item.name.toUpperCase()}</td>
                                        {printData.docType === '65' && <td style={{ textAlign: 'right', fontSize: '10px', padding: '5px 0' }}>{item.price.toFixed(2)}</td>}
                                        <td style={{ textAlign: 'right', fontSize: '10px', padding: '5px 0' }}>{(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>
                            {printData.docType !== '65' ? (
                                <div style={{ fontSize: '10px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 80px', gap: '4px' }}>
                                        <span style={{ textAlign: 'right' }}>Total Gravado</span><span>S/:</span><span style={{ textAlign: 'right' }}>{(printData.total / 1.18).toFixed(2)}</span>
                                        <span style={{ textAlign: 'right' }}>Total Inafecto</span><span>S/:</span><span style={{ textAlign: 'right' }}>0.00</span>
                                        <span style={{ textAlign: 'right' }}>Exonerado</span><span>S/:</span><span style={{ textAlign: 'right' }}>0.00</span>
                                        <span style={{ textAlign: 'right' }}>I.G.V.</span><span>S/:</span><span style={{ textAlign: 'right' }}>{(printData.total - (printData.total / 1.18)).toFixed(2)}</span>
                                        <span style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>TOTAL</span><span style={{ fontWeight: 'bold', fontSize: '12px' }}>S/:</span><span style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{printData.total.toFixed(2)}</span>
                                    </div>
                                    <p style={{ fontSize: '9px', marginTop: '10px', fontWeight: 'bold' }}>
                                        SON : {numeroALetras(printData.total)}
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 80px', fontSize: '12px', fontWeight: 'bold' }}>
                                    <span>TOTAL</span><span>S/:</span><span style={{ textAlign: 'right' }}>{printData.total.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                        
                        {printData.docType !== '65' && (
                            <div style={{ marginTop: '15px', borderTop: '1px solid #000', paddingTop: '10px', textAlign: 'center' }}>
                                <p style={{ fontSize: '9px', margin: '2px 0' }}>STATUS: &lt;REIMPRESION&gt;</p>
                                <p style={{ fontSize: '9px', margin: '2px 0' }}>FECHA IMPRESION: {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', textAlign: 'left' }}>
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(printData.documentNumber)}`} 
                                        alt="QR" 
                                        style={{ width: '70px', height: '70px' }}
                                    />
                                    <div style={{ fontSize: '8px', lineHeight: '1.2' }}>
                                        Representación impresa de {printData.docType === '01' ? 'Factura' : 'Boleta'} Electrónica. 
                                        Podrá ser consultada en https://www.prolineapp.pe
                                    </div>
                                </div>
                                <p style={{ fontSize: '8px', marginTop: '10px' }}>Autorizado por resolución N°287-2017/SUNAT</p>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '15px' }}>
                            <p style={{ fontSize: '10px' }}>{printData.docType === '65' ? '¡ Gracias por su preferencia !' : '¡Gracias por su compra!'}</p>
                        </div>
                    </div>
                )}

                {orderSuccess && (
                    <SuccessModal 
                        orderNumber={orderSuccess} 
                        onReset={() => setOrderSuccess(null)} 
                        onPrint={() => window.print()} 
                    />
                )}
                
                <CustomerManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} initialDoc={manualDoc} onSave={handleSaveInternal} />
                <SalesHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} idApeCaj={idApeCaj} onPrint={handlePrint} />
                <CloseCashModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} idApeCaj={idApeCaj} onConfirm={() => signOut({ callbackUrl: '/auth/signin' })} />
                <CartDetailsModal isOpen={showCartModal} onClose={() => setShowCartModal(false)} items={cart} onUpdateQty={updateQuantity} onRemove={removeFromCart} onClear={() => { setCart([]); setShowCartModal(false); }} total={total} />
            </div>
        </>
    );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useSession, signOut } from 'next-auth/react';
import {
    Search, ShoppingCart, User, Plus, Minus, X, Check,
    ChevronRight, Loader2, UserPlus, ShieldCheck, Trash2,
    LayoutGrid, Clock, Settings, LogOut, ShoppingBag, Zap, Sparkles, Package,
    Lock, Phone, Users, ArrowRight, Receipt, Percent, Calculator, 
    BellRing, Smartphone, RefreshCw, AlertCircle, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

import Sidebar from '@/components/pos/Sidebar';
import ProductCard from '@/components/pos/ProductCard';
import CartItem from '@/components/pos/CartItem';
import QuickModal from '@/components/pos/QuickModal';
import PaymentSection from '@/components/pos/PaymentSection';
import SuccessModal from '@/components/pos/SuccessModal';
import CustomerManualModal from '@/components/pos/CustomerManualModal';
import CustomerErpModal from '@/components/pos/CustomerErpModal';
import CustomDatePicker from '@/components/pos/CustomDatePicker';
import CartDetailsModal from '@/components/pos/CartDetailsModal';
import SalesHistoryModal from '@/components/pos/SalesHistoryModal';
import CloseCashModal from '@/components/pos/CloseCashModal';
import MembershipsView from '@/components/pos/MembershipsView';
import WhatsappView from '@/components/pos/WhatsappView';
import SettingsModal from '@/components/pos/SettingsModal';
import CashExpenseModal from '@/components/pos/CashExpenseModal';
import NumericKeypad from '@/components/pos/NumericKeypad';
import CustomSelect from '@/components/pos/CustomSelect';

export default function POSPage() {
    const { data: session } = useSession();
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [activeTab, setActiveTab] = useState('pos'); // 'pos' o 'memberships'
    
    // SISTEMA DE COLA DE WHATSAPP (ASÍNCRONO)
    const [waQueue, setWaQueue] = useState([]); // {id, phone, message, media_url, status, error}
    const [isProcessingWa, setIsProcessingWa] = useState(false);
    const [showWaAlerts, setShowWaAlerts] = useState(false);
    const [posLogo, setPosLogo] = useState('logocia01.jpg');
    const [companySettings, setCompanySettings] = useState(null);

    useEffect(() => {
        if (companySettings?.company?.logo) {
            setPosLogo(companySettings.company.logo);
        } else if (session?.user?.company) {
            const dbCode = session.user.company.replace('BdNava', '').padStart(2, '0') || '01';
            setPosLogo(`logocia${dbCode}.jpg`);
        }
    }, [companySettings, session]);

    const addToWaQueue = (phone, message, media_url) => {
        const newMsg = {
            id: Date.now() + Math.random(),
            phone,
            message,
            media_url,
            status: 'PENDIENTE',
            createdAt: new Date()
        };
        setWaQueue(prev => [...prev, newMsg]);
    };

    // Procesador de Cola
    useEffect(() => {
        const processNext = async () => {
            const next = waQueue.find(m => m.status === 'PENDIENTE');
            if (!next || isProcessingWa) return;

            setIsProcessingWa(true);
            setWaQueue(prev => prev.map(m => m.id === next.id ? { ...m, status: 'ENVIANDO' } : m));

            try {
                const res = await fetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        phone: next.phone, 
                        message: next.message, 
                        media_url: next.media_url 
                    })
                });
                const data = await res.json();
                
                if (data.success) {
                    setWaQueue(prev => prev.filter(m => m.id !== next.id));
                } else {
                    throw new Error(data.error || 'Fallo de entrega');
                }
            } catch (err) {
                setWaQueue(prev => prev.map(m => m.id === next.id ? { ...m, status: 'ERROR', error: err.message } : m));
            } finally {
                setIsProcessingWa(false);
            }
        };

        processNext();
    }, [waQueue, isProcessingWa]);
    const [cart, setCart] = useState([]);
    const [warehouse, setWarehouse] = useState(session?.sedeId || '01');
    const [idApeCaj, setIdApeCaj] = useState(null);
    const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info', value: '', showButtons: true, onConfirm: () => { } });
    const [isOpeningCash, setIsOpeningCash] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');
    const [docType, setDocType] = useState('65'); // Nota de Venta por defecto
    const [paymentMethod, setPaymentMethod] = useState(1);
    const [selectedTar, setSelectedTar] = useState('');
    const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    };

    const [payments, setPayments] = useState([]);
    const [membershipStartDate, setMembershipStartDate] = useState(null);
    const [isRegularizing, setIsRegularizing] = useState(false);
    const [availableMethods, setAvailableMethods] = useState([]);
    const [customer, setCustomer] = useState({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' });
    const [customerSearch, setCustomerSearch] = useState('');
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [printData, setPrintData] = useState(null);
    const [cashReportData, setCashReportData] = useState(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [showManualModal, setShowManualModal] = useState(false);
    const [showCartModal, setShowCartModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showErpModal, setShowErpModal] = useState(false);
    const [erpModalData, setErpModalData] = useState(null);
    const [searchType, setSearchType] = useState('DNI'); // 'DNI' o 'RUC'
    const [manualDoc, setManualDoc] = useState('');
    const [orderSuccess, setOrderSuccess] = useState(null);
    const [exchangeRate, setExchangeRate] = useState(1);
    const [mounted, setMounted] = useState(false);
    const [showNumpad, setShowNumpad] = useState(false);
    const [showPhoneNumpad, setShowPhoneNumpad] = useState(false);
    const [categories, setCategories] = useState([
        { id: 'all', name: 'Todos', icon: LayoutGrid }
    ]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [cartVisible, setCartVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [salespeople, setSalespeople] = useState([]);
    const [selectedSalesperson, setSelectedSalesperson] = useState('');
    const [lastMembershipInfo, setLastMembershipInfo] = useState(null);
    const [showMixed, setShowMixed] = useState(false);
    const [cashReceived, setCashReceived] = useState('');

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
            if (settingsData) {
                setCompanySettings(settingsData);
                if (settingsData.pointOfSale?.code) setWarehouse(settingsData.pointOfSale.code);
            }
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

        if (session?.sedeId) setWarehouse(session.sedeId);

        return () => window.removeEventListener('resize', checkSize);
    }, [session]);

    useEffect(() => {
        if (activeTab === 'pos') {
            const t = setTimeout(() => fetchProducts(), 250);
            return () => clearTimeout(t);
        }
    }, [searchTerm, selectedCategory, activeTab, warehouse]);

    // Generar QR para impresión cuando cambian los datos del ticket
    useEffect(() => {
        const generateQR = async () => {
            if (printData && printData.documentNumber) {
                try {
                    const rucEmisor = companySettings?.company?.ruc || "";
                    const [serie, correlativo] = printData.documentNumber.split('-');
                    const tipoDocCli = (printData.customer?.ruc?.length === 11) ? "6" : "1";

                    // Formato SUNAT: RUC Emisor | Tipo Doc | Serie | Correlativo | IGV | Total | Fecha | Tipo Doc Cli | RUC Cli | Hash |
                    const qrString = `${rucEmisor}|${printData.docType}|${serie}|${correlativo}|${Number(printData.igv || 0).toFixed(2)}|${Number(printData.total || 0).toFixed(2)}|${printData.date?.split(',')[0].split('/').reverse().join('-')}|${tipoDocCli}|${printData.customer?.ruc || '00000000'}|${printData.hash || ''}|`;

                    const url = await QRCode.toDataURL(qrString, { margin: 1, width: 200 });
                    setQrCodeUrl(url);
                } catch (err) {
                    console.error('Error generating QR for print:', err);
                }
            }
        };
        generateQR();
    }, [printData, companySettings]);

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

    const handleCustomerSearch = async (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setCustomerSearch(val);

        const targetLength = searchType === 'DNI' ? 8 : 11;

        if (val.length === 11) setDocType('01');
        if (val.length === targetLength) {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/customers/search?q=${val}`);
                const { data } = await res.json();
                if (data) {
                    if (data.isNew && data.source === 'EXTERNAL') {
                        setErpModalData({
                            ruc: data.ruccli,
                            name: data.nomcli,
                            address: data.address,
                            phone: data.phone || '',
                            birthdate: data.birthdate || ''
                        });
                        setShowErpModal(true);
                    } else {
                        setCustomer({
                            name: data.nomcli,
                            ruc: data.ruccli || data.nrodni,
                            code: data.codcli,
                            address: data.address,
                            phone: data.phone || '',
                            birthdate: data.birthdate || '',
                            expirationDate: data.fecfinpres,
                            daysRemaining: data.daysRemaining,
                            isNew: data.isNew
                        });
                    }
                } else {
                    setManualDoc(val);
                    setCustomer({ name: 'NO ENCONTRADO', ruc: val, code: 'MANUAL', isNew: true, phone: '', birthdate: '' });
                }
            } catch (err) { console.error('Error searching customer', err); }
            finally { setIsSearchingCustomer(false); }
        }
    };

    const handleNumpadKeyPress = (key) => {
        setCustomerSearch(prev => {
            const limit = searchType === 'DNI' ? 8 : 11;
            const newVal = (prev + key).slice(0, limit);
            if (newVal.length === limit) {
                setTimeout(() => setShowNumpad(false), 100);
            }
            if (newVal.length >= 8) {
                setTimeout(() => {
                    const e = { target: { value: newVal } };
                    handleCustomerSearch(e);
                }, 10);
            }
            return newVal;
        });
    };

    const handleNumpadDelete = () => {
        setCustomerSearch(prev => {
            const newVal = prev.slice(0, -1);
            if (newVal.length >= 8) {
                setTimeout(() => {
                    const e = { target: { value: newVal } };
                    handleCustomerSearch(e);
                }, 10);
            }
            return newVal;
        });
    };

    const handlePhoneNumpadKeyPress = (key) => {
        setCustomer(prev => {
            const newVal = ((prev.phone || '') + key).slice(0, 9);
            if (newVal.length === 9) {
                setTimeout(() => setShowPhoneNumpad(false), 100);
            }
            return { ...prev, phone: newVal };
        });
    };

    const handlePhoneNumpadDelete = () => {
        setCustomer(prev => {
            const newVal = (prev.phone || '').slice(0, -1);
            return { ...prev, phone: newVal };
        });
    };

    const addToCart = (product) => {
        // Excepción para el ítem de descuento DS00
        if (product.userCode === 'DS00') {
            setCart(prev => {
                const ex = prev.find(i => i.id === product.id);
                if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
                return [...prev, { ...product, quantity: 1 }];
            });
            return;
        }

        if (product.stock <= 0) {
            showAlert('Sin Stock', `El producto ${product.name} no tiene stock disponible (Actual: ${product.stock}).`, 'warning');
            return;
        }

        setCart(prev => {
            const ex = prev.find(i => i.id === product.id);
            if (ex) {
                if (ex.quantity >= product.stock) {
                    showAlert('Límite de Stock', `No puedes agregar más de ${product.stock} unidades de este producto.`, 'warning');
                    return prev;
                }
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (id, delta) =>
        setCart(prev => prev.map(i => {
            if (i.id === id) {
                const newQty = i.quantity + delta;
                if (delta > 0 && i.userCode !== 'DS00' && newQty > i.stock) {
                    showAlert('Límite de Stock', `Solo hay ${i.stock} unidades disponibles.`, 'warning');
                    return i;
                }
                return { ...i, quantity: Math.max(0.01, newQty) };
            }
            return i;
        }));

    const updatePrice = (id, newPrice) =>
        setCart(prev => prev.map(i => i.id === id ? { ...i, price: Math.max(0, newPrice) } : i));

    const applyGlobalDiscount = async () => {
        try {
            const res = await fetch('/api/products/discount-check');
            const data = await res.json();

            if (!data.exists) {
                showAlert('DS00 No Encontrado', 'El ítem de descuento (DS00) no existe en el ERP. Por favor créalo para poder aplicar descuentos.', 'warning');
                return;
            }

            const discountProd = data.product;

            setModal({
                show: true,
                title: 'Descuento Global (S/)',
                message: `Ingrese el monto total a descontar de la venta (Total actual: S/ ${total.toFixed(2)}):`,
                type: 'prompt',
                value: '0',
                onConfirm: (val) => {
                    const discountAmount = parseFloat(val);
                    if (!isNaN(discountAmount) && discountAmount > 0 && discountAmount < total) {
                        setCart(prev => {
                            // Buscar si ya existe un ítem de descuento
                            const existingIndex = prev.findIndex(i => i.userCode === 'DS00');
                            
                            if (existingIndex > -1) {
                                // Actualizar el descuento existente
                                const newCart = [...prev];
                                newCart[existingIndex] = {
                                    ...newCart[existingIndex],
                                    price: -discountAmount
                                };
                                return newCart;
                            } else {
                                // Agregar nuevo ítem de descuento
                                return [...prev, {
                                    ...discountProd,
                                    price: -discountAmount,
                                    quantity: 1,
                                    name: '** DESCUENTO **'
                                }];
                            }
                        });
                        showAlert('Descuento Aplicado', `Se ha aplicado un descuento de S/ ${discountAmount.toFixed(2)} al ticket.`, 'success');
                    } else if (discountAmount >= total) {
                        showAlert('Monto Inválido', 'El descuento no puede ser mayor o igual al total de la venta.', 'warning');
                    }
                    setModal(prev => ({ ...prev, show: false }));
                }
            });
        } catch (err) {
            console.error('Error in applyGlobalDiscount:', err);
            showAlert('Error', 'No se pudo verificar el ítem de descuento en el servidor.', 'error');
        }
    };

    const showAlert = (title, message, type = 'info', showButtons = true) => {
        setModal({ show: true, title, message, type, value: '', showButtons, onConfirm: () => setModal(prev => ({ ...prev, show: false })) });
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

    const registerCustomer = () => setShowManualModal(true);

    const handleOpenCash = async () => {
        if (!openingAmount) return;
        setIsOpeningCash(true);
        try {
            const res = await fetch('/api/cash/open', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(openingAmount) })
            });
            const data = await res.json();
            if (data.success) {
                setIdApeCaj(data.id);
                // Mostrar alerta sin botones que se cierra sola en 1.5s
                showAlert('Caja Abierta', 'La sesión de caja se inició correctamente.', 'success', false);
                setTimeout(() => {
                    setModal(prev => ({ ...prev, show: false }));
                }, 1500);
            } else {
                showAlert('Error', 'No se pudo abrir la caja.', 'error');
            }
        } catch { showAlert('Error', 'Error de conexión con el servidor.', 'error'); }
        finally { setIsOpeningCash(false); }
    };

    const handlePrint = (data) => {
        // Si recibimos datos nuevos (desde historial), los guardamos
        // Si es un evento (desde el botón), usamos lo que ya está en printData
        if (data && data.customer) {
            setPrintData(data);
        }

        setCashReportData(null); // Asegurar que no se imprima el reporte de caja
        setTimeout(() => window.print(), 500);
    };

    const handlePrintCashReport = (report) => {
        setPrintData(null); // Asegurar que no se imprima una boleta
        setCashReportData(report);
        setTimeout(() => window.print(), 500);
    };

    const handleRenew = (member, plan) => {
        // 1. Limpiar carrito y añadir el plan seleccionado
        setCart([{ ...plan, quantity: 1 }]);

        // 2. Establecer el cliente de la membresía
        setCustomer({
            name: member.name,
            ruc: member.ruc || member.phone || '',
            code: member.id || member.codcli,
            phone: member.phone || '',
            isNew: false
        });

        // 3. Cambiar a la pestaña POS y abrir el modal de pago
        setActiveTab('pos');
        setShowCartModal(true);
    };

    const handleFinalizeSale = async (paymentInfo = {}) => {
        if (!cart.length || !idApeCaj) return;

        // Validación Fiscal: Factura requiere RUC
        if (docType === '01') {
            const ruc = customer.ruc?.trim() || '';
            if (customer.code === '000000' || ruc.length !== 11) {
                showAlert('RUC Obligatorio', 'Para emitir una Factura es necesario un cliente con RUC válido (11 dígitos). No se permite "Clientes Varios" ni DNI.', 'warning');
                return;
            }
        }

        setIsFinalizing(true);
        try {
            const { cashReceived, changeGiven, isMixed } = paymentInfo;
            const res = await fetch('/api/sales/finalize', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType, pointOfSale: '01',
                    isMixed,
                    codcli: customer.code === 'MANUAL' ? '000000' : customer.code,
                    nomcli: customer.name,
                    ruccli: customer.ruc,
                    phone: customer.phone,
                    birthdate: customer.birthdate,
                    items: cart,
                    idApeCaj,
                    payments: payments.length > 0 ? payments : [{
                        id: selectedTar || 'EF',
                        type: paymentMethod,
                        amount: total,
                        name: paymentMethod === 1 ? 'EFECTIVO' : (availableMethods.find(m => m.id === selectedTar)?.name || 'TARJETA')
                    }],
                    warehouse,
                    codven: selectedSalesperson,
                    exchangeRate,
                    cashReceived: cashReceived || total,
                    changeGiven: changeGiven || 0,
                    customStartDate: isRegularizing && membershipStartDate ? membershipStartDate : null
                })
            });
            const result = await res.json();
            if (result.success) {
                const newPrintData = {
                    documentNumber: result.ndocu,
                    docType,
                    customer: { name: customer.name, ruc: customer.ruc, phone: customer.phone },
                    items: [...cart],
                    total: result.total || total,
                    base: result.base,
                    igv: result.igv,
                    date: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                    salesperson: selectedSalesperson
                };
                setPrintData(newPrintData);
                setLastMembershipInfo(result.membershipInfo);
                setOrderSuccess(result.ndocu);
                setCart([]);
                setSearchTerm('');
                setCustomerSearch('');
                setCustomer({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' });
                setPayments([]); // Limpiar pagos mixtos
                setMembershipStartDate(null);
                setIsRegularizing(false);
                setDocType('65'); // Volver a Nota por defecto
                setPaymentMethod(1); // Volver a Efectivo por defecto
                setSelectedTar(''); // Limpiar tarjeta seleccionada
                setShowMixed(false); // Regresar a Pago Simple
                setCashReceived(''); // Limpiar efectivo recibido
                setSearchType('DNI'); // Regresar a DNI por defecto
            } else {
                showAlert('Error', result.error || 'No se pudo procesar la venta.', 'error');
            }
        } catch (err) { showAlert('Error', 'Ocurrió un error crítico al procesar la venta.', 'error'); }
        finally { setIsFinalizing(false); }
    };

    const total = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

    if (!mounted) return null;

    if (!idApeCaj) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                {/* Decoración de fondo */}
                <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '400px', height: '400px', background: 'rgba(59, 130, 246, 0.05)', filter: 'blur(80px)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '400px', height: '400px', background: 'rgba(139, 92, 246, 0.05)', filter: 'blur(80px)', borderRadius: '50%' }} />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'rgba(255, 255, 255, 1)',
                        borderRadius: '32px',
                        padding: '48px',
                        width: '100%',
                        maxWidth: '440px',
                        textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        zIndex: 10
                    }}
                >
                    <div style={{
                        width: '80px', height: '80px', background: '#f8fafc', borderRadius: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px', color: '#3b82f6',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                        <Lock size={40} strokeWidth={1.5} />
                    </div>

                    <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                        Apertura de Caja
                    </h1>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', fontWeight: 500 }}>
                        Ingrese el monto inicial para comenzar la jornada
                    </p>

                    <div style={{ position: 'relative', marginBottom: '24px' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 800, fontSize: '18px' }}>
                            S/
                        </div>
                        <input
                            type="number"
                            value={openingAmount}
                            onChange={e => setOpeningAmount(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '18px 20px 18px 45px',
                                borderRadius: '16px',
                                border: '2px solid #f1f5f9',
                                fontSize: '22px',
                                fontWeight: 800,
                                color: '#0f172a',
                                outline: 'none',
                                transition: 'all 0.2s',
                                background: '#f8fafc'
                            }}
                            placeholder="0.00"
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#f1f5f9'}
                        />
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleOpenCash}
                        disabled={isOpeningCash}
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: '#fff',
                            padding: '18px',
                            borderRadius: '16px',
                            border: 'none',
                            fontSize: '16px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                        }}
                    >
                        {isOpeningCash ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                Comenzar Jornada
                                <ArrowRight size={20} />
                            </>
                        )}
                    </motion.button>

                    <p style={{ marginTop: '32px', fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Dato.Click POS • Sistema Seguro
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#f1f5f9', overflow: 'hidden' }}>
            <Sidebar
                onSignOut={() => signOut()}
                onOpenCloseCash={() => setShowCloseModal(true)}
                onOpenHistory={() => setShowHistoryModal(true)}
                onOpenSettings={() => setShowSettingsModal(true)}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                    {activeTab === 'pos' && (
                        <motion.div
                            key="pos" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                            style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
                        >
                            {/* AREA DE VENTAS */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

                                {/* LÍNEA 1: DATOS DE LA EMPRESA / SEDE (NUEVA) */}
                                <div style={{ background: '#fff', padding: '16px 24px', minHeight: '80px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ background: '#eff6ff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                                            <p style={{ fontSize: '10px', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Sede Activa</p>
                                        </div>
                                        <div>
                                            <h1 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {companySettings?.company?.legalName || companySettings?.company?.name || 'Cargando sede...'}
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>• R.U.C. {companySettings?.company?.ruc || ''}</span>
                                            </h1>
                                            <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', margin: 0 }}>
                                                {companySettings?.company?.address || 'Dirección no configurada'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                        {/* MONITOR DE WHATSAPP */}
                                        {(waQueue.length > 0 || isProcessingWa) && (
                                            <div style={{ position: 'relative' }}>
                                                <motion.button 
                                                    animate={waQueue.some(m => m.status === 'ERROR') ? { scale: [1, 1.1, 1] } : {}}
                                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                                    onClick={() => setShowWaAlerts(!showWaAlerts)}
                                                    style={{
                                                        background: waQueue.some(m => m.status === 'ERROR') ? '#fef2f2' : '#f0f9ff',
                                                        border: `1px solid ${waQueue.some(m => m.status === 'ERROR') ? '#fecaca' : '#bae6fd'}`,
                                                        borderRadius: '10px', padding: '8px', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '8px', color: waQueue.some(m => m.status === 'ERROR') ? '#ef4444' : '#0ea5e9'
                                                    }}
                                                >
                                                    {isProcessingWa ? <RefreshCw size={14} className="animate-spin" /> : <Smartphone size={14} />}
                                                    <span style={{ fontSize: '11px', fontWeight: 900 }}>
                                                        {waQueue.filter(m => m.status === 'ERROR').length > 0 
                                                            ? `${waQueue.filter(m => m.status === 'ERROR').length} ERROR` 
                                                            : (isProcessingWa ? 'ENVIANDO...' : 'PENDIENTE')}
                                                    </span>
                                                </motion.button>

                                                <AnimatePresence>
                                                    {showWaAlerts && (
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            style={{
                                                                position: 'absolute', top: '100%', right: 0, marginTop: '12px',
                                                                width: '320px', background: '#fff', borderRadius: '16px',
                                                                boxShadow: '0 20px 50px rgba(0,0,0,0.15)', zIndex: 1000,
                                                                border: '1px solid #f1f5f9', overflow: 'hidden'
                                                            }}
                                                        >
                                                            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569' }}>COLA DE WHATSAPP</span>
                                                                <button onClick={() => setWaQueue([])} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>Limpiar todo</button>
                                                            </div>
                                                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                                {waQueue.map(m => (
                                                                    <div key={m.id} style={{ padding: '12px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <div>
                                                                            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700 }}>{m.phone}</p>
                                                                            <p style={{ margin: 0, fontSize: '10px', color: m.status === 'ERROR' ? '#ef4444' : '#64748b' }}>
                                                                                {m.status === 'ERROR' ? `Error: ${m.error}` : 'Enviando mensaje...'}
                                                                            </p>
                                                                        </div>
                                                                        {m.status === 'ERROR' && (
                                                                            <button 
                                                                                onClick={() => setWaQueue(prev => prev.map(msg => msg.id === m.id ? {...msg, status: 'PENDIENTE'} : msg))}
                                                                                style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}
                                                                            >
                                                                                Reintentar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>Tipo Cambio</p>
                                            <p style={{ fontSize: '12px', fontWeight: 900, color: '#3b82f6', margin: 0 }}>S/ {Number(exchangeRate || 1).toFixed(3)}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>Terminal</p>
                                            <p style={{ fontSize: '12px', fontWeight: 900, color: '#1e293b', margin: 0 }}>{session?.user?.sedeId || '01'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* LÍNEA 2: BARRA CLIENTE POS (PROFESIONAL) */}
                                <div style={{ background: '#fff', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>

                                    {/* Selector de Tipo DNI/RUC */}
                                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', gap: '2px', border: '1px solid #e2e8f0' }}>
                                        {['DNI', 'RUC'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setSearchType(type);
                                                    setCustomerSearch('');
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '11px',
                                                    fontWeight: 800,
                                                    background: searchType === type ? '#fff' : 'transparent',
                                                    color: searchType === type ? '#3b82f6' : '#64748b',
                                                    boxShadow: searchType === type ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ width: '200px', position: 'relative' }}>
                                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={14} />
                                        <input
                                            type="text"
                                            inputMode="none" // Evita el teclado nativo en tablets
                                            placeholder={searchType === 'DNI' ? "8 dígitos..." : "11 dígitos..."}
                                            value={customerSearch}
                                            onFocus={() => setShowNumpad(true)}
                                            onChange={handleCustomerSearch}
                                            maxLength={searchType === 'DNI' ? 8 : 11}
                                            style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', fontWeight: 700, outline: 'none' }}
                                        />
                                        {isSearchingCustomer && <Loader2 style={{ position: 'absolute', right: '10px', top: '30%', animation: 'spin 1s linear infinite', color: '#3b82f6' }} size={14} />}
                                        <NumericKeypad 
                                            isOpen={showNumpad} 
                                            onClose={() => setShowNumpad(false)} 
                                            onKeyPress={handleNumpadKeyPress} 
                                            onDelete={handleNumpadDelete} 
                                            value={customerSearch}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            setCustomerSearch('');
                                            setCustomer({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' });
                                        }}
                                        style={{ background: '#fff1f2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Limpiar Cliente"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => setShowManualModal(true)}
                                        style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Registro Manual"
                                    >
                                        <Plus size={18} />
                                    </button>

                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid #f1f5f9', paddingLeft: '20px' }}>

                                        <div style={{ width: '120px', borderRight: '1px solid #f1f5f9', paddingRight: '16px' }}>
                                            <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Celular</p>
                                            <div style={{ position: 'relative' }}>
                                                <Phone size={10} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                <input
                                                    type="text"
                                                    inputMode="none"
                                                    placeholder="999..."
                                                    value={customer.phone || ''}
                                                    onFocus={() => setShowPhoneNumpad(true)}
                                                    onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                                                    maxLength={9}
                                                    style={{ width: '100%', padding: '6px 8px 6px 24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', fontWeight: 700, outline: 'none' }}
                                                />
                                                <NumericKeypad 
                                                    isOpen={showPhoneNumpad} 
                                                    onClose={() => setShowPhoneNumpad(false)} 
                                                    onKeyPress={handlePhoneNumpadKeyPress} 
                                                    onDelete={handlePhoneNumpadDelete} 
                                                    value={customer.phone || ''}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ width: '140px', borderRight: '1px solid #f1f5f9', paddingRight: '16px' }}>
                                            <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>F. Nacimiento</p>
                                            <CustomDatePicker
                                                value={customer.birthdate}
                                                onChange={(val) => setCustomer({ ...customer, birthdate: val })}
                                                compact={true}
                                            />
                                        </div>

                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                            <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Cliente</p>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <p style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', margin: 0 }}>{customer.name}</p>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {customer.expirationDate && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: customer.daysRemaining > 0 ? '#10b981' : '#ef4444' }}>
                                                            <Clock size={10} />
                                                            Vence: {new Date(customer.expirationDate).toLocaleDateString()} ({customer.daysRemaining}d)
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* BARRA SUPERIOR POS (AHORA SEGUNDO) */}
                                <div style={{ background: '#fff', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input type="text" placeholder="Busca productos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }} />
                                    </div>
                                    <div style={{ minWidth: '240px' }}>
                                        <CustomSelect
                                            value={selectedSalesperson}
                                            onChange={(val) => setSelectedSalesperson(val)}
                                            options={salespeople.map(v => ({ value: v.id, label: `VENDEDOR: ${v.name.trim()}` }))}
                                            placeholder="Seleccionar Vendedor"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '4px' }}>
                                        {['03', '01', '65'].map(t => (
                                            <button key={t} onClick={() => setDocType(t)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, background: docType === t ? '#fff' : 'transparent', color: docType === t ? '#3b82f6' : '#64748b' }}>
                                                {t === '03' ? 'Boleta' : t === '01' ? 'Factura' : 'Nota'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* BARRA DE CATEGORÍAS RESTAURADA (AHORA TERCERO) */}
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

                                {/* GRID PRODUCTOS */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                                    {loading ? <p>Cargando...</p> : (products || []).map(p => <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />)}
                                </div>
                            </div>

                            {/* CARRITO POS */}
                            <div style={{ width: '360px', background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '16px 24px', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: '#3b82f6', color: '#fff', borderRadius: '12px', padding: '8px' }}>
                                            <ShoppingCart size={20} />
                                        </div>
                                        <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Ticket ({(cart || []).length})</h2>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            disabled={cart.length === 0}
                                            onClick={applyGlobalDiscount} 
                                            style={{ 
                                                background: '#f0fdf4', border: 'none', color: '#16a34a', borderRadius: '10px', padding: '8px', 
                                                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                                                opacity: cart.length === 0 ? 0.5 : 1
                                            }} 
                                            title="Descuento Global"
                                        >
                                            <Percent size={18} />
                                        </button>
                                        <button 
                                            disabled={cart.length === 0}
                                            onClick={() => setCart([])} 
                                            style={{ 
                                                background: '#fff1f2', border: 'none', color: '#ef4444', borderRadius: '10px', padding: '8px', 
                                                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                                                opacity: cart.length === 0 ? 0.5 : 1
                                            }} 
                                            title="Vaciar Carrito"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button onClick={() => setShowCartModal(true)} style={{ background: '#eff6ff', border: 'none', color: '#3b82f6', borderRadius: '10px', padding: '8px', cursor: 'pointer' }} title="Ver Categorías"><LayoutGrid size={18} /></button>
                                    </div>
                                </div>

                                {/* OPCIÓN DE FECHA DE INICIO (REGULARIZACIÓN) */}
                                <div style={{ 
                                    padding: '12px 16px', 
                                    background: isRegularizing ? '#fffbeb' : '#fff', 
                                    borderBottom: '1px solid #f1f5f9',
                                    transition: 'all 0.3s'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={16} color={isRegularizing ? '#d97706' : '#94a3b8'} />
                                            <span style={{ fontSize: '11px', fontWeight: 800, color: isRegularizing ? '#92400e' : '#64748b' }}>
                                                INICIO PERSONALIZADO
                                            </span>
                                        </div>
                                        <div 
                                            onClick={() => {
                                                setIsRegularizing(!isRegularizing);
                                                if (!membershipStartDate) setMembershipStartDate(formatDate(new Date()));
                                            }}
                                            style={{
                                                width: '36px', height: '18px', borderRadius: '18px',
                                                background: isRegularizing ? '#d97706' : '#e2e8f0',
                                                padding: '2px', cursor: 'pointer', display: 'flex',
                                                alignItems: 'center', justifyContent: isRegularizing ? 'flex-end' : 'flex-start'
                                            }}
                                        >
                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#fff' }} />
                                        </div>
                                    </div>
                                    
                                    {isRegularizing && (
                                        <div style={{ marginTop: '10px' }}>
                                            <p style={{ fontSize: '10px', color: '#b45309', marginBottom: '6px', fontWeight: 700 }}>
                                                * La membresía iniciará el:
                                            </p>
                                            <CustomDatePicker 
                                                value={membershipStartDate || formatDate(new Date())} 
                                                onChange={setMembershipStartDate}
                                                compact={true}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                                    {(cart || []).map(item => (
                                        <CartItem
                                            key={item.id}
                                            item={item}
                                            onUpdateQty={updateQuantity}
                                            onRemove={removeFromCart}
                                            onUpdatePrice={updatePrice}
                                        />
                                    ))}
                                </div>
                                <PaymentSection 
                                    total={total} 
                                    availableMethods={availableMethods} 
                                    payments={payments}
                                    setPayments={setPayments}
                                    onFinalize={handleFinalizeSale} 
                                    loading={isFinalizing} 
                                    cartEmpty={(cart || []).length === 0} 
                                    onAlert={showAlert}
                                    showMixed={showMixed}
                                    setShowMixed={setShowMixed}
                                    cashReceived={cashReceived}
                                    setCashReceived={setCashReceived}
                                />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'memberships' && (
                        <motion.div
                            key="memberships" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
                        >
                            <MembershipsView 
                    onRenew={handleRenew} 
                    onQueueWhatsApp={addToWaQueue}
                    companyName={companySettings?.company?.commercialName || companySettings?.company?.name}
                />
                        </motion.div>
                    )}

                    {activeTab === 'whatsapp' && (
                        <motion.div
                            key="whatsapp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
                        >
                            <WhatsappView />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modales */}
            {orderSuccess && (
                <SuccessModal
                    orderNumber={orderSuccess}
                    onReset={() => {
                        setOrderSuccess(null);
                        setPrintData(null);
                        setPayments([]);
                        setShowMixed(false);
                        setCashReceived('');
                        setSearchType('DNI');
                    }}
                    onPrint={handlePrint}
                    customerPhone={printData?.customer?.phone}
                    total={printData?.total}
                    docType={docType}
                    company={session?.user?.company}
                    businessType={companySettings?.company?.businessType}
                    membershipInfo={lastMembershipInfo}
                    onQueueWhatsApp={addToWaQueue}
                />
            )}
            <CustomerManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} initialDoc={manualDoc} onCustomerCreated={(c) => { setCustomer(c); setCustomerSearch(c.ruc); setShowManualModal(false); }} />
            <CartDetailsModal
                isOpen={showCartModal}
                onClose={() => setShowCartModal(false)}
                items={cart}
                total={total}
                onUpdateQty={updateQuantity}
                onRemove={removeFromCart}
                onClear={() => setCart([])}
            />
            <SalesHistoryModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                idApeCaj={idApeCaj}
                onPrint={handlePrint}
                company={session?.user?.company}
                onQueueWhatsApp={addToWaQueue}
            />
            <CloseCashModal
                isOpen={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                idApeCaj={idApeCaj}
                onConfirm={(report) => {
                    handlePrintCashReport(report);
                    setTimeout(() => signOut(), 5000); // Dar más tiempo a imprimir antes de salir
                }}
            />
            <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} db={session?.user?.company} />
            <CashExpenseModal
                isOpen={activeTab === 'expenses'}
                onClose={() => setActiveTab('pos')}
                onSaved={() => setActiveTab('pos')}
                idapecaj={idApeCaj}
                codpto={session?.user?.company?.codpto || '01'}
            />

            {/* COMPONENTE DE IMPRESIÓN PROFESIONAL (REPLICA EXACTA) */}
            <div id="ticket-print" className="no-screen">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .no-screen { display: none; }
                    @media print {
                        @page { margin: 0; size: 80mm auto; }
                        body { visibility: hidden; background: #fff; margin: 0; padding: 0; }
                        .no-screen { 
                            display: block !important; 
                            visibility: visible !important; 
                            position: absolute; 
                            left: 0; 
                            top: 0; 
                            width: 80mm; 
                            padding: 4mm;
                            background: #fff;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 11px;
                            color: #000;
                        }
                        .no-screen * { visibility: visible !important; }
                        .text-center { textAlign: center; }
                        .text-right { textAlign: right; }
                        .bold { fontWeight: bold; }
                        .mb-1 { marginBottom: 4px; }
                        .mb-2 { marginBottom: 8px; }
                        .border-top { borderTop: 1px solid #000; paddingTop: 4px; }
                        .border-bottom { borderBottom: 1px solid #000; paddingBottom: 4px; }
                    }
                `}} />
                {printData ? (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{companySettings?.company?.name || ''}</div>
                            <div style={{ margin: '4px 0' }}>
                                <img src={posLogo.startsWith('data:image') || posLogo.startsWith('http') ? posLogo : `/logos/${posLogo}`} width="120" alt="Logo" style={{ display: 'block', margin: '0 auto', maxHeight: '50px', objectFit: 'contain' }} />
                            </div>
                            <div>R.U.C.: {companySettings?.company?.ruc || ''}</div>
                            <div style={{ fontSize: '10px' }}>{companySettings?.company?.address || ''}</div>
                            <div>Telf: {companySettings?.company?.phone || ''}</div>
                        </div>

                        <div style={{ textAlign: 'center', margin: '12px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '8px 0' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                                {printData.docType === '01' ? 'FACTURA ELECTRONICA' : (printData.docType === '03' ? 'BOLETA DE VENTA' : 'NOTA DE VENTA')}
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Nº {printData.documentNumber}</div>
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex' }}><span style={{ width: '80px' }}>FECHA</span>: {printData.date?.split(',')[0]}</div>
                            {printData.docType === 'Nota' && <div style={{ display: 'flex' }}><span style={{ width: '80px' }}>HORA</span>: {new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}</div>}
                            <div style={{ display: 'flex' }}><span style={{ width: '80px' }}>VENDEDOR</span>: {printData.salesperson || 'ADMINISTRADOR'}</div>
                            <div style={{ display: 'flex' }}><span style={{ width: '80px' }}>COND.VTA</span>: EFECTIVO</div>
                            {printData.docType === '01' && <div style={{ display: 'flex' }}><span style={{ width: '80px' }}>DOC. IDE.</span>: R.U.C. {printData.customer?.ruc}</div>}
                            <div style={{ display: 'flex' }}><span style={{ width: '80px' }}>{printData.docType === 'Nota' ? 'SEÑOR' : 'CLIENTE'}</span>: {printData.customer?.name || 'VENTA CONTADO'}</div>
                            {printData.docType === 'Nota' && <div style={{ display: 'flex' }}><span style={{ width: '80px' }}>DIREC.</span>: {printData.customer?.address || ''}</div>}
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>CANT.</th>
                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>DESCRIPCIÓN</th>
                                    <th style={{ textAlign: 'right', padding: '4px 0' }}>TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(printData.items || []).map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ verticalAlign: 'top', padding: '4px 0' }}>{item.quantity}</td>
                                        <td style={{ padding: '4px 0' }}>{item.name}</td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '4px 0' }}>{Number(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {printData.docType !== 'Nota' ? (
                            <div style={{ marginTop: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <div style={{ width: '120px' }}>Total Gravado</div>
                                    <div style={{ width: '40px' }}>S/:</div>
                                    <div style={{ width: '60px', textAlign: 'right' }}>{Number(printData.base || 0).toFixed(2)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <div style={{ width: '120px' }}>Total Inafecto</div>
                                    <div style={{ width: '40px' }}>S/:</div>
                                    <div style={{ width: '60px', textAlign: 'right' }}>0.00</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <div style={{ width: '120px' }}>Exonerado</div>
                                    <div style={{ width: '40px' }}>S/:</div>
                                    <div style={{ width: '60px', textAlign: 'right' }}>0.00</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <div style={{ width: '120px' }}>I.G.V.</div>
                                    <div style={{ width: '40px' }}>S/:</div>
                                    <div style={{ width: '60px', textAlign: 'right' }}>{Number(printData.igv || 0).toFixed(2)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', fontWeight: 'bold', fontSize: '13px', marginTop: '4px' }}>
                                    <div style={{ width: '120px' }}>TOTAL</div>
                                    <div style={{ width: '40px' }}>S/:</div>
                                    <div style={{ width: '60px', textAlign: 'right' }}>{Number(printData.total || 0).toFixed(2)}</div>
                                </div>
                                <div style={{ marginTop: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                                    SON: {Number(printData.total || 0).toFixed(2)} SOLES
                                </div>
                                <div style={{ borderTop: '1px solid #000', marginTop: '8px', paddingTop: '8px', fontSize: '10px' }}>
                                    <div>STATUS: &lt;REIMPRESION&gt;</div>
                                    <div>FECHA IMPRESION: {new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}</div>
                                </div>
                                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                    {qrCodeUrl ? (
                                        <img src={qrCodeUrl} style={{ width: '100px', height: '100px', margin: '0 auto', display: 'block' }} alt="QR Documento" />
                                    ) : (
                                        <div style={{ width: '80px', height: '80px', border: '1px solid #000', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>Generando QR...</div>
                                    )}
                                    <div style={{ fontSize: '9px', marginTop: '5px' }}>
                                        Representación impresa de {printData.docType === '01' ? 'Factura Electrónica' : 'Boleta De Venta Electrónica'}<br />
                                        Podrá ser consultada en https://www.prolineapp.pe
                                    </div>
                                    <div style={{ fontSize: '9px', marginTop: '5px' }}>Autorizado por resolución Nº287-2017/SUNAT</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000', paddingTop: '8px' }}>
                                    <span>TOTAL</span>
                                    <span>S/: {Number(printData.total).toFixed(2)}</span>
                                </div>
                                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                    ¡ Gracias por su preferencia !
                                </div>
                            </div>
                        )}
                    </div>
                ) : cashReportData ? (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{companySettings?.company?.name || ''}</div>
                            <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '8px' }}>REPORTE DE ARQUEO / CIERRE</div>
                            <div style={{ fontSize: '11px' }}>ID SESIÓN: {idApeCaj}</div>
                        </div>

                        <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '8px 0', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>CAJERO:</span>
                                <span>{session?.user?.name || 'ADMIN'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>FECHA:</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>HORA CIERRE:</span>
                                <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                <span>MONTO INICIAL:</span>
                                <span>S/ {Number(cashReportData.opening).toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontWeight: 'bold', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>VENTAS POR MÉTODO</div>
                            {cashReportData.salesBreakdown?.map((s, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{s.method?.toUpperCase().includes('EFECTIVO') ? 'EFECTIVO' : 
                                           (s.codtar?.trim() === '07' || s.method?.toUpperCase().includes('YAPE') ? 'YAPE' : 
                                           (s.codtar?.trim() === '06' || s.method?.toUpperCase().includes('PLIN') ? 'PLIN' : 'TARJETA'))}:</span>
                                    <span>S/ {Number(s.total || 0).toFixed(2)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '4px', borderTop: '1px solid #000' }}>
                                <span>TOTAL VENTAS:</span>
                                <span>S/ {Number(cashReportData.totalSales).toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontWeight: 'bold', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>EGRESOS / GASTOS</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>TOTAL GASTOS:</span>
                                <span>S/ {Number(cashReportData.expenses).toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{ borderTop: '2px solid #000', paddingTop: '8px', marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
                                <span>EFECTIVO EN CAJA:</span>
                                <span>S/ {Number(cashReportData.expectedFinal).toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '40px' }}>
                            <div style={{ borderTop: '1px solid #000', width: '150px', margin: '0 auto' }}></div>
                            <div style={{ fontSize: '10px', marginTop: '4px' }}>FIRMA CAJERO</div>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>Preparando ticket...</div>
                )}
            </div>

            {/* Overlay de Carga durante Finalización de Venta (Rediseñado para ser espacioso y bonito) */}
            <AnimatePresence>
                {isFinalizing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            style={{
                                background: '#fff',
                                padding: '80px',
                                borderRadius: '48px',
                                boxShadow: '0 40px 80px -15px rgba(0,0,0,0.35)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '40px',
                                maxWidth: '520px',
                                width: '90%',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <div className="w-28 h-28 rounded-full border-[8px] border-orange-50 border-t-orange-500 animate-spin shadow-inner" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="w-10 h-10 text-orange-400" />
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.03em', lineHeight: 1 }}>
                                    Procesando Venta
                                </h3>
                                <p style={{ fontSize: '20px', color: '#64748b', fontWeight: 500, lineHeight: '1.6' }}>
                                    Sincronizando información con <br />
                                    <span style={{ color: '#f97316', fontWeight: 900, fontSize: '22px' }}>Navasoft ERP</span>
                                </p>

                                <div style={{ marginTop: '40px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            animate={{
                                                y: [0, -15, 0],
                                                opacity: [0.3, 1, 0.3],
                                                scale: [1, 1.2, 1]
                                            }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 1.2,
                                                delay: i * 0.15,
                                                ease: "circOut"
                                            }}
                                            style={{
                                                width: '14px',
                                                height: '14px',
                                                background: '#f97316',
                                                borderRadius: '50%',
                                                boxShadow: '0 0 20px rgba(249,115,22,0.5)'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <QuickModal
                show={modal.show}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                showButtons={modal.showButtons}
                inputValue={modal.value}
                onInputChange={(val) => setModal(prev => ({ ...prev, value: val }))}
                onClose={() => setModal(prev => ({ ...prev, show: false }))}
                onConfirm={() => modal.onConfirm(modal.value)}
            />
            <CustomerErpModal
                isOpen={showErpModal}
                onClose={() => setShowErpModal(false)}
                initialData={erpModalData}
                onSave={(newCli) => {
                    setCustomer({
                        name: newCli.nomcli,
                        ruc: newCli.ruccli,
                        code: newCli.code,
                        phone: newCli.phone,
                        birthdate: newCli.birthdate,
                        isNew: false
                    });
                    setCustomerSearch(newCli.ruccli);
                }}
            />
        </div>
    );
}

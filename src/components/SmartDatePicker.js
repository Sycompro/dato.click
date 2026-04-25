'use client';
import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function SmartDatePicker({ mode, value, onChange, availableYears = [2026, 2025, 2024, 2023] }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to format display label
    const getDisplayLabel = () => {
        if (!value) return 'Seleccionar...';
        if (mode === 'daily') return value;
        if (mode === 'weekly') {
            const parts = value.split('-W');
            return `Semana ${parts[1]}, ${parts[0]}`;
        }
        if (mode === 'monthly') {
            const [y, m] = value.split('-');
            return `${MONTHS_FULL[parseInt(m) - 1]} ${y}`;
        }
        if (mode === 'annual') return `Año ${value}`;
        return value;
    };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className="smart-picker-container" ref={containerRef}>
            <button className="smart-picker-trigger" onClick={() => setIsOpen(!isOpen)}>
                <Calendar size={14} className="trigger-icon" />
                <span className="trigger-label">{getDisplayLabel()}</span>
            </button>

            {isOpen && (
                <div className="smart-picker-dropdown">
                    {mode === 'annual' && (
                        <div className="year-selector">
                            <div className="picker-title">Seleccionar Año</div>
                            <div className="year-grid">
                                {availableYears.map(y => (
                                    <button 
                                        key={y} 
                                        className={`year-item ${+value === y ? 'active' : ''}`}
                                        onClick={() => handleSelect(y)}
                                    >
                                        {y}
                                        {+value === y && <Check size={12} className="check-icon" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === 'monthly' && (
                        <div className="month-selector">
                            <MonthPicker 
                                value={value} 
                                onSelect={handleSelect} 
                                availableYears={availableYears}
                            />
                        </div>
                    )}

                    {(mode === 'daily' || mode === 'weekly') && (
                        <CalendarView 
                            mode={mode}
                            value={value}
                            onSelect={handleSelect}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function MonthPicker({ value, onSelect, availableYears }) {
    const [currentYear, setCurrentYear] = useState(() => {
        if (!value) return new Date().getFullYear();
        return parseInt(value.split('-')[0]);
    });
    
    const selectedMonth = value ? parseInt(value.split('-')[1]) : null;
    const selectedYear = value ? parseInt(value.split('-')[0]) : null;

    return (
        <div className="month-picker-content">
            <div className="picker-header">
                <button className="nav-btn" onClick={() => setCurrentYear(currentYear - 1)}>
                    <ChevronLeft size={16} />
                </button>
                <div className="current-year">{currentYear}</div>
                <button className="nav-btn" onClick={() => setCurrentYear(currentYear + 1)}>
                    <ChevronRight size={16} />
                </button>
            </div>
            <div className="month-grid">
                {MONTHS_SHORT.map((m, idx) => {
                    const monthVal = idx + 1;
                    const isActive = selectedYear === currentYear && selectedMonth === monthVal;
                    return (
                        <button 
                            key={m} 
                            className={`month-item ${isActive ? 'active' : ''}`}
                            onClick={() => onSelect(`${currentYear}-${String(monthVal).padStart(2, '0')}`)}
                        >
                            {m}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function CalendarView({ mode, value, onSelect }) {
    const [viewDate, setViewDate] = useState(() => {
        if (!value) return new Date();
        if (mode === 'daily') return new Date(value + 'T00:00:00');
        if (mode === 'weekly') {
            // weekStr is YYYY-Www, rough estimate for header
            const [y, w] = value.split('-W');
            const d = new Date(y, 0, 1 + (w - 1) * 7);
            return d;
        }
        return new Date();
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];
    // Padding prev month
    for (let i = firstDayOfMonth; i > 0; i--) {
        days.push({ day: prevMonthDays - i + 1, current: false, date: new Date(year, month - 1, prevMonthDays - i + 1) });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, current: true, date: new Date(year, month, i) });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({ day: i, current: false, date: new Date(year, month + 1, i) });
    }

    const isSelected = (d) => {
        if (mode === 'daily') {
            const iso = d.toISOString().split('T')[0];
            return iso === value;
        }
        if (mode === 'weekly') {
            const wStr = getWeekStr(d);
            return wStr === value;
        }
        return false;
    };

    function getWeekStr(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }

    const handleDateClick = (d) => {
        if (mode === 'daily') {
            onSelect(d.toISOString().split('T')[0]);
        } else {
            onSelect(getWeekStr(d));
        }
    };

    const changeMonth = (offset) => {
        setViewDate(new Date(year, month + offset, 1));
    };

    const dayLabels = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];

    return (
        <div className="calendar-view">
            <div className="picker-header">
                <button className="nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={16}/></button>
                <div className="current-month">{MONTHS_FULL[month]} {year}</div>
                <button className="nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={16}/></button>
            </div>
            <div className="calendar-grid">
                {dayLabels.map(l => <div key={l} className="day-label">{l}</div>)}
                {days.map((d, i) => {
                    const active = isSelected(d.date);
                    return (
                        <div 
                            key={i} 
                            className={`day-cell ${d.current ? '' : 'other-month'} ${active ? 'active' : ''} ${mode === 'weekly' && active ? 'week-active' : ''}`}
                            onClick={() => handleDateClick(d.date)}
                        >
                            {d.day}
                        </div>
                    );
                })}
            </div>
            <div className="picker-footer">
                <button className="picker-btn ghost" onClick={() => handleDateClick(new Date())}>Hoy</button>
            </div>
        </div>
    );
}

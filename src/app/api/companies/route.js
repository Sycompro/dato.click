import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getConnection } from '../../../lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

// Estilos visuales predefinidos para asignar a las empresas
const STYLES = {
    'BdNava01': { color: '#ec4899', bg: '#fce8f3', icon: 'Store' },
    'BdNava02': { color: '#10b981', bg: '#e6f7f0', icon: 'Warehouse' },
    'BdNava03': { color: '#7c5cfc', bg: '#f0ecff', icon: 'Briefcase' },
    'BdNava04': { color: '#6366f1', bg: '#f0ecff', icon: 'Briefcase' },
    'BdNava05': { color: '#f59e0b', bg: '#fef6e7', icon: 'Award' },
    'BdNava06': { color: '#06b6d4', bg: '#ecfeff', icon: 'Building' },
};

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Acceso Denegado' }, { status: 401 });

    try {
        // 1. Obtener bases de datos reales en el servidor
        const masterPool = await getConnection('master');
        const dbResult = await masterPool.request().query("SELECT name FROM sys.databases");
        const existingDbs = new Set(dbResult.recordset.map(d => d.name.trim()));

        // 2. Obtener nombres comerciales y RUCs desde BdNavaSys.sysnavacia
        const poolSys = await getConnection('BdNavaSys');
        const resSys = await poolSys.request().query(
            "SELECT RTRIM(codcia) as codcia, RTRIM(nomcia) as nomcia, RTRIM(ruccia) as ruccia FROM sysnavacia WHERE estado = 1 AND codcia <> '00'"
        );

        const companies = [];
        resSys.recordset.forEach(c => {
            const dbId = `BdNava${c.codcia.trim()}`;
            if (existingDbs.has(dbId)) {
                const style = STYLES[dbId] || { color: '#4880f5', bg: '#e8f0fe', icon: 'Building' };
                companies.push({
                    id: dbId,
                    name: c.nomcia.trim().toUpperCase(),
                    ruc: c.ruccia.trim(),
                    color: style.color,
                    bg: style.bg,
                    iconStr: style.icon
                });
            }
        });

        return NextResponse.json({ success: true, data: companies });
    } catch (error) {
        console.error("Companies API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}


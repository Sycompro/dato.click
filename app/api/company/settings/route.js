import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getWebSettings, saveWebSettings } from '@/lib/web-settings';

export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const pool = await getConnection(session?.user?.company);
        const masterPool = await getConnection('BdNavaSys');
        const dbCode = session?.user?.company?.replace('BdNava', '').padStart(2, '0') || '01';

        // 1. Obtener datos globales de la Cia (Emisor) desde SQL Server
        let emisor = { nomcia: 'MI EMPRESA', ruccia: '', dircia: '' };
        try {
            const sysRes = await masterPool.request()
                .input('code', sql.Char(3), dbCode)
                .query("SELECT nomcia, ruccia, dircia FROM sysnavacia WHERE codcia LIKE @code + '%'");
            if (sysRes.recordset.length > 0) emisor = sysRes.recordset[0];
        } catch (e) {
            console.warn("[Settings] Error SQL Server:", e.message);
        }

        // 2. Obtener configuración personalizada desde JSON (Interno Railway)
        const webConfig = await getWebSettings(dbCode);

        // 3. Obtener datos de la Sede
        const sedeCode = session.user.sedeId || '01';
        const sedeRes = await pool.request()
            .input('codpto', sql.Char(6), sedeCode)
            .query(`
                SELECT P.nompto, T.DirTie, T.TelTie 
                FROM tbl01pto P
                LEFT JOIN tbl_tienda T ON P.codtie = T.codtie
                WHERE P.codpto = @codpto
            `);
        
        const sede = sedeRes.recordset[0] || {};

        return NextResponse.json({
            company: {
                name: (webConfig.use_custom_name === 1 && webConfig.custom_name) ? webConfig.custom_name : (emisor.nomcia?.trim() || sede.nompto?.trim() || 'Gym'),
                legalName: emisor.nomcia?.trim() || 'Empresa POS',
                commercialName: (webConfig.use_custom_name === 1 && webConfig.custom_name) ? webConfig.custom_name : (emisor.nomcia?.trim() || sede.nompto?.trim() || 'Gym'),
                ruc: emisor.ruccia?.trim() || '',
                address: sede.DirTie?.trim() || emisor.dircia?.trim() || '',
                phone: sede.TelTie?.trim() || emisor.telcia?.trim() || '',
                email: emisor.email?.trim() || '',
                // Datos crudos para el modal de configuración
                rawName: emisor.nomcia?.trim(),
                customName: webConfig.custom_name,
                useCustomName: webConfig.use_custom_name === 1
            },
            pointOfSale: {
                name: sede.nompto?.trim() || 'SUCURSAL PRINCIPAL',
                code: sedeCode
            }
        });
    } catch (err) {
        console.error('Error fetching settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { customName, useCustomName } = await request.json();
        const dbCode = session?.user?.company?.replace('BdNava', '').padStart(2, '0') || '01';

        await saveWebSettings(dbCode, {
            custom_name: customName,
            use_custom_name: useCustomName ? 1 : 0
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Error saving web settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

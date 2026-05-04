import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const pool = await getConnection(session?.user?.company);
        
        // 1. Obtener datos globales de la Cia (Emisor)
        const emisorRes = await pool.request()
            .query("SELECT TOP 1 ruccia, nomcia, dircia, telcia, email FROM tbl_enavasoft_emisor");
        
        const emisor = emisorRes.recordset[0] || {};

        // 2. Obtener datos de la Sede/Punto de Venta actual del usuario
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
                name: emisor.nomcia?.trim() || 'MI EMPRESA',
                ruc: emisor.ruccia?.trim() || '',
                address: sede.DirTie?.trim() || emisor.dircia?.trim() || '',
                phone: sede.TelTie?.trim() || emisor.telcia?.trim() || '',
                email: emisor.email?.trim() || ''
            },
            pointOfSale: {
                name: sede.nompto?.trim() || 'SUCURSAL PRINCIPAL',
                code: sedeCode
            }
        });
    } catch (err) {
        console.error('Error fetching company settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

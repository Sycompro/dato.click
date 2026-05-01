import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET() {
    try {
        console.log('[API] Fetching companies from BdNava01 (confemp01)...');
        
        // Usamos BdNava01 como fuente de verdad para los códigos que espera psventa.exe
        const pool = await getConnection('BdNava01');
        
        const result = await pool.request()
            .query("SELECT Codigo, Base FROM confemp01 WHERE Estado = 1");
        
        // Mapeo de nombres "bonitos" sincronizados con el Dashboard
        const nameMap = {
            'BdNava01': 'GIM.BRA S.A.C.',
            'DB_GIMBRAMOVIL': 'GIM.BRA S.A.C.',
            'DB_BUNNYMOVIL': 'BUNNY BRA S.A.C.',
            'BdNava02': 'BUNNY BRA S.A.C.',
            'DB_GYM': 'GYMBRA E.I.R.L.',
            'BdNava05': 'GYMBRA E.I.R.L.',
            'BdNava03': 'HERRERA SUCSE WIKY ALEXIS',
            'BdNava04': 'IMPORTACIONES GYA S.A.C',
            'PRUEBA_GYM': 'GYMBRA (PRUEBAS)'
        };

        const companies = result.recordset.map(c => {
            const base = (c.Base || '').trim();
            const code = (c.Codigo || '').trim();
            return {
                id: code,
                code: code,
                name: nameMap[base] || nameMap[code] || code.toUpperCase(),
                database: base
            };
        });

        console.log(`[API] Found ${companies.length} companies mapping to ERP codes`);
        return NextResponse.json(companies);

    } catch (err) {
        console.error('[API] Error fetching companies:', err.message);
        return NextResponse.json({ 
            error: 'Error interno del servidor', 
            details: err.message 
        }, { status: 500 });
    }
}

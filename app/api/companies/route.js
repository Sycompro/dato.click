import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET() {
    try {
        // Usar la base de datos maestra (BdNava01 por defecto en getConnection sin argumentos)
        const pool = await getConnection();
        const result = await pool.request()
            .query("SELECT EmpresaId, Codigo, Descripcion, Base FROM confemp01 WHERE Codigo IS NOT NULL ORDER BY EmpresaId");
        
        const companies = result.recordset.map(c => ({
            id: c.EmpresaId,
            code: c.Codigo.trim(),
            name: c.Descripcion.trim(),
            database: c.Base.trim()
        }));

        return NextResponse.json(companies);
    } catch (err) {
        console.error('Error fetching companies:', err);
        return NextResponse.json({ error: 'Error al cargar empresas' }, { status: 500 });
    }
}

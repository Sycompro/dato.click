import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET() {
    try {
        console.log('[API] Consolidating company list with database verification...');
        
        // 1. Obtener bases de datos reales en el servidor
        const masterPool = await getConnection('master');
        const dbResult = await masterPool.request().query("SELECT name FROM sys.databases");
        const existingDbs = new Set(dbResult.recordset.map(d => d.name.trim()));

        // 2. Obtener nombres comerciales de BdNavaSys
        const poolSys = await getConnection('BdNavaSys');
        const resSys = await poolSys.request()
            .query("SELECT codcia, nomcia FROM sysnavacia WHERE estado = 1 AND codcia <> '00'");
        
        // 3. Obtener códigos técnicos de confemp01
        const poolMaster = await getConnection('BdNava01');
        const resMaster = await poolMaster.request()
            .query("SELECT Codigo, Base FROM confemp01 WHERE Estado = 1");

        const companiesMap = new Map();

        // Procesar sysnavacia (Prioridad: Nombres comerciales)
        resSys.recordset.forEach(c => {
            const code = c.codcia.trim();
            const dbName = `BdNava${code}`;
            if (existingDbs.has(dbName)) {
                companiesMap.set(dbName, {
                    id: code,
                    code: code,
                    name: c.nomcia.trim().toUpperCase(),
                    database: dbName
                });
            }
        });

        /* 
        // Procesar confemp01 (Prioridad: Códigos técnicos/POS)
        resMaster.recordset.forEach(c => {
            const base = c.Base.trim();
            const code = c.Codigo.trim();
            
            if (existingDbs.has(base)) {
                // Si la base ya está mapeada, mantenemos el nombre bonito pero permitimos el código técnico
                if (companiesMap.has(base)) {
                    // Opcional: Podríamos agregar el código técnico como alias o permitir ambos
                } else {
                    // Es una base POS específica (ej: DB_GYM)
                    let prettyName = code.toUpperCase();
                    if (code.toLowerCase().includes('gym')) prettyName = 'GYMBRA (POS)';
                    
                    companiesMap.set(base, {
                        id: code,
                        code: code,
                        name: prettyName,
                        database: base
                    });
                }
            }
        });
        */

        const companies = Array.from(companiesMap.values());
        // Filtrar para asegurar que solo enviamos las oficiales (numéricas) si es necesario,
        // o simplemente limpiar el log.
        console.log(`[API] Validated ${companies.length} active official companies`);

        return NextResponse.json(companies);

    } catch (err) {
        console.error('[API] Error fetching companies:', err.message);
        return NextResponse.json({ 
            error: 'Error interno del servidor', 
            details: err.message 
        }, { status: 500 });
    }
}

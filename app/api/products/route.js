import { getConnection } from '../../../lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import sql from 'mssql';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const company = session?.user?.company || process.env.DB_NAME_MASTER;
    const sedeId = session?.user?.sedeId;
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    const pool = await getConnection(company);
    
    // 1. Determinar el almacén (warehouse) del Punto de Venta (Sede)
    let warehouse = '01'; // Default
    if (sedeId) {
        const ptoRes = await pool.request()
            .input('codpto', sql.Char(6), sedeId)
            .query("SELECT codtie FROM tbl01pto WHERE codpto = @codpto");
        
        if (ptoRes.recordset.length > 0) {
            // El codtie suele ser '001', '008', etc. Tomamos los últimos 2 dígitos.
            const codtie = ptoRes.recordset[0].codtie.trim();
            warehouse = codtie.slice(-2); 
        }
    }

    const stockField = `stk${warehouse.padStart(2, '0')}`;
    
    // 2. Consulta optimizada con lógica de stock inteligente (Sede > Total)
    let sqlQuery = `
      SELECT TOP 50 
        RTRIM(codi) as code, 
        RTRIM(codf) as userCode, 
        RTRIM(descr) as name, 
        RTRIM(marc) as brand, 
        RTRIM(umed) as unit, 
        pvns as price, 
        CASE 
          WHEN ${stockField} > 0 THEN ${stockField} 
          ELSE stoc 
        END as stock
      FROM prd0101
      WHERE estado = 1
    `;
    
    if (query) {
      sqlQuery += ` AND (descr LIKE '%${query}%' OR codi LIKE '%${query}%' OR codf LIKE '%${query}%')`;
    }
    
    sqlQuery += ` ORDER BY descr ASC`;
    
    const result = await pool.request().query(sqlQuery);
    
    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

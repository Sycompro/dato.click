import { getConnection } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import sql from 'mssql';
import { getWarehouseForSede, getStockTableName, getStockColumnName } from '@/lib/erp-utils';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const company = session.user.company;
    const sedeId = session.user.sedeId;
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    
    const pool = await getConnection(company);
    
    // 1. Determinar el almacén (Prioridad: URL > Sesión > Default)
    const urlAlm = searchParams.get('alm');
    let warehouse = urlAlm;
    
    if (!warehouse || warehouse === 'undefined') {
        warehouse = await getWarehouseForSede(pool, sedeId);
    }
    
    const stockField = getStockColumnName(warehouse);
    const prdTable = getStockTableName(warehouse);
    
    // 2. Construir la cláusula WHERE para filtros (Búsqueda + Categoría)
    let filters = "estado = 1";
    if (query) {
        filters += ` AND (descr LIKE '%${query}%' OR codi LIKE '%${query}%' OR codf LIKE '%${query}%')`;
    }
    if (category && category !== 'Todos' && category !== 'all') {
        filters += ` AND LTRIM(RTRIM(codcat)) = RIGHT('${category}', 2) AND LEFT(codi, 2) = LEFT('${category}', 2)`;
    }

    // 3. Consulta inteligente con soporte Multi-Tabla
    let sqlQuery = `
      DECLARE @table_exists INT;
      SELECT @table_exists = COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${prdTable}';

      IF @table_exists > 0
        BEGIN
          SELECT TOP 50 
            RTRIM(codi) as id, RTRIM(codf) as userCode, RTRIM(descr) as name, 
            RTRIM(marc) as brand, RTRIM(umed) as unit, pvns as price, 
            stoc as stock, RTRIM(Usr_003) as membershipDays
          FROM ${prdTable}
          WHERE ${filters}
          ORDER BY descr ASC
        END
      ELSE
        BEGIN
          SELECT TOP 50 
            RTRIM(codi) as id, RTRIM(codf) as userCode, RTRIM(descr) as name, 
            RTRIM(marc) as brand, RTRIM(umed) as unit, pvns as price, 
            ISNULL(NULLIF(${stockField}, 0), stoc) as stock, RTRIM(Usr_003) as membershipDays
          FROM prd0101
          WHERE ${filters}
          ORDER BY descr ASC
        END
    `;
    
    const result = await pool.request().query(sqlQuery);
    
    const products = result.recordset.map(r => ({
        id: r.id.trim(),
        userCode: r.userCode?.trim() || '',
        name: r.name.trim(),
        brand: r.brand?.trim() || '',
        unit: r.unit?.trim() || 'UND',
        price: r.price,
        stock: r.stock,
        membershipDays: parseInt(r.membershipDays || '0', 10)
    }));

    return NextResponse.json(products);

  } catch (error) {
    console.error('[API Products Search] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

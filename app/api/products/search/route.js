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
    
    // 1. Determinar el almacén de forma INFALIBLE
    const urlAlm = searchParams.get('alm');
    // Siempre intentamos resolverlo para normalizar (ej: "PUNTO 03" -> "03")
    const warehouse = await getWarehouseForSede(pool, urlAlm || sedeId);
    
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

    // 3. Consulta directa a la tabla maestra (Restaurando lógica ganadora)
    let sqlQuery = `
      SELECT TOP 50 
        RTRIM(codi) as id, RTRIM(codf) as userCode, RTRIM(descr) as name, 
        RTRIM(marc) as brand, RTRIM(umed) as unit, pvns as price, 
        ${stockField} as stock, RTRIM(Usr_003) as membershipDays
      FROM prd0101
      WHERE ${filters}
      ORDER BY descr ASC
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

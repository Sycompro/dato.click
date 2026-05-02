import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const alm = searchParams.get('alm') || '01';
    const category = searchParams.get('category'); // Filtro de categoría

    // Si no hay query, cargamos el top 50 de productos para no dejar la pantalla vacía
    const isInitialLoad = !query || query.length === 0;
    const searchQuery = isInitialLoad ? '%' : `%${query}%`;

    try {
        const pool = await getConnection(session?.user?.company);
        
        // El campo de stock es stk + código de almacén con 2 dígitos
        const stockField = `stk${alm.padStart(2, '0')}`;

        const request = pool.request()
            .input('searchQuery', sql.VarChar(100), searchQuery);
        
        let whereClause = "(descr LIKE @searchQuery OR codi LIKE @searchQuery OR codf LIKE @searchQuery) AND estado = 1";
        
        if (category && category !== 'Todos' && category !== 'all') {
            request.input('category', sql.Char(6), category);
            whereClause += " AND LTRIM(RTRIM(codsub)) = @category";
        }

        const result = await request.query(`
            SELECT TOP 50 
                RTRIM(codi) as id, 
                RTRIM(codf) as userCode, 
                RTRIM(descr) as name, 
                pvns as price, 
                CASE 
                    WHEN ${stockField} > 0 THEN ${stockField} 
                    ELSE stoc 
                END as stock 
            FROM prd0101 
            WHERE ${whereClause}
        `);

        const products = result.recordset.map(r => ({
            id: r.id.trim(),
            userCode: r.userCode?.trim() || '',
            name: r.name.trim(),
            price: r.price,
            stock: r.stock
        }));

        return NextResponse.json(products);

    } catch (err) {
        console.error('Product search error:', err);
        return NextResponse.json({ error: 'Error en la búsqueda de productos' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const cdocu = searchParams.get('cdocu');
    const ndocu = searchParams.get('ndocu');

    if (!cdocu || !ndocu) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });

    try {
        const pool = await getConnection(session?.user?.company);
        
        // Obtener Cabecera
        const headerRes = await pool.request()
            .input('cdocu', sql.Char(2), cdocu)
            .input('ndocu', sql.Char(12), ndocu)
            .query("SELECT ndocu, cdocu, nomcli, ruccli, totn as total, tota as base, toti as igv, fecha, codven FROM mst01fac WHERE cdocu = @cdocu AND ndocu = @ndocu");

        if (headerRes.recordset.length === 0) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

        // Obtener Detalle
        const detailRes = await pool.request()
            .input('cdocu', sql.Char(2), cdocu)
            .input('ndocu', sql.Char(12), ndocu)
            .query("SELECT descr as name, cant as quantity, preu as price FROM dtl01fac WHERE cdocu = @cdocu AND ndocu = @ndocu");

        // Obtener nombre del vendedor
        let salespersonName = headerRes.recordset[0].codven;
        if (salespersonName) {
            const venRes = await pool.request()
                .input('codven', sql.Char(6), salespersonName)
                .query("SELECT nomven FROM tbl01ven WHERE codven = @codven");
            if (venRes.recordset.length > 0) salespersonName = venRes.recordset[0].nomven;
        }

        return NextResponse.json({
            ...headerRes.recordset[0],
            items: detailRes.recordset,
            salesperson: salespersonName
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

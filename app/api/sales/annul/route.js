import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { cdocu, ndocu, codanu, motivo } = body;

        if (!cdocu || !ndocu || !codanu) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        const pool = await getConnection(session.user.company);
        
        // 1. Verificar si el documento existe y no está ya anulado
        const checkRes = await pool.request()
            .input('cdocu', sql.Char(2), cdocu)
            .input('ndocu', sql.Char(12), ndocu)
            .query("SELECT flag, CodAlm FROM mst01fac WHERE cdocu = @cdocu AND ndocu = @ndocu");

        if (checkRes.recordset.length === 0) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        if (checkRes.recordset[0].flag === '*') {
            return NextResponse.json({ error: 'Documento ya está anulado' }, { status: 400 });
        }

        const warehouse = checkRes.recordset[0].CodAlm.trim();
        const stockField = `stk${warehouse.padStart(2, '0')}`;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 2. Marcar como anulado en Cabecera y Detalle
            await transaction.request()
                .input('cdocu', sql.Char(2), cdocu)
                .input('ndocu', sql.Char(12), ndocu)
                .query("UPDATE mst01fac SET flag = '*' WHERE cdocu = @cdocu AND ndocu = @ndocu");

            await transaction.request()
                .input('cdocu', sql.Char(2), cdocu)
                .input('ndocu', sql.Char(12), ndocu)
                .query("UPDATE dtl01fac SET flag = '*' WHERE cdocu = @cdocu AND ndocu = @ndocu");

            // 3. Revertir Stock
            const itemsRes = await transaction.request()
                .input('cdocu', sql.Char(2), cdocu)
                .input('ndocu', sql.Char(12), ndocu)
                .query("SELECT codi, cant FROM dtl01fac WHERE cdocu = @cdocu AND ndocu = @ndocu");

            for (const item of itemsRes.recordset) {
                await transaction.request()
                    .input('codi', sql.Char(11), item.codi)
                    .input('cant', sql.Float, item.cant)
                    .query(`
                        UPDATE prd0101 
                        SET ${stockField} = ${stockField} + @cant,
                            stoc = stoc + @cant 
                        WHERE codi = @codi
                    `);
                
                // 3.5 Anular en Kardex (Mismo almacén)
                const kardexTable = `kdd01${warehouse.padStart(2, '0')}`;
                try {
                    await transaction.request()
                        .input('cdocu', sql.Char(2), cdocu)
                        .input('ndocu', sql.Char(12), ndocu)
                        .input('codi', sql.Char(11), item.codi)
                        .query(`UPDATE ${kardexTable} SET cant = 0, tota = 0 WHERE cdocu = @cdocu AND ndocu = @ndocu AND codi = @codi`);
                } catch (e) {
                    console.warn(`Kardex update failed for annulment: ${e.message}`);
                }
            }

            // 4. Registrar en Dtl_Anulacion_Doc
            await transaction.request()
                .input('cdocu', sql.Char(2), cdocu)
                .input('ndocu', sql.Char(12), ndocu)
                .input('codanu', sql.Char(2), codanu)
                .input('fecha', sql.DateTime, new Date())
                .input('usuario', sql.VarChar(20), session.user.username.substring(0, 20))
                .query(`
                    INSERT INTO Dtl_Anulacion_Doc (cdocu, ndocu, CodAnu, Fecha, maquina, usuarionav)
                    VALUES (@cdocu, @ndocu, @codanu, @fecha, 'WEB_POS', @usuario)
                `);

            // 5. Revertir Cuentas por Cobrar
            await transaction.request()
                .input('cdocu', sql.Char(2), cdocu)
                .input('ndocu', sql.Char(12), ndocu)
                .query("UPDATE mst01ccc SET flag = '*' WHERE cdocu = @cdocu AND ndocu = @ndocu");

            await transaction.commit();
            return NextResponse.json({ success: true, message: 'Documento anulado correctamente' });

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (error) {
        console.error('Error in annul API:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

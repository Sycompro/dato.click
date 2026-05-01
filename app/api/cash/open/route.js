import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        const { amount, pointOfSale = '01' } = await request.json();

        if (!session?.user?.company) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const pool = await getConnection(session.user.company);
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

        // 1. Verificar si ya hay una caja abierta para este usuario/punto
        const check = await pool.request()
            .input('codusu', sql.Char(10), session.user.username)
            .input('codpto', sql.Char(2), pointOfSale)
            .query("SELECT idapecaj FROM dtl_restpos_apecaj WHERE estado = 1 AND codpto = @codpto");

        if (check.recordset.length > 0) {
            return NextResponse.json({ error: 'Ya existe una caja abierta para este punto de venta' }, { status: 400 });
        }

        // 2. Insertar apertura
        const result = await pool.request()
            .input('fecape', sql.DateTime, dateStr)
            .input('hora', sql.Char(5), timeStr)
            .input('codpto', sql.Char(2), pointOfSale)
            .input('codusu', sql.Char(10), session.user.username)
            .input('apesol', sql.Float, amount || 0)
            .input('apedol', sql.Float, 0)
            .input('apeeur', sql.Float, 0)
            .input('tmov', sql.Int, 1)
            .input('estado', sql.Int, 1)
            .query(`
                INSERT INTO dtl_restpos_apecaj (fecape, hora, codpto, codusu, tmov, estado, apesol, apedol, apeeur)
                VALUES (@fecape, @hora, @codpto, @codusu, @tmov, @estado, @apesol, @apedol, @apeeur);
                SELECT SCOPE_IDENTITY() as id;
            `);

        return NextResponse.json({ 
            success: true, 
            id: result.recordset[0].id,
            message: 'Caja abierta correctamente' 
        });

    } catch (err) {
        console.error('Cash open error:', err);
        return NextResponse.json({ error: 'Error al abrir caja', details: err.message }, { status: 500 });
    }
}

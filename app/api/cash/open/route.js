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
        const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

        // --- DETECCIÓN DE ESQUEMA ---
        let schemaType = 'ERP';
        try {
            await pool.request().query("SELECT TOP 0 * FROM dtl_restpos_apecaj");
        } catch (e) {
            schemaType = 'POS';
        }

        if (schemaType === 'ERP') {
            const userCode = session.user.id?.toString().trim(); // codusu
            const sedeCode = session.user.sedeId?.toString().trim(); // codpto (Punto de Venta)

            // Lógica Esquema ERP (dtl_restpos_apecaj)
            // Validamos si ESTE USUARIO ya tiene una caja abierta
            const check = await pool.request()
                .input('codpto', sql.Char(2), sedeCode)
                .input('codusu', sql.Char(3), userCode)
                .query("SELECT idapecaj FROM dtl_restpos_apecaj WHERE estado = 0 AND LTRIM(RTRIM(codpto)) = @codpto AND LTRIM(RTRIM(codusu)) = @codusu");

            if (check.recordset.length > 0) {
                return NextResponse.json({ error: 'Tú ya tienes una caja abierta en este punto de venta' }, { status: 400 });
            }

            const result = await pool.request()
                .input('fecape', sql.DateTime, dateStr)
                .input('hora', sql.Char(10), timeStr)
                .input('codpto', sql.Char(2), sedeCode)
                .input('codusu', sql.Char(3), userCode)
                .input('apesol', sql.Float, amount || 0)
                .query(`
                    INSERT INTO dtl_restpos_apecaj (fecape, hora, codpto, codusu, tmov, estado, apesol, apedol, apeeur)
                    VALUES (@fecape, @hora, @codpto, @codusu, 'A', 0, @apesol, 0, 0);
                    SELECT SCOPE_IDENTITY() as id;
                `);
            return NextResponse.json({ success: true, id: result.recordset[0].id });
        } else {
            // Lógica Esquema POS (DB_GYM y similares)
            const sedeId = session.user.sedeId || 1;
            const check = await pool.request()
                .input('sedeId', sql.Int, sedeId)
                .query("SELECT CajaId FROM Caja WHERE Vigente = 1 AND SedeId = @sedeId");

            if (check.recordset.length > 0) {
                return NextResponse.json({ error: 'Ya existe una caja abierta para esta sede' }, { status: 400 });
            }

            const result = await pool.request()
                .input('fecha', sql.DateTime, now)
                .input('monto', sql.Float, amount || 0)
                .input('sedeId', sql.Int, sedeId)
                .query(`
                    INSERT INTO Caja (FechaApertura, MontoApertura, Vigente, SedeId, EstadoCajaId, Turno)
                    VALUES (@fecha, @monto, 1, @sedeId, 1, 1);
                    SELECT SCOPE_IDENTITY() as id;
                `);
            return NextResponse.json({ success: true, id: result.recordset[0].id });
        }

    } catch (err) {
        console.error('Cash open error:', err);
        return NextResponse.json({ error: 'Error al abrir caja', details: err.message }, { status: 500 });
    }
}

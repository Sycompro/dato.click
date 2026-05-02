import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function incrementCorrelative(current) {
    if (!current || !current.includes('-')) return current;
    const [prefix, number] = current.split('-');
    const nextNum = (parseInt(number, 10) + 1).toString().padStart(number.length, '0');
    return `${prefix}-${nextNum}`;
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const {
        docType,
        pointOfSale,
        codcli,
        items,
        idApeCaj,
        paymentMethod,
        warehouse,
        currency = 'S',
        exchangeRate = 1
    } = body;

    const pool = await getConnection(session?.user?.company);
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 1. Obtener y actualizar correlativo
        const sedeCode = session.user.sedeId; // codpto
        const corRes = await transaction.request()
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .query("SELECT nroini FROM tbl01cor WHERE cdocu = @cdocu AND codpto = @codpto");

        if (corRes.recordset.length === 0) {
            throw new Error(`Correlativo no encontrado para cdocu:${docType} codpto:${sedeCode}`);
        }

        const ndocu = corRes.recordset[0].nroini.trim();
        const nextNdocu = incrementCorrelative(ndocu);

        // 2. Calcular totales (Navasoft: totn=Total, tota=Afecto, toti=IGV)
        // Nota de Venta (65) no desglosa IGV en cabecera
        const totalVenta = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const isNota = (docType === '65');
        const totalAfecto = isNota ? totalVenta : (totalVenta / 1.18);
        const totalIGV = isNota ? 0 : (totalVenta - totalAfecto);

        // Definir Flags según estándar Navasoft
        const flagValue = '0';
        // 01: Factura -> tfact 1
        // 03: Boleta  -> tfact 2
        // 65: Nota    -> tfact 5
        const tfactValue = (docType === '01') ? '1' : (docType === '03' ? '2' : '5');
        
        // Fecha solo (sin hora) para compatibilidad con filtros ERP
        const todayDate = new Date();
        todayDate.setHours(0,0,0,0);

        // 3. Insertar Cabecera (mst01fac)
        await transaction.request()
            .input('fecha', sql.DateTime, todayDate)
            .input('fven', sql.DateTime, todayDate)
            .input('cdocu', sql.Char(2), docType)
            .input('ndocu', sql.Char(12), ndocu)
            .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
            .input('nomcli', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
            .input('ruccli', sql.Char(11), (body.ruccli || '').substring(0, 11))
            .input('totn', sql.Decimal(18, 4), totalVenta)   // TOTAL
            .input('toti', sql.Decimal(18, 4), totalIGV)     // IGV
            .input('tota', sql.Decimal(18, 4), totalAfecto)  // AFECTO (Base)
            .input('mone', sql.Char(1), currency || 'S')
            .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
            .input('codpto', sql.Char(2), (sedeCode || '01').substring(0, 2))
            .input('codalm', sql.Char(2), (warehouse || '01').substring(0, 2))
            .input('idapecaj', sql.Int, idApeCaj)
            .input('selpago', sql.Int, paymentMethod || 1)
            .input('codtar', sql.Char(2), (body.codtar || '').substring(0, 2))
            .input('codusu', sql.Char(3), 'POS') // Solo 3 caracteres permitidos
            .input('flag', sql.Char(1), flagValue)
            .input('tfact', sql.Char(1), tfactValue)
            .input('codcdv', sql.Char(2), '01')
            .input('codvta', sql.Char(2), '01')
            .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
            .input('codsub', sql.Char(2), '03')
            .query(`
                INSERT INTO mst01fac (fecha, fven, cdocu, ndocu, codcli, nomcli, ruccli, totn, toti, tota, mone, tcam, codpto, CodAlm, idapecaj, selpago, codtar, codusu, flag, tfact, Codcdv, codvta, codven, codsub)
                VALUES (@fecha, @fven, @cdocu, @ndocu, @codcli, @nomcli, @ruccli, @totn, @toti, @tota, @mone, @tcam, @codpto, @codalm, @idapecaj, @selpago, @codtar, @codusu, @flag, @tfact, @codcdv, @codvta, @codven, @codsub)
            `);

        // 4. Insertar Detalle (dtl01fac) y Actualizar Stock
        const stockField = `stk${(warehouse || '01').padStart(2, '0')}`;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Insertar Detalle
            // Desglose de montos por ítem según tipo de documento
            const itemTotalConIGV = item.price * item.quantity;
            const itemPriceNeto = isNota ? item.price : (item.price / 1.18);
            const itemTotalNeto = isNota ? itemTotalConIGV : (itemPriceNeto * item.quantity);
            const itemAigv = isNota ? 'N' : 'S';

            await transaction.request()
                .input('fecha', sql.DateTime, todayDate)
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('tfact', sql.Char(1), tfactValue)
                .input('item', sql.Decimal(18, 4), (i + 1))
                .input('codi', sql.Char(20), (item.code || '').substring(0, 20))
                .input('descr', sql.Char(80), (item.name || '').substring(0, 80))
                .input('cant', sql.Decimal(18, 6), item.quantity)
                .input('preu', sql.Decimal(18, 6), itemPriceNeto)
                .input('tota', sql.Decimal(18, 4), itemTotalNeto)
                .input('totn', sql.Decimal(18, 4), itemTotalConIGV)
                .input('codalm', sql.Char(2), (warehouse || '01').substring(0, 2))
                .input('flag', sql.Char(1), flagValue)
                .input('aigv', sql.Char(1), itemAigv)
                .input('mone', sql.Char(1), 'S')
                .input('msto', sql.Char(1), 'S')
                .query(`
                    INSERT INTO dtl01fac (fecha, cdocu, ndocu, tfact, item, codi, descr, cant, preu, tota, totn, Codalm, flag, aigv, mone, moneitm, tcam, msto)
                    VALUES (@fecha, @cdocu, @ndocu, @tfact, @item, @codi, @descr, @cant, @preu, @tota, @totn, @codalm, @flag, @aigv, @mone, @mone, 1, @msto)
                `);

            // Actualizar Stock (Almacén + Consolidado)
            await transaction.request()
                .input('codi', sql.Char(15), item.id)
                .input('cant', sql.Float, item.quantity)
                .query(`
                    UPDATE prd0101 
                    SET ${stockField} = ${stockField} - @cant,
                        stoc = stoc - @cant 
                    WHERE codi = @codi
                `);
        }

        // 5. Actualizar el correlativo para la siguiente venta
        await transaction.request()
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .input('nextCor', sql.Char(12), nextNdocu)
            .query("UPDATE tbl01cor SET nroini = @nextCor WHERE cdocu = @cdocu AND codpto = @codpto");

        // 6. Insertar en Cuentas por Cobrar (mst01ccc)
        await transaction.request()
            .input('fecha', sql.DateTime, todayDate)
            .input('cdocu', sql.Char(2), docType)
            .input('ndocu', sql.Char(12), ndocu)
            .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
            .input('nomcli', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
            .input('ruccli', sql.Char(11), (body.ruccli || '').substring(0, 11))
            .input('monto', sql.Decimal(18, 4), totalVenta)
            .input('saldo', sql.Decimal(18, 4), totalVenta)
            .input('fven', sql.DateTime, todayDate)
            .input('mone', sql.Char(1), 'S')
            .input('tcam', sql.Decimal(18, 4), 1)
            .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
            .input('codpto', sql.Char(2), (sedeCode || '01').substring(0, 2))
            .input('codsub', sql.Char(2), '03')
            .input('payFlag', sql.Char(1), paymentMethod === 3 ? 'T' : 'E')
            .input('payCard', sql.Char(2), paymentMethod === 3 ? (body.codtar || '').substring(0, 2) : '')
            .query(`
                INSERT INTO mst01ccc (fecha, cdocu, ndocu, crefe, nrefe, codcli, nomcli, ruccli, codcdv, monto, saldo, fven, mone, tcam, flag, flagi, codven, codpto, codsub, codbco)
                VALUES (@fecha, @cdocu, @ndocu, @cdocu, @ndocu, @codcli, @nomcli, @ruccli, '01', @monto, @saldo, @fven, @mone, @tcam, @payFlag, '0', @codven, @codpto, @codsub, @payCard)
            `);

        await transaction.commit();

        return NextResponse.json({
            success: true,
            message: 'Venta finalizada con éxito',
            documentNumber: ndocu
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Transaction error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

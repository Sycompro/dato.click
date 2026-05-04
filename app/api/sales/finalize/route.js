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
        warehouse: bodyWarehouse,
        currency = 'S',
        exchangeRate = 1
    } = body;

    const pool = await getConnection(session?.user?.company);
    
    // DETERMINAR ALMACÉN REAL (Fase 1 Mejorada)
    const sedeCode = session?.user?.sedeId || '01'; // codpto
    let warehouse = bodyWarehouse || '01';
    
    try {
        const ptoRes = await pool.request()
            .input('codpto', sql.Char(6), sedeCode)
            .query("SELECT codtie FROM tbl01pto WHERE codpto = @codpto");
        
        if (ptoRes.recordset.length > 0) {
            const codtie = ptoRes.recordset[0].codtie.trim();
            const almRes = await pool.request()
                .input('codtie', sql.Char(3), codtie)
                .query("SELECT TOP 1 codalm FROM tbl01Alm WHERE codtie = @codtie");
            
            if (almRes.recordset.length > 0) {
                warehouse = almRes.recordset[0].codalm.trim();
            }
        }
    } catch (e) {
        console.warn("Error determinando almacén, usando fallback:", e.message);
    }
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

        // Actualizar el correlativo en la base de datos inmediatamente
        await transaction.request()
            .input('nextNdocu', sql.Char(12), nextNdocu)
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .query("UPDATE tbl01cor SET nroini = @nextNdocu WHERE cdocu = @cdocu AND codpto = @codpto");

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
        
        // Fecha y Hora local de Perú para el ERP
        // Fecha local de Perú (YYYY-MM-DD) sin desfase UTC
        const fechaStr = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'America/Lima',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        // 3. Inserción de Cobranza Mixta (SIEMPRE si es mixto o tarjeta/billetera)
        const payments = body.payments || [];
        const isMixed = payments.length > 1;
        const isSingleNonCash = payments.length === 1 && payments[0].type !== 1;
        
        // Determinar selpago global para mst01fac
        // Si es mixto o digital único -> selpago 4 (según análisis ERP)
        // Si es efectivo único -> selpago 1
        let globalSelPago = 1;
        let globalCodFdp = '01';
        let globalCodTar = '  ';
        let globalCompro = '';

        if (isMixed || isSingleNonCash) {
            globalSelPago = 4;
            globalCodFdp = '  ';
            globalCodTar = '0 '; 
        } else if (payments.length === 1) {
            const p = payments[0];
            globalSelPago = p.type;
            globalCodFdp = (p.type === 1) ? '01' : '02';
            
            // MAPEO OFICIAL NAVASOFT (Fase 4)
            // 'YAPE_QR' -> '04', 'YAPE_NUM' -> '06', 'CARD' -> '07', 'EF' -> '  '
            if (p.id === 'EF' || p.type === 1) {
                globalCodTar = '  ';
            } else if (p.id?.includes('YAPE') && p.id?.includes('QR')) {
                globalCodTar = '04';
            } else if (p.id?.includes('YAPE')) {
                globalCodTar = '06';
            } else {
                globalCodTar = '07'; // Genérico para tarjetas
            }
            globalCompro = p.voucher ? p.voucher.substring(0, 6) : '';
        }


        const comproBase = globalSelPago === 3 ? `${globalCodTar}/` : '';
        const codscc = '00';
        const userCode = session?.user?.id?.toString().padStart(3, '0').slice(0, 3) || 'POS';

        try {
            await transaction.request()
                .input('fecha', sql.VarChar(10), fechaStr)
                .input('fven', sql.VarChar(10), fechaStr)
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
                .input('nomcli', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
                .input('ruccli', sql.Char(11), (body.ruccli || '').substring(0, 11))
                .input('totn', sql.Decimal(18, 4), totalVenta)
                .input('toti', sql.Decimal(18, 4), totalIGV)
                .input('tota', sql.Decimal(18, 4), totalAfecto)
                .input('mone', sql.Char(1), currency || 'S')
                .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                .input('codpto', sql.Char(2), (sedeCode || '01').substring(0, 2))
                .input('codalm', sql.Char(2), (warehouse || '01').substring(0, 2))
                .input('idapecaj', sql.Int, idApeCaj)
                .input('selpago', sql.Int, globalSelPago)
                .input('codfdp', sql.Char(2), globalCodFdp)
                .input('codtar', sql.Char(2), globalCodTar)
                .input('compro', sql.Char(6), (globalCompro || comproBase).substring(0, 6))
                .input('codscc', sql.Char(2), codscc)
                .input('codusu', sql.Char(3), userCode)
                .input('monrecib', sql.Char(1), 'S')
                .input('monvuelto', sql.Char(1), 'S')
                .input('flag', sql.Char(1), flagValue)
                .input('tfact', sql.Char(1), tfactValue)
                .input('codcdv', sql.Char(2), '01')
                .input('codvta', sql.Char(2), '01')
                .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
                .input('codsub', sql.Char(2), (globalSelPago === 1) ? '01' : '03')
                .query(`
                    INSERT INTO mst01fac (fecha, fven, cdocu, ndocu, codcli, nomcli, ruccli, totn, toti, tota, mone, tcam, codpto, CodAlm, idapecaj, selpago, codfdp, codtar, compro, codscc, codusu, monrecib, monvuelto, flag, tfact, Codcdv, codvta, codven, codsub)
                    VALUES (@fecha, @fven, @cdocu, @ndocu, @codcli, @nomcli, @ruccli, @totn, @toti, @tota, @mone, @tcam, @codpto, @codalm, @idapecaj, @selpago, @codfdp, @codtar, @compro, @codscc, @codusu, @monrecib, @monvuelto, @flag, @tfact, @codcdv, @codvta, @codven, @codsub)
                `);

            // 3.5 Inserción Detalle de Cobros (dtl_restpos_cobmixta)
            if (isMixed || isSingleNonCash) {
                for (const p of payments) {
                    await transaction.request()
                        .input('cdocu', sql.Char(2), docType)
                        .input('ndocu', sql.Char(12), ndocu)
                        .input('codtar', sql.Char(2), (p.id === 'EF' ? 'NS' : p.id).substring(0, 2))
                        .input('recib', sql.Decimal(18, 4), p.amount)
                        .input('totn', sql.Decimal(18, 4), p.amount)
                        .input('selpago', sql.Int, (p.id === 'EF' ? 1 : 3)) // 1: Efectivo, 3: Digital (según análisis)
                        .input('impper', sql.Decimal(18, 4), 0)
                        .input('cajrecib', sql.Decimal(18, 4), (p.id === 'EF' ? p.amount : 0))
                        .input('monrecib', sql.Char(1), (p.id === 'EF' ? 'S' : ' '))
                        .input('cajvuelto', sql.Decimal(18, 4), 0)
                        .input('monvuelto', sql.Char(1), (p.id === 'EF' ? 'S' : ' '))
                        .query(`
                            INSERT INTO dtl_restpos_cobmixta (cdocu, ndocu, codtar, recib, totn, selpago, impper, cajrecib, monrecib, cajvuelto, monvuelto)
                            VALUES (@cdocu, @ndocu, @codtar, @recib, @totn, @selpago, @impper, @cajrecib, @monrecib, @cajvuelto, @monvuelto)
                        `);
                }
            }
        } catch (sqlErr) {
            console.error('SQL Error in mst01fac:', sqlErr);
            throw sqlErr;
        }

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
                .input('fecha', sql.VarChar(10), fechaStr)
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('tfact', sql.Char(1), tfactValue)
                .input('item', sql.Decimal(18, 4), (i + 1))
                .input('codi', sql.Char(11), (item.id || '').substring(0, 11))
                .input('descr', sql.Char(80), (item.name || '').substring(0, 80))
                .input('cant', sql.Decimal(18, 6), item.quantity)
                .input('preu', sql.Decimal(18, 6), itemPriceNeto)
                .input('tota', sql.Decimal(18, 4), itemTotalNeto)
                .input('totn', sql.Decimal(18, 4), itemTotalConIGV)
                .input('codalm', sql.Char(2), (warehouse || '01').substring(0, 2))
                .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
                .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
                .input('codvta', sql.Char(2), '01')
                .input('codcdv', sql.Char(2), '01')
                .input('flag', sql.Char(1), flagValue)
                .input('aigv', sql.Char(1), itemAigv)
                .input('mone', sql.Char(1), 'S')
                .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                .input('msto', sql.Char(1), 'S')
                .query(`
                    INSERT INTO dtl01fac (fecha, cdocu, ndocu, tfact, item, codi, descr, cant, preu, tota, totn, Codalm, codcli, codven, codvta, codcdv, flag, aigv, mone, moneitm, tcam, msto)
                    VALUES (@fecha, @cdocu, @ndocu, @tfact, @item, @codi, @descr, @cant, @preu, @tota, @totn, @codalm, @codcli, @codven, @codvta, @codcdv, @flag, @aigv, @mone, @mone, @tcam, @msto)
                `);

            // Actualizar Stock (Almacén + Consolidado)
            await transaction.request()
                .input('codi', sql.Char(11), item.id)
                .input('cant', sql.Float, item.quantity)
                .query(`
                    UPDATE prd0101 
                    SET ${stockField} = ${stockField} - @cant,
                        stoc = stoc - @cant 
                    WHERE codi = @codi
                `);

            // 4.5 Insertar en Kardex (kdd01XX) para trazabilidad (Fase 2)
            const kardexTable = `kdd01${(warehouse || '01').padStart(2, '0')}`;
            try {
                await transaction.request()
                    .input('fecha', sql.VarChar(10), fechaStr)
                    .input('cdocu', sql.Char(2), docType)
                    .input('ndocu', sql.Char(12), ndocu)
                    .input('codn', sql.Char(2), '00')
                    .input('nomb', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
                    .input('tmov', sql.Char(1), 'S') // S = Salida
                    .input('codi', sql.Char(11), (item.id || '').substring(0, 11))
                    .input('cant', sql.Decimal(18, 6), item.quantity)
                    .input('preu', sql.Decimal(18, 6), itemPriceNeto)
                    .input('tota', sql.Decimal(18, 4), itemTotalNeto)
                    .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                    .input('mone', sql.Char(1), currency || 'S')
                    .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
                    .input('CodPto', sql.Char(2), (sedeCode || '01').substring(0, 2))
                    .input('aigv', sql.Char(1), itemAigv)
                    .query(`
                        INSERT INTO ${kardexTable} (fecha, cdocu, ndocu, codn, nomb, tmov, codi, cant, preu, tota, tcam, mone, codven, CodPto, aigv)
                        VALUES (@fecha, @cdocu, @ndocu, @codn, @nomb, @tmov, @codi, @cant, @preu, @tota, @tcam, @mone, @codven, @CodPto, @aigv)
                    `);
            } catch (kardexErr) {
                console.error(`Error insertando en Kardex ${kardexTable}:`, kardexErr.message);
                // No lanzamos error para no bloquear la venta, pero lo logueamos
            }
        }

        // 5. Actualizar el correlativo para la siguiente venta
        await transaction.request()
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .input('nextCor', sql.Char(12), nextNdocu)
            .query("UPDATE tbl01cor SET nroini = @nextCor WHERE cdocu = @cdocu AND codpto = @codpto");

        // 6. Insertar en Cuentas por Cobrar (mst01ccc)
        await transaction.request()
            .input('fecha', sql.VarChar(10), fechaStr)
            .input('cdocu', sql.Char(2), docType)
            .input('ndocu', sql.Char(12), ndocu)
            .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
            .input('nomcli', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
            .input('ruccli', sql.Char(11), (body.ruccli || '').substring(0, 11))
            .input('monto', sql.Decimal(18, 4), totalVenta)
            .input('saldo', sql.Decimal(18, 4), totalVenta)
            .input('fven', sql.VarChar(10), fechaStr)
            .input('mone', sql.Char(1), 'S')
            .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
            .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
            .input('codpto', sql.Char(2), (sedeCode || '01').substring(0, 2))
            .input('codsub', sql.Char(2), (globalSelPago === 1) ? '01' : '03')
            .input('compro_ccc', sql.Char(6), comproBase)
            .input('codscc', sql.Char(2), codscc)
            .query(`
                INSERT INTO mst01ccc (fecha, cdocu, ndocu, crefe, nrefe, codcli, nomcli, ruccli, codcdv, monto, saldo, fven, mone, tcam, flag, flagi, codven, codpto, codsub, compro, codscc)
                VALUES (@fecha, @cdocu, @ndocu, @cdocu, @ndocu, @codcli, @nomcli, @ruccli, '01', @monto, @saldo, @fven, @mone, @tcam, '0', '0', @codven, @codpto, @codsub, @compro_ccc, @codscc)
            `);

        // 6. Insertar en dtl01ccc (Solo Factura necesita esto para visibilidad en caja)
        if (docType === '01') {
            await transaction.request()
                .input('fecha', sql.VarChar(10), fechaStr)
                .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('monto', sql.Decimal(18, 4), totalVenta)
                .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                .input('glosa', sql.Char(50), (items[0]?.name || 'VENTA WEB').substring(0, 50))
                .query(`
                    INSERT INTO dtl01ccc (fecha, codcli, tmov, cdocu, ndocu, crefe, nrefe, glosa, cargo, abono, mone, tcam, cpago, mpago, npago, ipago, nplan, idunico, fecreg, compro)
                    VALUES (@fecha, @codcli, 'C', @cdocu, @ndocu, @cdocu, @ndocu, @glosa, @monto, 0, 'S', @tcam, '', '', '', 0, '', NEWID(), GETDATE(), '03/')
                `);
        }

        let membershipDates = null;
        if (codcli && codcli !== '000000' && codcli !== 'NUEVO_ERP' && codcli !== 'INTERNO') {
            const customerPhone = body.phone || '';
            const customerBirthdate = body.birthdate ? new Date(body.birthdate) : null;
            
            const daysToAdd = items.reduce((acc, item) => acc + ((item.membershipDays || 0) * (item.quantity || 1)), 0);

            if (daysToAdd > 0) {
                const currentCliRes = await transaction.request()
                    .input('codcli', sql.Char(6), codcli.substring(0, 6))
                    .query("SELECT fecfinpres FROM mst01cli WHERE codcli = @codcli");
                
                let currentExp = currentCliRes.recordset[0]?.fecfinpres;
                let startDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Lima"}));
                startDate.setHours(0,0,0,0);

                let baseDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Lima"}));
                baseDate.setHours(0,0,0,0);

                if (currentExp && new Date(currentExp) > baseDate) {
                    baseDate = new Date(currentExp);
                    baseDate.setHours(0,0,0,0);
                }

                const newExpDate = new Date(baseDate);
                newExpDate.setDate(newExpDate.getDate() + daysToAdd);

                membershipDates = {
                    startDate: startDate.toLocaleDateString('es-PE'),
                    endDate: newExpDate.toLocaleDateString('es-PE')
                };

                await transaction.request()
                    .input('codcli', sql.Char(6), codcli.substring(0, 6))
                    .input('celcli', sql.VarChar(40), customerPhone)
                    .input('fecnac', sql.DateTime, customerBirthdate)
                    .input('fecinipres', sql.DateTime, startDate)
                    .input('fecfinpres', sql.DateTime, newExpDate)
                    .query(`
                        UPDATE mst01cli 
                        SET celcli = @celcli, fecnac = @fecnac, fecinipres = @fecinipres, fecfinpres = @fecfinpres
                        WHERE codcli = @codcli
                    `);
            } else {
                // Actualizar solo celular y nacimiento si no hay membresía
                await transaction.request()
                    .input('codcli', sql.Char(6), codcli.substring(0, 6))
                    .input('celcli', sql.VarChar(40), customerPhone)
                    .input('fecnac', sql.DateTime, customerBirthdate)
                    .query(`
                        UPDATE mst01cli 
                        SET celcli = @celcli, fecnac = @fecnac 
                        WHERE codcli = @codcli
                    `);
            }
        }

        await transaction.commit();

        return NextResponse.json({
            success: true,
            message: 'Venta finalizada con éxito',
            documentNumber: ndocu,
            total: totalVenta,
            base: totalAfecto,
            igv: totalIGV,
            membershipInfo: membershipDates
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Transaction error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

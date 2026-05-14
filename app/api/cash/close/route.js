import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request) {
    try {
        const body = await request.json();
        const { idapecaj, totals } = body; 

        if (!idapecaj) {
            return NextResponse.json({ success: false, error: 'ID de apertura requerido' }, { status: 400 });
        }

        const session = await getServerSession(authOptions);
        const pool = await getConnection(session?.user?.company);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const now = new Date();
            // Usamos fecha local en formato YYYY-MM-DD para evitar problemas de zona horaria (UTC+X)
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const fechaStr = `${year}-${month}-${day}`;
            
            // Tipo de cambio dinámico desde la BD
            let tcamOficial = 1;
            try {
                const tcaRes = await transaction.request()
                    .query("SELECT TOP 1 tcvta FROM tbl01tca WHERE tcvta > 0 ORDER BY fecha DESC");
                if (tcaRes.recordset.length > 0 && tcaRes.recordset[0].tcvta > 0) {
                    tcamOficial = Number(tcaRes.recordset[0].tcvta.toFixed(4));
                    console.log(`[API/Cash/Close] TC obtenido de tbl01tca: ${tcamOficial}`);
                } else {
                    console.warn("[API/Cash/Close] tbl01tca sin datos, usando TC = 1");
                }
            } catch (e) {
                console.warn("[API/Cash/Close] Error leyendo tbl01tca:", e.message, "- usando TC = 1");
            }
            const codusu = session?.user?.id?.toString().padStart(3, '0').slice(0, 3) || 'POS';

            // 1. Datos de la apertura
            const apeRes = await transaction.request()
                .input('id', sql.Int, idapecaj)
                .query('SELECT codpto, nropla, fecape FROM dtl_restpos_apecaj WHERE idapecaj = @id');
            
            if (apeRes.recordset.length === 0) throw new Error("No se encontró la apertura");
            const { codpto: erpPto, nropla: erpNroPla, fecape } = apeRes.recordset[0];
            const planillaOficial = erpNroPla.trim().substring(0, 12);

            // 2. Control Interno (Arqueo)
            // Calculamos el siguiente ID de Arqueo para esta sesión
            const lastArqueoRes = await transaction.request()
                .input('idapecaj', sql.Int, idapecaj)
                .query('SELECT ISNULL(MAX(idarqueo), 0) + 1 as nextId FROM dtl_restpos_arqueo WHERE idapecaj = @idapecaj');
            const nextIdArqueo = lastArqueoRes.recordset[0].nextId;

            let currentIdArqueo = nextIdArqueo;
            for (let i = 0; i < totals.length; i++) {
                const item = totals[i];
                await transaction.request()
                    .input('idapecaj', sql.Int, idapecaj)
                    .input('idarqueo', sql.Int, currentIdArqueo)
                    .input('selpago', sql.Int, item.selpago)
                    .input('codtar', sql.Char(2), (item.codtar || '  ').substring(0, 2))
                    .input('fecha', sql.DateTime, now)
                    .input('codusu', sql.Char(3), codusu.substring(0, 3))
                    .input('totnfis', sql.Decimal(18, 4), Number((item.totnfis || item.totnsis).toFixed(2)))
                    .input('totnsis', sql.Decimal(18, 4), Number(item.totnsis.toFixed(2)))
                    .query(`
                        INSERT INTO dtl_restpos_arqueo (idapecaj, idarqueo, selpago, codtar, fecha, codusu, totnfis, totnsis, obser)
                        VALUES (@idapecaj, @idarqueo, @selpago, @codtar, @fecha, @codusu, @totnfis, @totnsis, '')
                    `);
                currentIdArqueo++;
            }

            // 3. CONSOLIDACIÓN PERFECTA (RIC 38)
            const salesRes = await transaction.request()
                .input('id', sql.Int, idapecaj)
                .query(`
                    SELECT ndocu, cdocu, totn, codcli, nomcli, codven
                    FROM mst01fac 
                    WHERE idapecaj = @id AND flag <> '*'
                `);

            if (salesRes.recordset.length > 0) {
                const totalMonto = salesRes.recordset.reduce((acc, curr) => acc + curr.totn, 0);
                const totalMontoRed = Number(totalMonto.toFixed(2));
                
                // Formatear fecha para glosas
                const fecape_date = new Date(fecape);
                const fecape_formatted = `${fecape_date.getDate().toString().padStart(2, '0')}/${(fecape_date.getMonth() + 1).toString().padStart(2, '0')}/${fecape_date.getFullYear()}`;
                
                // Correlativo Oficial
                const corRes = await transaction.request()
                    .input('cdocu', '38').input('codpto', erpPto)
                    .query(`SELECT nroini FROM tbl01cor WHERE cdocu = @cdocu AND codpto = @codpto`);

                let nroRIC;
                if (corRes.recordset[0]) {
                    const currentNro = corRes.recordset[0].nroini.trim();
                    const parts = currentNro.split('-');
                    const series = parts[0];
                    const numPart = (parts[1] || parts[0]).replace(/[^0-9]/g, '');
                    const nextNum = (parseInt(numPart, 10) + 1).toString().padStart(numPart.length, '0');
                    nroRIC = `${series}-${nextNum}`.substring(0, 12);

                    await transaction.request()
                        .input('nextNro', nroRIC).input('cdocu', '38').input('codpto', erpPto)
                        .query(`UPDATE tbl01cor SET nroini = @nextNro WHERE cdocu = @cdocu AND codpto = @codpto`);
                } else {
                    nroRIC = `R${erpPto}-${idapecaj.toString().padStart(7, '0')}`.substring(0, 12);
                }

                // 3.1 Calcular correlativo de Voucher (compro) Adaptativo
                const lastRicRes = await transaction.request()
                    .query("SELECT TOP 1 compro FROM mst01cob WHERE cdocu = '38' AND compro LIKE '%/%' ORDER BY fecreg DESC");
                
                let comproPrefix = '05/';
                if (lastRicRes.recordset.length > 0) {
                    const lastCompro = lastRicRes.recordset[0].compro;
                    comproPrefix = lastCompro.split('/')[0] + '/';
                }

                const lastComproMonthRes = await transaction.request()
                    .input('prefix', comproPrefix + '%')
                    .query(`
                        SELECT MAX(compro) as lastCompro 
                        FROM mst01cob 
                        WHERE compro LIKE @prefix 
                        AND MONTH(fecreg) = MONTH(GETDATE()) 
                        AND YEAR(fecreg) = YEAR(GETDATE())
                    `);
                
                let nextVoucherNumber = 1;
                if (lastComproMonthRes.recordset[0].lastCompro) {
                    const parts = lastComproMonthRes.recordset[0].lastCompro.split('/');
                    if (parts.length === 2) {
                        nextVoucherNumber = parseInt(parts[1]) + 1;
                    }
                }
                const comproOficial = comproPrefix + nextVoucherNumber.toString().padStart(6, '0');

                // 4. Cabecera Maestra (mst01cob) - RIC
                const nomCliOficial = `VTA.CONT.${fecape_formatted} PTO: ${erpPto}`.substring(0, 50);
                const glosaOficial = nomCliOficial.substring(0, 40);
                await transaction.request()
                    .input('fecha', sql.Date, fechaStr).input('cdocu', '38').input('ndocu', nroRIC)
                    .input('nplan', planillaOficial).input('compro', comproOficial)
                    .input('cliente', nomCliOficial)
                    .input('monto', sql.Decimal(18, 4), totalMontoRed)
                    .input('glosa', glosaOficial)
                    .input('codpto', erpPto)
                    .input('tcam', sql.Decimal(18, 4), tcamOficial)
                    .input('codven', 'V0001')
                    .query(`
                        INSERT INTO mst01cob (
                            fecha, cdocu, ndocu, codcli, nomcli, mone, tcam, monto, nplan, compro, 
                            fecreg, flagc, codven, codpto, codsub, codglv, codcob, tmov, glosa,
                            flag, crefe, nrefe, npago, tcheq, fven, fCierre, codcdv, cpago
                        )
                        VALUES (
                            @fecha, @cdocu, @ndocu, 'C00000', @cliente, 'S', @tcam, @monto, @nplan, @compro, 
                            GETDATE(), 'C', @codven, @codpto, '00', '000', 'V0001', 'I', @glosa,
                            '1', '38', @ndocu, @ndocu, 'N', @fecha, GETDATE(), '01', 'E'
                        )
                    `);

                // 5. Vincular Documentos y Desglosar Pagos
                for (const sale of salesRes.recordset) {
                    const paymentsBreakdown = await transaction.request()
                        .input('cdocu', sale.cdocu).input('ndocu', sale.ndocu)
                        .query(`SELECT codtar, recib as monto FROM dtl_restpos_cobmixta WHERE cdocu = @cdocu AND ndocu = @ndocu`);

                    const payments = paymentsBreakdown.recordset.length > 0 
                        ? paymentsBreakdown.recordset 
                        : [{ codtar: 'NS', monto: sale.totn }];

                    for (const p of payments) {
                        const isCash = (p.codtar === 'NS' || !p.codtar || p.codtar.trim() === '');
                        const cpago = isCash ? 'E' : 'T';
                        const codbco = isCash ? '  ' : p.codtar;
                        const montoPart = Number(Number(p.monto).toFixed(4));

                        await transaction.request()
                            .input('cdocu', '38').input('ndocu', nroRIC)
                            .input('crefe', sale.cdocu).input('nrefe', sale.ndocu)
                            .input('monto', sql.Decimal(18, 4), montoPart)
                            .input('cpago', cpago).input('npago', '            ')
                            .input('mone', 'S').input('tcam', 1)
                            .input('codbco', codbco).input('codven', 'V0001')
                            .input('nplan', planillaOficial)
                            .input('valori', sql.Decimal(18, 4), montoPart)
                            .input('monori', 'S')
                            .query(`
                                INSERT INTO dtl01cob (cdocu, ndocu, crefe, nrefe, monto, cpago, npago, mone, tcam, codbco, codven, nplan, valori, monori, mtopad, mtopas, codn, impdonac)
                                VALUES (@cdocu, @ndocu, @crefe, @nrefe, @monto, @cpago, @npago, @mone, @tcam, @codbco, @codven, @nplan, @valori, @monori, 0, @monto, '      ', 0)
                            `);

                        await transaction.request()
                            .input('fecha', sql.Date, fechaStr).input('codcli', sale.codcli)
                            .input('cdocu', '38').input('ndocu', nroRIC)
                            .input('crefe', sale.cdocu.substring(0, 2)).input('nrefe', sale.ndocu.substring(0, 12))
                            .input('glosa', glosaOficial)
                            .input('abono', sql.Decimal(18, 4), montoPart)
                            .input('tcam', sql.Decimal(18, 4), tcamOficial)
                            .input('nplan', planillaOficial)
                            .input('compro', comproOficial)
                            .input('cpago', sql.Char(1), cpago)
                            .input('npago', sql.Char(12), codbco.padEnd(12))
                            .query(`
                                INSERT INTO dtl01ccc (fecha, codcli, tmov, cdocu, ndocu, crefe, nrefe, glosa, cargo, abono, mone, tcam, cpago, mpago, npago, ipago, nplan, idunico, fecreg, compro)
                                VALUES (@fecha, @codcli, 'A', @cdocu, @ndocu, @crefe, @nrefe, @glosa, 0, @abono, 'S', @tcam, @cpago, ' ', @npago, 0, @nplan, NEWID(), GETDATE(), @compro)
                            `);
                    }

                    // 5.1 Actualizar mst01ccc: saldo=0, flag='1' (como hace el ERP real)
                    await transaction.request()
                        .input('ndocu', sale.ndocu)
                        .query(`UPDATE mst01ccc SET saldo = 0, flag = '1' WHERE ndocu = @ndocu`);
                }

                // --- 5.5 GENERACIÓN DEL ASIENTO CONTABLE (LÓGICA DE ESPEJO) ---
                const cgmTable = `cgm0102${year}`;
                const comproNum = comproOficial.split('/')[1] || comproOficial;
                let idComproSeq = 1;

                for (const sale of salesRes.recordset) {
                    const pRes = await transaction.request()
                        .input('cdocu', sale.cdocu).input('ndocu', sale.ndocu)
                        .query(`SELECT codtar, recib as monto FROM dtl_restpos_cobmixta WHERE cdocu = @cdocu AND ndocu = @ndocu`);

                    const salePayments = pRes.recordset.length > 0 ? pRes.recordset : [{ codtar: 'NS', monto: sale.totn }];

                    for (const p of salePayments) {
                        const montoSolPart = Number(p.monto || 0);
                        const montoUSDPart = Number((montoSolPart / tcamOficial).toFixed(2));
                        const glosaDetalle = `VTA.CONT: ${(sale.nomcli || 'VENTA CONTADO')}`.substring(0, 40);
                        const isCash = (p.codtar === 'NS' || !p.codtar || p.codtar.trim() === '');
                        const accountDebe = isCash ? '10111' : '10174';

                    // 1. LÍNEA AL HABER (12121)
                    await transaction.request()
                        .input('ano', sql.Char(4), year.toString())
                        .input('mes', sql.Char(2), month).input('dia', sql.Char(2), day)
                        .input('compro', sql.Char(6), comproNum)
                        .input('cuenta', sql.Char(12), '12121'.padEnd(12))
                        .input('glosa', sql.VarChar(50), glosaDetalle)
                        .input('tmovim', sql.Char(1), 'H') // Estándar BD01: H (Haber)
                        .input('debe', sql.Decimal(18, 4), 0)
                        .input('haber', sql.Decimal(18, 4), montoSolPart)
                        .input('debed', sql.Decimal(18, 4), 0)
                        .input('haberd', sql.Decimal(18, 4), montoUSDPart)
                        .input('tcam', sql.Decimal(18, 4), tcamOficial)
                        .input('idcompro', sql.Int, idComproSeq)
                        .input('codsub', sql.Char(2), 'VC')
                        .input('coddoc', sql.Char(2), '38')
                        .input('nrodoc', sql.Char(12), nroRIC.substring(0, 12))
                        .input('docref', sql.Char(2), sale.cdocu.substring(0, 2))
                        .input('nroref', sql.Char(12), sale.ndocu.substring(0, 12))
                        .input('nomref', sql.VarChar(30), (sale.nomcli || 'VENTA CONTADO').substring(0, 30))
                        .query(`
                            INSERT INTO ${cgmTable} (
                                ano_as, mes_as, dia_as, origen, compro, cuenta, glosa, tmovim, debe, haber, debed, haberd, 
                                tipcam, idcompro, codsub, moneda, estado, fechao, coddoc, nrodoc, docref, nroref, idrefe, nomref, 
                                fpago, detfec, crefe, cfcdocu, cffpago, ccosto, codpos, gcosto, amarre, cpago
                            )
                            VALUES (
                                @ano, @mes, @dia, '05', @compro, @cuenta, @glosa, @tmovim, @debe, @haber, @debed, @haberd, 
                                @tcam, @idcompro, @codsub, 'S', '1', GETDATE(), @coddoc, @nrodoc, @docref, @nroref, 'C00000', @nomref, 
                                '1900-01-01', '1900-01-01', '  ', '  ', '1900-01-01', '            ', '             ', 'N', 'N', '000'
                            )
                        `);
                    idComproSeq++;

                    // 2. LÍNEA AL DEBE (Caja/Tarjeta)
                    await transaction.request()
                        .input('ano', sql.Char(4), year.toString())
                        .input('mes', sql.Char(2), month).input('dia', sql.Char(2), day)
                        .input('compro', sql.Char(6), comproNum)
                        .input('cuenta', sql.Char(12), accountDebe.padEnd(12))
                        .input('glosa', sql.VarChar(50), glosaOficial.substring(0, 50))
                        .input('tmovim', sql.Char(1), 'D') // Estándar BD01: D (Debe)
                        .input('debe', sql.Decimal(18, 4), montoSolPart)
                        .input('haber', sql.Decimal(18, 4), 0)
                        .input('debed', sql.Decimal(18, 4), montoUSDPart)
                        .input('haberd', sql.Decimal(18, 4), 0)
                        .input('tcam', sql.Decimal(18, 4), tcamOficial)
                        .input('idcompro', sql.Int, idComproSeq)
                        .input('codsub', sql.Char(2), 'VC')
                        .input('coddoc', sql.Char(2), '38')
                        .input('nrodoc', sql.Char(12), nroRIC.substring(0, 12))
                        .input('docref', sql.Char(2), sale.cdocu.substring(0, 2))
                        .input('nroref', sql.Char(12), sale.ndocu.substring(0, 12))
                        .input('cpago', sql.Char(3), isCash ? '009' : '000') // Estándar BD01: 009 para Efectivo
                        .query(`
                            INSERT INTO ${cgmTable} (
                                ano_as, mes_as, dia_as, origen, compro, cuenta, glosa, tmovim, debe, haber, debed, haberd, 
                                tipcam, idcompro, codsub, moneda, estado, fechao, coddoc, nrodoc, docref, nroref, idrefe, nomref, 
                                fpago, detfec, crefe, cfcdocu, cffpago, ccosto, codpos, gcosto, amarre, cpago
                            )
                            VALUES (
                                @ano, @mes, @dia, '05', @compro, @cuenta, @glosa, @tmovim, @debe, @haber, @debed, @haberd, 
                                @tcam, @idcompro, @codsub, 'S', '1', GETDATE(), @coddoc, @nrodoc, @docref, @nroref, 'C00000', 'CONTADO', 
                                '1900-01-01', '1900-01-01', '  ', '  ', '1900-01-01', '            ', '             ', 'N', 'N', @cpago
                            )
                        `);
                    idComproSeq++;
                }
            }
        }

            // 6. Finalización
            await transaction.request()
                .input('id', sql.Int, idapecaj).input('feccie', sql.DateTime, now)
                .query('UPDATE dtl_restpos_apecaj SET estado = 1, feccie = @feccie WHERE idapecaj = @id');

            if (erpPto) {
                await transaction.request().input('codpto', sql.Char(10), erpPto)
                    .query(`UPDATE tbl01pto SET estado = 1, apecaj = 0, apecajsol = 0, apecajdol = 0, apecajeur = 0, apecajusu = '   ', apecajtur = '  ' WHERE LTRIM(RTRIM(codpto)) = LTRIM(RTRIM(@codpto))`);
            }

            await transaction.commit();
            return NextResponse.json({ success: true });

        } catch (err) {
            console.error('Transaction Error:', err);
            await transaction.rollback();
            throw err;
        }

    } catch (error) {
        console.error('Error in cash close API:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

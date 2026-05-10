import sql from 'mssql';
import { getConnection } from '@/lib/db';
import logger from '@/lib/logger';
import { calculateTaxBreakdown, getWarehouseForSede } from '@/lib/erp-utils';

class NavaSaleService {
  async finalize(data, dbName, codusu) {
    const pool = await getConnection(dbName);
    const transaction = new sql.Transaction(pool);

    try {
      logger.info(`[SaleService/MSSQL] Iniciando venta nativa en ${dbName}`);

      const {
        docType, codcli, nomcli, ruccli, items, payments,
        idApeCaj, warehouse, codven, exchangeRate,
        cashReceived, changeGiven, pointOfSale
      } = data;

      // 1. Configuración de tiempo y pagos
      const now = new Date();
      const peruvianDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(now);
      const fechaStr = peruvianDate;

      const isMixed = data.isMixed || payments.length > 1;
      const primaryPayment = payments[0] || { id: 'EF', type: 1, amount: 0 };

      const globalSelPago = isMixed ? 4 : (primaryPayment.type || 1);
      const globalCodFdp = (primaryPayment.id === 'EF' || primaryPayment.type === 1) ? '01' : '02';
      const globalCodTar = (globalCodFdp === '02') ? primaryPayment.id.substring(0, 2) : '  ';
      const globalCpago = isMixed ? 'M' : (globalCodFdp === '01' ? 'E' : 'T');

      await transaction.begin();

      // 2. Obtener datos de apertura de caja
      const requestApe = new sql.Request(transaction);
      const resApe = await requestApe
        .input('idapecaj', sql.Int, idApeCaj)
        .query(`
          SELECT a.nropla, a.codpto, a.codusu, 
          (SELECT TOP 1 codfdp FROM tbl01fdp WHERE nomfdp LIKE '%EFECTIVO%') as fdpEfectivo,
          (SELECT TOP 1 codfdp FROM tbl01fdp WHERE nomfdp LIKE '%TARJETA%' OR nomfdp LIKE '%POS%') as fdpTarjeta,
          (SELECT TOP 1 codcdv FROM tbl01cdv WHERE nomcdv LIKE '%CONTADO%') as codcdv_nava
          FROM dtl_restpos_apecaj a WHERE a.idapecaj = @idapecaj
        `);

      if (!resApe.recordset[0]) throw new Error(`Sesión no encontrada: ${idApeCaj}`);

      const erpData = resApe.recordset[0];
      const erpPto = erpData.codpto.trim();
      const erpUsu = erpData.codusu.trim();
      const erpNroPla = erpData.nropla.trim();

      // 3. Gestión de Correlativo
      const requestCor = new sql.Request(transaction);
      const resCor = await requestCor
        .input('cdocu', docType)
        .input('codpto', erpPto)
        .query(`SELECT nroini FROM tbl01cor WHERE cdocu = @cdocu AND codpto = @codpto`);

      if (!resCor.recordset[0]) throw new Error(`Sin correlativo para ${docType} en punto ${erpPto}`);

      const currentNroIni = resCor.recordset[0].nroini.trim();
      const parts = currentNroIni.split('-');
      const series = parts[0];
      const numPartClean = (parts[1] || parts[0]).replace(/[^0-9]/g, '');
      const nextNum = (parseInt(numPartClean, 10) + 1).toString().padStart(numPartClean.length, '0');
      const nextNdocu = `${series}-${nextNum}`;

      await requestCor
        .input('nextNdocu', nextNdocu)
        .query(`UPDATE tbl01cor SET nroini = @nextNdocu WHERE cdocu = @cdocu AND codpto = @codpto`);

      // 4. Cálculos de Totales - LÓGICA DE PRECISIÓN NAVASOFT (Suma de Líneas)
      const navaExchangeRate = Number(exchangeRate) || 1.0;
      const navaTfact = docType === '01' ? '1' : (docType === '03' ? '2' : '5');
      const isTaxable = docType !== '65';

      let headerTotalMonto = 0;
      let headerTotalTota = 0;
      let headerTotalToti = 0;

      const processedItems = items.map(item => {
        const itemQty = item.quantity || 1;
        const itemPrice = item.price || 0;
        const itemTotal = Number((itemPrice * itemQty).toFixed(2));
        
        // REGLA NAVASOFT: Gravado (tota) a 1 decimal en cada item
        const itemSubtotal = isTaxable ? Math.round((itemTotal / 1.18) * 10) / 10 : itemTotal;
        const itemTax = isTaxable ? Number((itemTotal - itemSubtotal).toFixed(2)) : 0;
        
        // Precio unitario base (preu) a 2 decimales
        const itemNetUnitPrice = Number(((itemTotal / itemQty) / (isTaxable ? 1.18 : 1)).toFixed(2));

        headerTotalMonto += itemTotal;
        headerTotalTota += itemSubtotal;
        headerTotalToti += itemTax;

        return {
          ...item,
          itemTotal,
          itemSubtotal,
          itemTax,
          itemNetUnitPrice
        };
      });

      const breakdown = {
        total: Number(headerTotalMonto.toFixed(2)),
        subtotal: Number(headerTotalTota.toFixed(2)),
        tax: Number(headerTotalToti.toFixed(2))
      };

      // 5. Inserción de Cabecera (mst01fac)
      const finalCodCli = (codcli && codcli !== 'NUEVO_ERP' ? codcli : 'C00001').substring(0, 6);
      
      const formattedCompro = `${docType}/${nextNdocu.substring(nextNdocu.length - 6)}`;

      const reqMst = new sql.Request(transaction);
      await reqMst
        .input('cdocu', docType.substring(0, 2))
        .input('ndocu', nextNdocu.substring(0, 12))
        .input('fecha', sql.Date, fechaStr)
        .input('fven', sql.Date, fechaStr)
        .input('codcli', sql.Char(6), finalCodCli)
        .input('nomcli', sql.Char(60), (nomcli && nomcli !== 'CLIENTE VARIOS' ? nomcli : 'VENTA CONTADO').substring(0, 60))
        .input('ruccli', sql.Char(11), (ruccli || '').substring(0, 11))
        .input('totn', sql.Decimal(18, 2), breakdown.total)
        .input('toti', sql.Decimal(18, 2), breakdown.tax)
        .input('tota', sql.Decimal(18, 2), breakdown.subtotal)
        .input('mone', 'S')
        .input('tcam', sql.Decimal(18, 4), navaExchangeRate)
        .input('Codpto', erpPto)
        .input('CodAlm', await getWarehouseForSede(transaction, erpPto))
        .input('idapecaj', sql.Int, idApeCaj)
        .input('selpago', sql.Int, globalSelPago)
        .input('codfdp', isMixed ? '' : globalCodFdp)
        .input('codtar', sql.Char(2), isMixed ? '' : globalCodTar.substring(0, 2))
        .input('compro', formattedCompro)
        .input('codusu', sql.VarChar(10), codusu || '   ')
        .input('flag', '0')
        .input('tfact', navaTfact)
        .input('Codcdv', erpData.codcdv_nava || '01')
        .input('codvta', '01')
        .input('codven', (codven || 'V0001').substring(0, 5))
        .input('codsub', '03')
        .input('cajrecib', isMixed ? 0 : (globalCodFdp === '01' ? Number((cashReceived || breakdown.total).toFixed(2)) : 0))
        .input('monrecib', 'S')
        .input('cajvuelto', isMixed ? 0 : (globalCodFdp === '01' ? Number((changeGiven || 0).toFixed(2)) : 0))
        .input('monvuelto', 'S')
        .input('cobmixta', sql.Int, isMixed ? 1 : 0)
        .input('tipent', docType === '65' ? 1 : 3)
        .input('drefe', 'N')
        .input('codtra', 'T0001')
        .input('flagtp', '0')
        .query(`
          INSERT INTO mst01fac (cdocu, ndocu, fecha, fven, codcli, nomcli, ruccli, totn, toti, tota, mone, tcam, Codpto, CodAlm, idapecaj, selpago, codfdp, codtar, compro, codusu, flag, tfact, Codcdv, codvta, codven, codsub, cajrecib, cajvuelto, cobmixta, tipent, FecReg, monrecib, monvuelto, drefe, codtra, FlagTp)
          VALUES (@cdocu, @ndocu, @fecha, @fven, @codcli, @nomcli, @ruccli, @totn, @toti, @tota, @mone, @tcam, @Codpto, @CodAlm, @idapecaj, @selpago, @codfdp, @codtar, @compro, @codusu, @flag, @tfact, @Codcdv, @codvta, @codven, @codsub, @cajrecib, @cajvuelto, @cobmixta, @tipent, GETDATE(), @monrecib, @monvuelto, @drefe, @codtra, @flagtp)
        `);

      // 6. Inserción de Detalles (dtl01fac)
      for (const [idx, item] of processedItems.entries()) {
        const reqDtl = new sql.Request(transaction);
        await reqDtl
          .input('fecha', sql.Date, fechaStr)
          .input('cdocu', docType.substring(0, 2))
          .input('ndocu', nextNdocu.substring(0, 12))
          .input('tfact', navaTfact)
          .input('codcli', sql.Char(6), finalCodCli.substring(0, 6))
          .input('item', sql.Int, idx + 1)
          .input('codi', sql.Char(11), item.id.substring(0, 11))
          .input('codf', sql.Char(20), (item.userCode || '').substring(0, 20))
          .input('marc', sql.VarChar(5), (item.brand || '').substring(0, 5))
          .input('descr', item.name.substring(0, 80))
          .input('cant', sql.Decimal(18, 4), item.quantity)
          .input('preu', sql.Decimal(18, 2), item.itemNetUnitPrice)
          .input('tota', sql.Decimal(18, 2), item.itemSubtotal)
          .input('totn', sql.Decimal(18, 2), item.itemTotal)
          .input('Codalm', (warehouse || '01').substring(0, 2))
          .input('flag', '0')
          .input('tcam', sql.Decimal(18, 4), navaExchangeRate)
          .input('mone', 'S')
          .input('moneitm', item.userCode === 'DS00' ? ' ' : 'S')
          .input('umed', item.userCode === 'DS00' ? '   ' : 'UND')
          .input('aigv', isTaxable ? 'S' : 'N')
          .input('msto', item.userCode === 'DS00' ? ' ' : 'S')
          .query(`
            INSERT INTO dtl01fac (fecha, cdocu, ndocu, tfact, codcli, item, codi, codf, marc, descr, cant, preu, tota, totn, Codalm, flag, dsct, dsct2, tcam, mone, umed, aigv, msto, moneitm)
            VALUES (@fecha, @cdocu, @ndocu, @tfact, @codcli, @item, @codi, @codf, @marc, @descr, @cant, @preu, @tota, @totn, @Codalm, @flag, 0, 0, @tcam, @mone, @umed, @aigv, @msto, @moneitm)
          `);

        // 6.1 Inserción en KARDEX (kdd01XX)
        if (item.userCode !== 'DS00') {
          const kddTable = `kdd01${(warehouse || '01').substring(0, 2).padStart(2, '0')}`;
          const reqKdd = new sql.Request(transaction);
          await reqKdd
            .input('fecha', sql.Date, fechaStr)
            .input('cdocu', docType.substring(0, 2))
            .input('ndocu', nextNdocu.substring(0, 12))
            .input('codn', sql.Char(6), finalCodCli.substring(0, 6))
            .input('nomb', (nomcli || 'VENTA CONTADO').substring(0, 50))
            .input('refe', nextNdocu.substring(0, 12))
            .input('tmov', 'S')
            .input('codi', item.id.substring(0, 11))
            .input('cant', sql.Decimal(18, 4), item.quantity)
            .input('preu', sql.Decimal(18, 2), Number(item.price.toFixed(2)))
            .input('tota', sql.Decimal(18, 2), item.itemTotal)
            .input('tcam', sql.Decimal(18, 4), navaExchangeRate)
            .input('mone', 'S')
            .input('cost', sql.Decimal(18, 2), Number(item.price.toFixed(2)))
            .input('codglo', '01')
            .input('nomglo', 'MERCADERIA')
            .input('aigv', isTaxable ? 'S' : 'N')
            .input('cfac', docType.substring(0, 2))
            .input('nfac', nextNdocu.substring(0, 12))
            .input('codven', (codven || 'V0001').substring(0, 5))
            .input('codpto', (pointOfSale || '01').substring(0, 2))
            .query(`
              INSERT INTO ${kddTable} (fecha, cdocu, ndocu, codn, nomb, refe, tmov, codi, cant, preu, dsct, tota, tcam, mone, cost, codglo, nomglo, aigv, cfac, nfac, codven, CodPto, CodTur, uvta, pigv, pcfle, pcemb)
              VALUES (@fecha, @cdocu, @ndocu, @codn, @nomb, @refe, @tmov, @codi, @cant, @preu, 0, @tota, @tcam, @mone, @cost, @codglo, @nomglo, @aigv, @cfac, @nfac, @codven, @codpto, '01', 1, 0, 0, 0)
            `);

          // 6.2 DESCUENTO MANUAL DE STOCK
          const targetWarehouse = warehouse || erpPto || '01';
          const prdTable = `prd01${targetWarehouse.toString().padStart(2, '0').slice(-2)}`;
          
          const reqUpdateStock = new sql.Request(transaction);
          await reqUpdateStock
            .input('codi', item.id.substring(0, 11))
            .input('cant', sql.Decimal(18, 4), item.quantity)
            .input('fecha', sql.Date, fechaStr)
            .query(`
              IF OBJECT_ID('dbo.${prdTable}') IS NOT NULL
              BEGIN
                UPDATE ${prdTable} SET stoc = stoc - @cant, ufve = @fecha WHERE codi = @codi
              END
            `);
        }
      }

      // 6.5 Inserción en CCC
      const firstItemName = items[0]?.name.substring(0, 40) || 'VENTA WEB';
      const reqMstCcc = new sql.Request(transaction);
      await reqMstCcc
        .input('fecha', sql.Date, fechaStr)
        .input('cdocu', docType.substring(0, 2))
        .input('ndocu', nextNdocu.substring(0, 12))
        .input('crefe', docType.substring(0, 2))
        .input('nrefe', nextNdocu.substring(0, 12))
        .input('codcli', (codcli && codcli !== '000000' ? codcli : 'C00000').substring(0, 6))
        .input('nomcli', (nomcli && nomcli !== 'CLIENTE VARIOS' ? nomcli : 'VENTA CONTADO').substring(0, 60))
        .input('ruccli', (ruccli || '').substring(0, 11))
        .input('monto', sql.Decimal(18, 2), breakdown.total)
        .input('saldo', sql.Decimal(18, 2), breakdown.total)
        .input('glosa', firstItemName)
        .input('fven', sql.Date, fechaStr)
        .input('mone', 'S')
        .input('tcam', sql.Decimal(18, 4), navaExchangeRate)
        .input('flag', '0')
        .input('codven', (codven || 'V0001').substring(0, 5))
        .input('Codpto', erpPto)
        .input('codcdv', erpData.codcdv_nava || '01')
        .input('compro', '03/      ')
        .input('codsub', '03')
        .input('cuenta', '12121     ')
        .query(`
          INSERT INTO mst01ccc (fecha, cdocu, ndocu, crefe, nrefe, codcli, nomcli, ruccli, monto, saldo, glosa, fven, mone, tcam, flag, codven, Codpto, codcdv, compro, codsub, fecreg, cuenta)
          VALUES (@fecha, @cdocu, @ndocu, @crefe, @nrefe, @codcli, @nomcli, @ruccli, @monto, @saldo, @glosa, @fven, @mone, @tcam, @flag, @codven, @Codpto, @codcdv, @compro, @codsub, GETDATE(), @cuenta)
        `);

      const reqDtlCcc = new sql.Request(transaction);
      await reqDtlCcc
        .input('fecha', sql.Date, fechaStr)
        .input('codcli', sql.Char(6), finalCodCli.substring(0, 6))
        .input('cdocu', docType.substring(0, 2))
        .input('ndocu', nextNdocu.substring(0, 12))
        .input('crefe', docType.substring(0, 2))
        .input('nrefe', nextNdocu.substring(0, 12))
        .input('glosa', firstItemName)
        .input('cargo', sql.Decimal(18, 2), breakdown.total)
        .input('mone', 'S')
        .input('tcam', sql.Decimal(18, 4), navaExchangeRate)
        .input('compro', '03/      ')
        .query(`
          INSERT INTO dtl01ccc (fecha, codcli, tmov, cdocu, ndocu, crefe, nrefe, glosa, cargo, abono, mone, tcam, cpago, mpago, npago, ipago, nplan, idunico, fecreg, compro)
          VALUES (@fecha, @codcli, 'C', @cdocu, @ndocu, @crefe, @nrefe, @glosa, @cargo, 0, @mone, @tcam, ' ', ' ', '            ', 0, '            ', NEWID(), GETDATE(), @compro)
        `);

      // 7. Cobranza Mixta
      if (isMixed) {
        for (const p of payments) {
          const pType = (p.id === 'EF' || p.type === 1) ? 1 : 3;
          const pTar = (pType === 1) ? 'NS' : p.id.substring(0, 2);

          const reqMix = new sql.Request(transaction);
          await reqMix
            .input('cdocu', docType.substring(0, 2))
            .input('ndocu', nextNdocu.substring(0, 12))
            .input('codtar', pTar)
            .input('recib', sql.Decimal(18, 2), Number(p.amount.toFixed(2)))
            .input('totn', sql.Decimal(18, 2), Number(p.amount.toFixed(2)))
            .input('selpago', sql.Int, pType)
            .input('cajrecib', pType === 1 ? Number((cashReceived || p.amount).toFixed(2)) : 0)
            .input('monrecib', 'S')
            .input('cajvuelto', pType === 1 ? Number((changeGiven || 0).toFixed(2)) : 0)
            .input('monvuelto', 'S')
            .query(`
              INSERT INTO dtl_restpos_cobmixta (cdocu, ndocu, codtar, recib, totn, selpago, impper, cajrecib, monrecib, cajvuelto, monvuelto)
              VALUES (@cdocu, @ndocu, @codtar, @recib, @totn, @selpago, 0, @cajrecib, @monrecib, @cajvuelto, @monvuelto)
            `);
        }
      }

      await transaction.commit();
      logger.info(`[SaleService/MSSQL] Venta finalizada exitosamente: ${nextNdocu}`);
      
      return { 
        success: true, 
        ndocu: nextNdocu, 
        total: breakdown.total,
        base: breakdown.subtotal,
        igv: breakdown.tax
      };

    } catch (err) {
      logger.error(`[SaleService/MSSQL] ERROR CRÍTICO: ${err.message}`);
      if (transaction) await transaction.rollback();
      throw err;
    }
  }
}

export default new NavaSaleService();

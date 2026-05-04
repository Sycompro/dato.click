import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// Función para convertir números a letras (Especial para Facturación en Perú)
function numeroALetras(num) {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (num === 0) return 'CERO CON 00/100 SOLES';
    if (num === 100) return 'CIEN CON 00/100 SOLES';

    let entero = Math.floor(num);
    let decimales = Math.round((num - entero) * 100);
    let texto = '';

    if (entero >= 100) {
        texto += centenas[Math.floor(entero / 100)] + ' ';
        entero %= 100;
    }

    if (entero >= 20) {
        texto += decenas[Math.floor(entero / 10) - 1] + (entero % 10 !== 0 ? ' Y ' + unidades[entero % 10] : '');
    } else if (entero >= 11) {
        texto += especiales[entero - 11];
    } else if (entero > 0 || texto === '') {
        texto += unidades[entero];
    }

    return `${texto.trim()} CON ${decimales.toString().padStart(2, '0')}/100 SOLES`;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ndocu = searchParams.get('ndocu');
    const cdocu = searchParams.get('cdocu');
    const db = searchParams.get('db');

    if (!ndocu || !cdocu) return new NextResponse('Missing parameters', { status: 400 });

    try {
        const pool = await getConnection(db);
        
        // 1. Obtener Cabecera, Detalle e Info de la Empresa
        const headerRes = await pool.request()
            .input('ndocu', sql.VarChar, ndocu)
            .input('cdocu', sql.VarChar, cdocu)
            .query(`
                SELECT 
                    f.ndocu, f.cdocu, f.nomcli, f.ruccli, 
                    f.totn as total, f.tota as base, f.toti as igv, f.fecha,
                    f.efacthash, f.codpto,
                    v.nomven as vendedor
                FROM mst01fac f
                LEFT JOIN tbl01ven v ON f.codven = v.codven
                WHERE f.ndocu = @ndocu AND f.cdocu = @cdocu
            `);

        if (!headerRes.recordset[0]) return new NextResponse('Not found', { status: 404 });
        const sale = headerRes.recordset[0];

        // Obtener info de la tienda/sucursal
        const storeRes = await pool.request()
            .input('codpto', sql.Char(6), sale.codpto)
            .query(`
                SELECT TOP 1 t.nomtie, t.dirtie, t.ructie 
                FROM tbl_tienda t
                JOIN tbl01pto p ON t.codtie = p.codtie
                WHERE p.codpto = @codpto
            `);
        
        const storeInfo = storeRes.recordset[0] || {
            nomtie: 'GIM.BRA S.A.C.',
            ructie: '20603623747',
            dirtie: 'AV. JOSE BALTA NRO. 1362 - CHICLAYO'
        };

        const detailRes = await pool.request()
            .input('ndocu', sql.VarChar, ndocu)
            .input('cdocu', sql.VarChar, cdocu)
            .query("SELECT descr as name, cant as quantity, preu as price FROM dtl01fac WHERE ndocu = @ndocu AND cdocu = @cdocu");

        const items = detailRes.recordset;

        // 2. Generar QR
        const rucEmisor = storeInfo.ructie.trim();
        const [serie, correlativo] = sale.ndocu.split('-');
        const tipoDocCli = (sale.ruccli?.length === 11) ? "6" : "1";
        const qrString = `${rucEmisor}|${sale.cdocu}|${serie}|${correlativo}|${Number(sale.igv).toFixed(2)}|${Number(sale.total).toFixed(2)}|${new Date(sale.fecha).toISOString().split('T')[0]}|${tipoDocCli}|${sale.ruccli || '00000000'}|${sale.efacthash || ''}|`;
        const qrDataUrl = await QRCode.toDataURL(qrString, { margin: 1, width: 200 });

        // 3. Generar PDF
        const doc = new jsPDF({ unit: 'mm', format: [80, 280], compress: true });
        doc.setFont('courier');
        
        // --- CABECERA DINÁMICA ---
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(storeInfo.nomtie.trim(), 40, 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`R.U.C.: ${storeInfo.ructie.trim()}`, 40, 15, { align: 'center' });
        
        const splitAddr = doc.splitTextToSize(storeInfo.dirtie.trim(), 70);
        doc.text(splitAddr, 40, 19, { align: 'center' });
        
        let currentY = 19 + (splitAddr.length * 4);

        doc.line(5, currentY, 75, currentY);
        const tipoDocDesc = sale.cdocu === '01' ? 'FACTURA ELECTRÓNICA' : (sale.cdocu === '03' ? 'BOLETA ELECTRÓNICA' : 'NOTA DE VENTA');
        doc.setFont(undefined, 'bold');
        doc.text(tipoDocDesc, 40, currentY + 5, { align: 'center' });
        doc.text(`Nº ${sale.ndocu}`, 40, currentY + 9, { align: 'center' });
        doc.line(5, currentY + 12, 75, currentY + 12);
        currentY += 17;

        // --- DATOS VENTA ---
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(`FECHA      : ${new Date(sale.fecha).toLocaleDateString()}`, 5, currentY);
        doc.text(`VENDEDOR   : ${sale.vendedor?.trim() || 'ENCARGADO'}`, 5, currentY + 4);
        doc.text(`CLIENTE    : ${sale.nomcli.trim().substring(0, 30)}`, 5, currentY + 8);
        if (sale.ruccli) doc.text(`RUC/DNI    : ${sale.ruccli.trim()}`, 5, currentY + 12);
        doc.line(5, currentY + 15, 75, currentY + 15);
        currentY += 16;

        // --- PRODUCTOS ---
        autoTable(doc, {
            startY: currentY,
            head: [['CANT.', 'DESCRIPCIÓN', 'TOTAL']],
            body: items.map(i => [i.quantity.toString(), i.name.trim().substring(0, 20), (i.quantity * i.price).toFixed(2)]),
            theme: 'plain',
            styles: { fontSize: 7, font: 'courier', cellPadding: 1 },
            headStyles: { fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 15, halign: 'right' } },
            margin: { left: 5, right: 5 }
        });

        // --- TOTALES ---
        let finalY = doc.lastAutoTable.finalY + 5;
        doc.setFontSize(7);
        const drawTotalLine = (label, value, y) => {
            doc.text(label, 25, y);
            doc.text('S/:', 50, y);
            doc.text(value, 75, y, { align: 'right' });
        };
        drawTotalLine('Op. Gravada', Number(sale.base).toFixed(2), finalY);
        drawTotalLine('I.G.V. 18%', Number(sale.igv).toFixed(2), finalY + 4);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        drawTotalLine('TOTAL', Number(sale.total).toFixed(2), finalY + 10);

        // --- MONTO EN LETRAS ---
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        const montoLetras = `SON: ${numeroALetras(Number(sale.total))}`;
        const splitLetras = doc.splitTextToSize(montoLetras, 70);
        doc.text(splitLetras, 5, finalY + 18);
        
        finalY += 18 + (splitLetras.length * 4);

        // --- QR ---
        doc.addImage(qrDataUrl, 'PNG', 27, finalY, 26, 26);
        
        // --- PIE DE PÁGINA ---
        finalY += 32;
        doc.setFontSize(7);
        doc.text('STATUS: <REIMPRESION>', 5, finalY);
        doc.text(`FECHA IMPRESION: ${new Date().toLocaleString()}`, 5, finalY + 4);

        const footerText = `Representación impresa de ${sale.cdocu === '01' ? 'Factura' : 'Boleta'} Electrónica\nPodrá ser consultada en https://www.prolineapp.pe\nAutorizado por resolución Nº287-2017/SUNAT`;
        doc.text(footerText, 40, finalY + 12, { align: 'center' });

        return new NextResponse(doc.output('arraybuffer'), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline; filename="ticket.pdf"'
            }
        });

    } catch (error) {
        console.error('[PDF] Error crítico:', error);
        return new NextResponse('Error', { status: 500 });
    }
}

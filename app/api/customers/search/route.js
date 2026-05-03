import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) return NextResponse.json({ data: null });

    try {
        const pool = await getConnection(session?.user?.company);
        let finalData = null;
        let source = 'NONE';

        // 1. Buscar en Navasoft (ERP) - Datos Oficiales
        const erpResult = await pool.request()
            .input('query', sql.VarChar(20), query)
            .query("SELECT TOP 1 codcli, nomcli, ruccli, nrodni, dircli, telcli, celcli, fecnac FROM mst01cli WHERE ruccli = @query OR nrodni = @query");

        if (erpResult.recordset.length > 0) {
            const cli = erpResult.recordset[0];
            finalData = {
                codcli: cli.codcli.trim(),
                nomcli: cli.nomcli.trim(),
                ruccli: (cli.ruccli || cli.nrodni || '').trim(),
                address: (cli.dircli || '').trim(),
                phone: (cli.celcli || cli.telcli || '').trim(),
                birthdate: cli.fecnac ? new Date(cli.fecnac).toISOString().split('T')[0] : '',
                source: 'ERP'
            };
            source = 'ERP';
        }

        // 2. Si no está en ERP, buscar en API Externa (SUNAT/RENIEC)
        if (!finalData) {
            const apiRes = await fetch('https://apiperu.dev/api/dni-ruc', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer 76ca7246c8a8c464fd551b6555e780791a69ff89acb8887558d65b23f05ab81b'
                },
                body: JSON.stringify({ dni: query, ruc: query })
            });

            const apiData = await apiRes.json();
            if (apiData.success && apiData.data) {
                const d = apiData.data;
                finalData = {
                    codcli: 'NUEVO_ERP',
                    nomcli: d.nombre_completo || d.nombre_o_razon_social,
                    ruccli: d.ruc || d.dni,
                    address: d.direccion_completa || '',
                    isNew: true,
                    source: 'EXTERNAL'
                };
                source = 'EXTERNAL';
            }
        }

        // 3. SIEMPRE buscar en Railway para completar datos (Celular, F. Nacimiento)
        try {
            const internalResult = await pool.request()
                .input('query', sql.VarChar(20), query)
                .query("SELECT TOP 1 phone, birthdate, name, lastname FROM tbl_clientes_internos WHERE doc = @query");

            if (internalResult.recordset.length > 0) {
                const intCli = internalResult.recordset[0];
                
                // Si el cliente no existía en ERP ni API, lo creamos desde Railway
                if (!finalData) {
                    finalData = {
                        codcli: 'INTERNO',
                        nomcli: `${intCli.name} ${intCli.lastname}`,
                        ruccli: query,
                        address: '',
                        source: 'RAILWAY'
                    };
                }

                // Solo inyectamos los datos de Railway si el ERP los tiene vacíos
                if (!finalData.phone) finalData.phone = intCli.phone || '';
                if (!finalData.birthdate) finalData.birthdate = intCli.birthdate || '';
                
                if (finalData.source === 'ERP' && (intCli.phone || intCli.birthdate)) {
                    finalData.source = 'ERP (Con respaldo Railway)';
                }
            }
        } catch (e) {
            console.log('Internal table check failed/empty');
        }

        if (finalData) {
            return NextResponse.json({ data: finalData });
        }

        return NextResponse.json({ 
            data: null, 
            message: 'Datos incorrectos o se trata de un menor de edad o un extranjero.' 
        });

    } catch (err) {
        console.error('Search customer error:', err);
        return NextResponse.json({ error: 'Error en la búsqueda' }, { status: 500 });
    }
}

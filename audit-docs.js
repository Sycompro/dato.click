const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
    const dbs = ['BdNava00', 'BdNava01', 'BdNava02']; // Sample DBs
    for (const db of dbs) {
        const pool = await new sql.ConnectionPool({ ...config, database: db }).connect();
        
        console.log(`\n=== BD: ${db} ===`);
        
        // Let's see what cdocu exist and their total sales/ops for a recent month (Marzo 2025)
        const q = `
            SELECT 
                RTRIM(f.cdocu) as doc,
                COUNT(*) as ops,
                SUM(f.totn) as total_neto,
                SUM(f.totn * CASE WHEN f.mone='D' THEN f.tcam ELSE 1 END) as total_neto_soles
            FROM mst01fac f
            WHERE f.flag = '0' AND YEAR(f.fecha) = 2026 AND MONTH(f.fecha) = 4
            GROUP BY RTRIM(f.cdocu)
            ORDER BY ops DESC
        `;
        
        const res = await pool.request().query(q);
        res.recordset.forEach(r => {
            console.log(`Doc: [${r.doc}] -> Ops: ${r.ops}, S/ ${r.total_neto_soles?.toFixed(2)}`);
        });

        // Try to get document descriptions from a catalog table like tbl_documento / tbl01doc
        try {
            const docs = await pool.request().query(`SELECT top 50 cdocu, descri FROM tbl01doc`);
            if (docs.recordset.length > 0) {
                console.log("\nDocumentos en catálogo (tbl01doc):");
                docs.recordset.forEach(d => {
                    if (res.recordset.find(r => r.doc === d.cdocu?.trim())) {
                        console.log(`[${d.cdocu?.trim()}] = ${d.descri?.trim()}`);
                    }
                });
            }
        } catch(e) {}
        
        // See if there's any logic subtracting credit notes (Notas de Crédito - 07)
        console.log("\nNotas de Crédito (07) en Abril 2026:");
        const nc = await pool.request().query(`
            SELECT COUNT(*) as ops, SUM(f.totn * CASE WHEN f.mone='D' THEN f.tcam ELSE 1 END) as total_soles
            FROM mst01fac f WHERE f.flag = '0' AND RTRIM(f.cdocu) = '07' AND YEAR(f.fecha) = 2026 AND MONTH(f.fecha) = 4
        `);
        console.log(`Ops: ${nc.recordset[0].ops}, S/ ${nc.recordset[0].total_soles?.toFixed(2)}`);

        await pool.close();
    }
}

run().catch(console.error);

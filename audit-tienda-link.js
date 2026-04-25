const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
    for (const db of ['BdNava01', 'BdNava02']) {
        const pool = await new sql.ConnectionPool({ ...config, database: db }).connect();
        console.log('\n=== ' + db + ' ===');
        
        // Relación entre Codpto, codtie en tbl01pto, y nomtie en tbl_tienda
        console.log('\nRELACIÓN Codpto -> codtie -> nomtie:');
        const rel = await pool.request().query(`
            SELECT p.codpto, RTRIM(p.nompto) as nompto, RTRIM(p.codtie) as codtie, 
                   RTRIM(t.nomtie) as nomtie_real, RTRIM(t.DirTie) as direccion
            FROM tbl01pto p 
            LEFT JOIN tbl_tienda t ON RTRIM(p.codtie) = RTRIM(t.codtie)
        `);
        rel.recordset.forEach(r => {
            console.log(`  Pto:[${(r.codpto||'').trim()}] "${r.nompto}" -> Tienda:[${r.codtie}] "${r.nomtie_real}" | ${r.direccion}`);
        });

        // Ventas cruzando con tienda directamente
        console.log('\nVENTAS POR TIENDA (via codtie, Marzo 2025):');
        try {
            const ventas = await pool.request().query(`
                SELECT RTRIM(t.nomtie) as tienda, COUNT(*) as ops, SUM(f.totn) as total
                FROM mst01fac f 
                INNER JOIN tbl01pto p ON RTRIM(f.Codpto) = RTRIM(p.codpto)
                INNER JOIN tbl_tienda t ON RTRIM(p.codtie) = RTRIM(t.codtie)
                WHERE f.flag = '0' AND RTRIM(f.cdocu) IN ('01','03')
                  AND YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3
                GROUP BY t.nomtie ORDER BY total DESC
            `);
            ventas.recordset.forEach(r => console.log(`  ${r.tienda} -> ${r.ops} ops, S/ ${r.total}`));
        } catch(e) { console.log('Error:', e.message); }

        // También probar con CodAlm -> tbl01alm -> codtie -> tbl_tienda
        console.log('\nVENTAS POR TIENDA (via CodAlm -> tbl01alm -> codtie, Marzo 2025):');
        try {
            const ventas2 = await pool.request().query(`
                SELECT RTRIM(t.nomtie) as tienda, COUNT(*) as ops, SUM(f.totn) as total
                FROM mst01fac f 
                INNER JOIN tbl01alm a ON RTRIM(f.CodAlm) = RTRIM(a.codalm)
                INNER JOIN tbl_tienda t ON RTRIM(a.codtie) = RTRIM(t.codtie)
                WHERE f.flag = '0' AND RTRIM(f.cdocu) IN ('01','03')
                  AND YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3
                GROUP BY t.nomtie ORDER BY total DESC
            `);
            ventas2.recordset.forEach(r => console.log(`  ${r.tienda} -> ${r.ops} ops, S/ ${r.total}`));
        } catch(e) { console.log('Error:', e.message); }

        await pool.close();
    }
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });

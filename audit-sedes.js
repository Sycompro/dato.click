const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

const companies = [
    { db: 'BdNava00', name: 'GIMBRA S.A.C.' },
    { db: 'BdNava01', name: 'Bunny Bra S.A.C.' },
    { db: 'BdNava02', name: 'Importaciones Gya S.A.C.' },
    { db: 'BdNava03', name: 'Gloss & Gloss S.A.C.' },
    { db: 'BdNava04', name: 'GIMBRA S.A.C. (Contable)' },
    { db: 'BdNava05', name: 'Bunny Bra S.A.C. (Contable)' },
];

async function run() {
    for (const c of companies) {
        try {
            const pool = await new sql.ConnectionPool({ ...config, database: c.db }).connect();

            // 1. Sedes registradas en la tabla maestra
            const maestro = await pool.request().query(
                "SELECT RTRIM(codpto) as codpto, RTRIM(nompto) as nompto FROM tbl01pto"
            );

            // 2. Sedes que realmente tienen ventas (Marzo 2025 como muestra)
            const ventasSedes = await pool.request().query(`
                SELECT RTRIM(f.Codpto) as codpto, RTRIM(p.nompto) as sede, 
                       COUNT(*) as ops, ISNULL(SUM(f.totn),0) as total
                FROM mst01fac f 
                INNER JOIN tbl01pto p ON RTRIM(f.Codpto) = RTRIM(p.codpto)
                WHERE YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3 
                  AND (f.flag != 'A' OR f.flag IS NULL)
                GROUP BY f.Codpto, p.nompto ORDER BY total DESC
            `);

            // 3. Flag analysis: check what happens with flag values
            const flags = await pool.request().query(
                "SELECT DISTINCT flag, COUNT(*) as qty FROM mst01fac GROUP BY flag ORDER BY qty DESC"
            );

            // 4. Facturas sin punto de venta asignado (o con codpto que no existe en maestro)
            const sinSede = await pool.request().query(`
                SELECT RTRIM(f.Codpto) as codpto, COUNT(*) as ops
                FROM mst01fac f 
                LEFT JOIN tbl01pto p ON RTRIM(f.Codpto) = RTRIM(p.codpto)
                WHERE p.codpto IS NULL AND YEAR(f.fecha) = 2025
                GROUP BY f.Codpto
            `);

            console.log('\n' + '='.repeat(60));
            console.log(`${c.db} → ${c.name}`);
            console.log('='.repeat(60));

            console.log('\n📋 SEDES REGISTRADAS (tbl01pto):');
            maestro.recordset.forEach(r => console.log(`  [${r.codpto}] ${r.nompto}`));

            console.log('\n📊 SEDES CON VENTAS (Marzo 2025):');
            if (ventasSedes.recordset.length === 0) {
                console.log('  (sin datos para Marzo 2025)');
            } else {
                ventasSedes.recordset.forEach(r => 
                    console.log(`  [${r.codpto}] ${r.sede} → ${r.ops} ops, S/ ${r.total.toFixed(2)}`)
                );
            }

            console.log('\n🔑 FLAGS:');
            flags.recordset.forEach(r => console.log(`  flag="${r.flag}" → ${r.qty} registros`));

            if (sinSede.recordset.length > 0) {
                console.log('\n⚠️  FACTURAS SIN SEDE VÁLIDA (2025):');
                sinSede.recordset.forEach(r => console.log(`  codpto="${r.codpto}" → ${r.ops} registros`));
            }

            await pool.close();
        } catch (e) {
            console.log(`${c.db} ERROR: ${e.message}`);
        }
    }
    process.exit(0);
}

run();

const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
    const db = 'BdNava01'; // Bunny Bra - la que tiene más datos
    const pool = await new sql.ConnectionPool({ ...config, database: db }).connect();

    console.log('=== INVESTIGACIÓN PROFUNDA DE SEDES ===');
    console.log('Base de datos:', db, '\n');

    // 1. Todas las tablas que podrían contener sedes/locales/sucursales
    const tables = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE='BASE TABLE' 
        AND (TABLE_NAME LIKE '%suc%' OR TABLE_NAME LIKE '%sede%' 
             OR TABLE_NAME LIKE '%local%' OR TABLE_NAME LIKE '%pto%' 
             OR TABLE_NAME LIKE '%alm%' OR TABLE_NAME LIKE '%tienda%'
             OR TABLE_NAME LIKE '%punto%' OR TABLE_NAME LIKE '%almacen%'
             OR TABLE_NAME LIKE '%oficina%' OR TABLE_NAME LIKE '%branch%')
    `);
    console.log('📋 TABLAS CANDIDATAS A SEDES:');
    tables.recordset.forEach(t => console.log('  -', t.TABLE_NAME));

    // 2. Tabla Tbl_Sucursal
    console.log('\n📍 Tbl_Sucursal:');
    try {
        const sucs = await pool.request().query('SELECT * FROM Tbl_Sucursal');
        sucs.recordset.forEach(r => console.log('  ', JSON.stringify(r)));
    } catch(e) { console.log('  No existe'); }

    // 3. tbl01pto (puntos de venta)
    console.log('\n📍 tbl01pto (Puntos de Venta):');
    try {
        const ptos = await pool.request().query('SELECT * FROM tbl01pto');
        ptos.recordset.forEach(r => {
            const cleaned = {};
            for (const [k,v] of Object.entries(r)) {
                cleaned[k] = typeof v === 'string' ? v.trim() : v;
            }
            console.log('  ', JSON.stringify(cleaned));
        });
    } catch(e) { console.log('  No existe'); }

    // 4. tbl01alm (almacenes)
    console.log('\n📍 tbl01alm (Almacenes):');
    try {
        const alms = await pool.request().query('SELECT * FROM tbl01alm');
        alms.recordset.forEach(r => {
            const cleaned = {};
            for (const [k,v] of Object.entries(r)) {
                cleaned[k] = typeof v === 'string' ? v.trim() : v;
            }
            console.log('  ', JSON.stringify(cleaned));
        });
    } catch(e) { console.log('  No existe'); }

    // 5. Columnas de mst01fac que podrían relacionarse con sedes
    console.log('\n📍 COLUMNAS DE mst01fac RELACIONADAS CON UBICACIÓN:');
    const sample = await pool.request().query(`
        SELECT TOP 5 
            RTRIM(Codpto) as Codpto, 
            RTRIM(CodAlm) as CodAlm,
            RTRIM(codven) as codven,
            RTRIM(cdocu) as cdocu,
            RTRIM(codscc) as codscc,
            RTRIM(codfdp) as codfdp,
            RTRIM(codtar) as codtar,
            RTRIM(codsub) as codsub,
            RTRIM(coddet) as coddet,
            RTRIM(codusu) as codusu,
            RTRIM(codtur) as codtur,
            RTRIM(codcob) as codcob
        FROM mst01fac 
        WHERE YEAR(fecha) = 2025 AND MONTH(fecha) = 3 AND flag = '0'
    `);
    sample.recordset.forEach(r => console.log('  ', JSON.stringify(r)));

    // 6. Distribución por Codpto
    console.log('\n📊 DISTRIBUCIÓN POR Codpto (Marzo 2025):');
    const distPto = await pool.request().query(`
        SELECT RTRIM(f.Codpto) as codpto, COUNT(*) as qty, SUM(f.totn) as total
        FROM mst01fac f WHERE YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3 AND f.flag = '0'
        GROUP BY f.Codpto ORDER BY qty DESC
    `);
    distPto.recordset.forEach(r => console.log(`  codpto="${r.codpto}" → ${r.qty} ops, S/ ${r.total}`));

    // 7. Distribución por CodAlm
    console.log('\n📊 DISTRIBUCIÓN POR CodAlm (Marzo 2025):');
    const distAlm = await pool.request().query(`
        SELECT RTRIM(f.CodAlm) as CodAlm, COUNT(*) as qty, SUM(f.totn) as total
        FROM mst01fac f WHERE YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3 AND f.flag = '0'
        GROUP BY f.CodAlm ORDER BY qty DESC
    `);
    distAlm.recordset.forEach(r => console.log(`  CodAlm="${r.CodAlm}" → ${r.qty} ops, S/ ${r.total}`));

    // 8. Distribución por codsub
    console.log('\n📊 DISTRIBUCIÓN POR codsub (Marzo 2025):');
    const distSub = await pool.request().query(`
        SELECT RTRIM(f.codsub) as codsub, COUNT(*) as qty, SUM(f.totn) as total
        FROM mst01fac f WHERE YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3 AND f.flag = '0'
        GROUP BY f.codsub ORDER BY qty DESC
    `);
    distSub.recordset.forEach(r => console.log(`  codsub="${r.codsub}" → ${r.qty} ops, S/ ${r.total}`));

    // 9. codscc 
    console.log('\n📊 DISTRIBUCIÓN POR codscc (Marzo 2025):');
    const distScc = await pool.request().query(`
        SELECT RTRIM(f.codscc) as codscc, COUNT(*) as qty, SUM(f.totn) as total
        FROM mst01fac f WHERE YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3 AND f.flag = '0'
        GROUP BY f.codscc ORDER BY qty DESC
    `);
    distScc.recordset.forEach(r => console.log(`  codscc="${r.codscc}" → ${r.qty} ops, S/ ${r.total}`));

    // 10. Relación Almacén -> Nombre
    console.log('\n📍 CRUCE CodAlm CON tbl01alm:');
    try {
        const cruce = await pool.request().query(`
            SELECT RTRIM(f.CodAlm) as CodAlm, RTRIM(a.nomalm) as nombreAlmacen, COUNT(*) as ops, SUM(f.totn) as total
            FROM mst01fac f 
            INNER JOIN tbl01alm a ON RTRIM(f.CodAlm) = RTRIM(a.codalm)
            WHERE YEAR(f.fecha) = 2025 AND MONTH(f.fecha) = 3 AND f.flag = '0'
            GROUP BY f.CodAlm, a.nomalm ORDER BY total DESC
        `);
        cruce.recordset.forEach(r => console.log(`  [${r.CodAlm}] ${r.nombreAlmacen} → ${r.ops} ops, S/ ${r.total}`));
    } catch(e) { console.log('  Error:', e.message); }

    await pool.close();
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });

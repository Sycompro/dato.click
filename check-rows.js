const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    database: 'BdNava01',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function getRow(tableName) {
    let pool = await sql.connect(config);
    let result = await pool.request().query(`SELECT TOP 1 * FROM ${tableName}`);
    console.log(`\n--- ${tableName} ---`);
    if(result.recordset.length > 0) {
        console.log(Object.keys(result.recordset[0]).join(", "));
    } else {
        console.log("Empty table");
    }
}

async function run() {
    try {
        await getRow('mst01fac');
        await getRow('dtl01fac');
        await getRow('tbl01ven');
        await getRow('tbl01itm');
        sql.close();
    } catch(e) {
        console.log(e.message);
    }
}

run();

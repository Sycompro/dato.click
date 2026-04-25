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

async function checkSpecifics() {
    try {
        let pool = await sql.connect(config);
        
        const q = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('Tbl_Personal', 'Tbl_Vendedor', 'Mst_Item', 'Tbl_Bienes', 'Mst_Bienes', 'Mst_Factura_Venta', 'Tbl_Sucursal')";
        let result = await pool.request().query(q);
        result.recordset.forEach(r => console.log(r.TABLE_NAME));
        
        // Ver las columnas de la factura
        console.log("\nColumnas de mst_factura_venta:");
        let cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='mst_factura_venta'");
        cols.recordset.forEach(r => console.log("- " + r.COLUMN_NAME));

        sql.close();
    } catch (err) {
        console.error("SQL Error:", err.message);
    }
}

checkSpecifics();

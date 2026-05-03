import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request) {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { doc, name, lastname, phone, birthdate } = body;

    try {
        const pool = await getConnection(session?.user?.company);
        
        // 1. Asegurar que la tabla interna exista
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tbl_clientes_internos')
            BEGIN
                CREATE TABLE tbl_clientes_internos (
                    doc VARCHAR(20) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    lastname VARCHAR(100) NOT NULL,
                    phone VARCHAR(20),
                    birthdate VARCHAR(20),
                    createdAt DATETIME DEFAULT GETDATE()
                )
            END
        `);

        // 2. Verificar si el cliente ya existe en Navasoft para evitar duplicidad en Railway
        const erpCheck = await pool.request()
            .input('doc', sql.VarChar(20), doc)
            .query("SELECT codcli FROM mst01cli WHERE ruccli = @doc OR nrodni = @doc");

        if (erpCheck.recordset.length > 0) {
            return NextResponse.json({ 
                success: true, 
                message: 'El cliente ya existe en Navasoft. Los datos se actualizarán directamente en el ERP al finalizar la venta.' 
            });
        }

        // 3. Insertar o actualizar cliente interno
        await pool.request()
            .input('doc', sql.VarChar(20), doc)
            .input('name', sql.VarChar(100), name)
            .input('lastname', sql.VarChar(100), lastname)
            .input('phone', sql.VarChar(20), phone || '')
            .input('birthdate', sql.VarChar(20), birthdate || '')
            .query(`
                IF EXISTS (SELECT 1 FROM tbl_clientes_internos WHERE doc = @doc)
                BEGIN
                    UPDATE tbl_clientes_internos 
                    SET name = @name, lastname = @lastname, phone = @phone, birthdate = @birthdate 
                    WHERE doc = @doc
                END
                ELSE
                BEGIN
                    INSERT INTO tbl_clientes_internos (doc, name, lastname, phone, birthdate)
                    VALUES (@doc, @name, @lastname, @phone, @birthdate)
                END
            `);

        return NextResponse.json({ success: true, message: 'Cliente interno registrado en Railway' });

    } catch (err) {
        console.error('Internal customer registration error:', err);
        return NextResponse.json({ error: 'Error al registrar cliente interno', details: err.message }, { status: 500 });
    }
}

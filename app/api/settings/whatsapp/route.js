import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/db';

// Crear tabla si no existe
async function ensureTable() {
    let pool = await getConnection();
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tbl_pos_settings' AND xtype='U')
        CREATE TABLE tbl_pos_settings (
            id INT PRIMARY KEY DEFAULT 1,
            whatsapp_url VARCHAR(255),
            whatsapp_token VARCHAR(255),
            CHECK (id = 1)
        );
        IF NOT EXISTS (SELECT * FROM tbl_pos_settings WHERE id=1)
        INSERT INTO tbl_pos_settings (id, whatsapp_url, whatsapp_token) VALUES (1, '', '');
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tbl_whatsapp_logs' AND xtype='U')
        CREATE TABLE tbl_whatsapp_logs (
            id INT IDENTITY(1,1) PRIMARY KEY,
            phone VARCHAR(20),
            message NVARCHAR(MAX),
            status VARCHAR(50),
            created_at DATETIME DEFAULT GETDATE()
        );
    `);
}

export async function GET(request) {
    try {
        await ensureTable();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        let pool = await getConnection();
        
        if (type === 'logs') {
            let result = await pool.request().query('SELECT TOP 10 * FROM tbl_whatsapp_logs ORDER BY created_at DESC');
            return NextResponse.json(result.recordset);
        }

        let result = await pool.request().query('SELECT whatsapp_url, whatsapp_token FROM tbl_pos_settings WHERE id=1');
        return NextResponse.json(result.recordset[0]);
    } catch (error) {
        console.error('Error loading settings:', error);
        return NextResponse.json({ error: 'Error al procesar solicitud' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { whatsapp_url, whatsapp_token } = body;
        
        await ensureTable();
        let pool = await getConnection();
        await pool.request()
            .input('url', sql.VarChar(255), whatsapp_url)
            .input('token', sql.VarChar(255), whatsapp_token)
            .query('UPDATE tbl_pos_settings SET whatsapp_url = @url, whatsapp_token = @token WHERE id=1');
            
        return NextResponse.json({ success: true, message: 'Configuración guardada' });
    } catch (error) {
        console.error('Error saving settings:', error);
        return NextResponse.json({ success: false, error: 'Error al guardar ajustes' }, { status: 500 });
    }
}

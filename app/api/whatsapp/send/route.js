import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/db';

export async function POST(request) {
    const body = await request.json();
    const { phone, message, media_url } = body;

    // Recuperar ajustes de la base de datos
    let API_KEY = '';
    let ENDPOINT = '';

    try {
        const dbName = process.env.DB_NAME || 'BdNava03';
        const pool = await getConnection(dbName);
        const settings = await pool.request().query('SELECT whatsapp_url, whatsapp_token FROM tbl_pos_settings WHERE id=1');
        if (settings.recordset.length > 0) {
            let baseUrl = settings.recordset[0].whatsapp_url.trim();
            // Eliminar barra final si existe para evitar doble barra
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
            
            ENDPOINT = baseUrl + '/api/external/send-message';
            API_KEY = settings.recordset[0].whatsapp_token;
        }
    } catch (e) {
        console.error('Error loading settings for WhatsApp send:', e);
    }

    if (!API_KEY || !ENDPOINT) {
        return NextResponse.json({ success: false, error: 'Configuración de WhatsApp incompleta' }, { status: 400 });
    }

    if (!phone || !message) {
        return NextResponse.json({ success: false, error: 'Teléfono y mensaje son obligatorios' }, { status: 400 });
    }

    try {
        const payload = {
            phone: phone.length === 9 ? `51${phone}` : phone,
            message,
            source: 'Syscom-POS'
        };

        if (media_url) payload.media_url = media_url;

        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Registrar en historial local (SIN AWAIT para responder más rápido)
        getConnection().then(pool => {
            pool.request()
                .input('phone', sql.VarChar(20), phone)
                .input('message', sql.NVarChar(sql.MAX), message)
                .input('status', response.ok ? 'EXITOSO' : 'FALLIDO')
                .query('INSERT INTO tbl_whatsapp_logs (phone, message, status) VALUES (@phone, @message, @status)')
                .catch(e => console.error('Background log error:', e));
        }).catch(e => console.error('Background pool error:', e));

        return NextResponse.json(data);
    } catch (error) {
        console.error('WhatsApp API Error:', error);
        // Si el error es de JSON (Unexpected token <), devolvemos un error limpio
        return NextResponse.json({ 
            success: false, 
            error: 'El servidor está procesando muchas solicitudes. El mensaje podría haber sido enviado.' 
        }, { status: 500 });
    }
}

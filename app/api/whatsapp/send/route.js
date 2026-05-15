import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request) {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { phone, message, media_url } = body;

    // Recuperar ajustes de la base de datos de la empresa actual
    let API_KEY = '';
    let ENDPOINT = '';

    const dbName = session?.user?.company;
    try {
        if (!dbName) {
            return NextResponse.json({ success: false, error: 'Sesión de empresa no identificada' }, { status: 401 });
        }
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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 segundos de timeout

        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        // Registrar en historial local (SIN AWAIT para responder más rápido)
        getConnection(dbName).then(pool => {
            pool.request()
                .input('phone', sql.VarChar(20), phone)
                .input('message', sql.NVarChar(sql.MAX), message)
                .input('status', response.ok ? 'EXITOSO' : 'FALLIDO')
                .query('INSERT INTO tbl_whatsapp_logs (phone, message, status) VALUES (@phone, @message, @status)')
                .catch(e => console.error('Background log error:', e));
        }).catch(e => console.error('Background pool error:', e));

        return NextResponse.json(data);
    } catch (error) {
        if (error.name === 'AbortError') {
            return NextResponse.json({ 
                success: true, 
                warning: 'El mensaje se está procesando, pero el servidor de WhatsApp tardó en confirmar. No es necesario reintentar inmediatamente.' 
            });
        }
        console.error('WhatsApp API Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: 'El servidor está procesando muchas solicitudes. Inténtalo de nuevo en unos segundos.' 
        }, { status: 500 });
    }
}

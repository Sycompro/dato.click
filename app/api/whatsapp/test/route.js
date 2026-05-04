import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { url, token } = await request.json();

        if (!url || !token) {
            return NextResponse.json({ success: false, error: 'URL y Token requeridos' }, { status: 400 });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
            const response = await fetch(`${url}/api/external/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': token
                },
                body: JSON.stringify({ phone: '123456789', message: 'ping-test', source: 'syscom-pos-test' }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            return NextResponse.json({ 
                success: true, 
                online: response.status !== 404 
            });
        } catch (e) {
            clearTimeout(timeoutId);
            return NextResponse.json({ success: true, online: false, error: 'Tiempo de espera agotado' });
        }
    } catch (error) {
        console.error('WhatsApp Test Error:', error);
        return NextResponse.json({ success: false, error: 'No se pudo alcanzar el servidor' }, { status: 500 });
    }
}

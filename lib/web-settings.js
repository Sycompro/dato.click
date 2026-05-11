import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'web_pos_settings.json');

export async function getWebSettings(companyId) {
    try {
        const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
        const allSettings = JSON.parse(content);
        return allSettings[companyId] || { custom_name: '', use_custom_name: 0 };
    } catch (e) {
        // Si el archivo no existe o hay error, devolvemos default
        return { custom_name: '', use_custom_name: 0 };
    }
}

export async function saveWebSettings(companyId, settings) {
    let allSettings = {};
    try {
        const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
        allSettings = JSON.parse(content);
    } catch (e) {
        // Archivo nuevo
    }

    allSettings[companyId] = {
        ...allSettings[companyId],
        ...settings
    };

    await fs.writeFile(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf-8');
    return true;
}

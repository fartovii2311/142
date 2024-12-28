import fs from 'fs';

let handler = async (m, { conn, text }) => {
    const userId = m.sender;
    const db = global.db.data.users;

    if (!db[userId]) db[userId] = { hearts: 0, skins: [], bank: 0 };

    const user = db[userId];

    let skins = [];
    try {
        skins = JSON.parse(fs.readFileSync('./storage/databases/skins.json', 'utf-8'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            skins = [
                { id: 1, name: "Skin 1", cost: 100 },
                { id: 2, name: "Skin 2", cost: 200 }
            ];
            fs.writeFileSync('./storage/database/skins.json', JSON.stringify(skins, null, 2));
        } else {
            console.error(error);
            return conn.reply(m.chat, `🚩 Ocurrió un error al acceder a la tienda de skins.`, m);
        }
    }

    if (!text) {
        let shopMessage = '🛒 *Tienda de Skins*\n\n';
        for (let skin of skins) {
            shopMessage += `🆔 *ID:* ${skin.id}\n📛 *Nombre:* ${skin.name}\n🤍 *Costo:* ${skin.cost} 🤍\n\n`;
        }
        shopMessage += `💰 *Tus corazones blancos:* ${user.hearts} 🤍\n`;
        shopMessage += `🏦 *Tus corazones en el banco:* ${user.bank} 🤍\n\n`;
        shopMessage += `Usa: *.comprar <ID de skin>* para comprar.`;
        return conn.reply(m.chat, shopMessage, m);
    }

    let args = text.split(' ');
    if (args[0] === 'comprar') {
        let skinId = parseInt(args[1]);
        let selectedSkin = skins.find(skin => skin.id === skinId);

        if (!selectedSkin) {
            return conn.reply(m.chat, `🚩 No se encontró la skin con ID ${skinId}.`, m);
        }

        if (user.hearts < selectedSkin.cost) {
            return conn.reply(m.chat, `🚩 No tienes suficientes corazones blancos. Necesitas ${selectedSkin.cost - user.hearts} más.`, m);
        }

        if (user.skins.includes(selectedSkin.id)) {
            return conn.reply(m.chat, `🚩 Ya tienes esta skin.`, m);
        }

        user.hearts -= selectedSkin.cost;
        user.skins.push(selectedSkin.id);
        return conn.reply(m.chat, `✅ Compraste la skin *${selectedSkin.name}*. ¡Disfrútala!`, m);
    }

    conn.reply(m.chat, `🚩 Comando no válido. Usa *.tienda* para ver la tienda.`, m);
};

handler.command = ['tienda', 'comprar'];

export default handler;

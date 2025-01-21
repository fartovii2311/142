const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    MessageRetryMap,
    makeCacheableSignalKeyStore,
    jidNormalizedUser
} = await import('@whiskeysockets/baileys')
import moment from 'moment-timezone';
import NodeCache from 'node-cache';
import readline from 'readline';
import qrcode from "qrcode";
import crypto from 'crypto';
import fs from "fs";
import pino from 'pino';
import * as ws from 'ws';
import path from 'path';
const { CONNECTING } = ws;
import { Boom } from '@hapi/boom';
import { makeWASocket } from '../lib/simple.js';

if (!(global.conns instanceof Array)) global.conns = [];

let handler = async (m, { conn: _conn, args, usedPrefix, command, isOwner }) => {

    let parent = _conn;

    async function serbot() {
        let authFolderB = m.sender.split('@')[0];
        const userFolderPath = `./LynxJadiBot/${authFolderB}`;

        if (fs.existsSync(userFolderPath)) {
            fs.rmSync(userFolderPath, { recursive: true, force: true });
        }

        args[0] ? fs.writeFileSync(`${userFolderPath}/creds.json`, JSON.stringify(JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")), null, '\t')) : "";

        const { state, saveState, saveCreds } = await useMultiFileAuthState(userFolderPath);
        const msgRetryCounterMap = (MessageRetryMap) => { };
        const msgRetryCounterCache = new NodeCache();
        const { version } = await fetchLatestBaileysVersion();
        let phoneNumber = m.sender.split('@')[0];

        const methodCodeQR = process.argv.includes("qr");
        const methodCode = !!phoneNumber || process.argv.includes("code");
        const MethodMobile = process.argv.includes("mobile");

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

        const connectionOptions = {
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            mobile: MethodMobile,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            getMessage: async (clave) => {
                let jid = jidNormalizedUser(clave.remoteJid);
                let msg = await store.loadMessage(jid, clave.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            msgRetryCounterMap,
            defaultQueryTimeoutMs: undefined,
            version
        };

        let conn = makeWASocket(connectionOptions);

        if (methodCode && !conn.authState.creds.registered) {
            if (!phoneNumber) process.exit(0);
            let cleanedNumber = phoneNumber.replace(/[^0-9]/g, '');
            setTimeout(async () => {
                let codeBot = await conn.requestPairingCode(cleanedNumber);
                codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot;
                let txt = `*\`「🔱」 Serbot - Code 「🔱」\`*\n\n*\`[ Pasos : ]\`*\n\`1 ❥\` _Click en los 3 puntos_\n\`2 ❥\` _Toca en dispositivos vinculados_\n\`3 ❥\` _Selecciona Vincular con código_\n\`4 ❥\` _Escribe El Código_\n\n> *:⁖֟⊱┈֟፝❥ Nota:* Este Código Solo Funciona Con Quien Lo Solicito`;
                 await parent.reply(m.chat, txt, m, rcanal, fake);
                  await parent.reply(m.chat, codeBot, m);
                rl.close();
            }, 3000);
        }
        
        conn.isInit = false;
        let isInit = true;

        async function connectionUpdate(update) {
            const { connection, lastDisconnect, isNewLogin, qr } = update;
        
            // Verificar si es un nuevo inicio de sesión
            if (isNewLogin) {
                conn.isInit = true;
            }
        
            const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
        
            // Si hay un error en la desconexión y la conexión no está abierta, manejar la desconexión
            if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
                let i = global.conns.indexOf(conn);
                if (i < 0) return;
        
                // Eliminar la conexión de la lista global
                delete global.conns[i];
                global.conns.splice(i, 1);
        
                let phoneNumber = m.sender.split('@')[0];
                let cleanedPhoneNumber = phoneNumber.replace(/\D/g, ''); // Limpiar el número de teléfono
        
                const userFolderPath = `./LynxJadiBot/${cleanedPhoneNumber}`;
        
                // Eliminar el archivo de credenciales si la conexión se cierra o si el usuario se ha deslogueado
                if (code === DisconnectReason.connectionClosed || code === DisconnectReason.loggedOut) {
                    const credsFilePath = path.join(userFolderPath, 'creds.json');
                    if (fs.existsSync(credsFilePath)) {
                        fs.unlinkSync(credsFilePath); // Eliminar el archivo de credenciales
                        console.log('El archivo creds.json ha sido eliminado');
                    }
                }
        
                // Enviar mensaje si la conexión se ha perdido
                if (code !== DisconnectReason.connectionClosed) {
                    await parent.sendMessage(m.chat, { text: "Conexión perdida.." }, { quoted: m });
                }
            }
        
            // Verificar si la base de datos no está cargada
            if (global.db.data == null) loadDatabase();
        
            // Si la conexión está abierta, procesar la reconexión
            if (connection == 'open') {
                conn.isInit = true;
        
                // Agregar la conexión a la lista global
                global.conns.push({
                    user: conn.user,
                    ws: conn.ws,
                    connectedAt: Date.now()
                });
        
                // Enviar mensaje de confirmación de conexión exitosa
                await parent.reply(m.chat, args[0] ? 'Conectado con éxito' : '*\`[ Conectado Exitosamente 🤍 ]\`*\n\n> _Se intentará reconectar en caso de desconexión de sesión_\n> _Si quieres eliminar el subbot borra la sesión en dispositivos vinculados_\n> _El número del bot puede cambiar, guarda este enlace :_\n\nhttps://whatsapp.com/channel/0029Vaxb5xr7z4koGtOAAc1Q', m, rcanal, fake);
        
                // Esperar 5 segundos antes de continuar
                await sleep(5000);
                if (args[0]) return;
        
                await parent.reply(conn.user.jid, `La siguiente vez que se conecte envía el siguiente mensaje para iniciar sesión sin utilizar otro código`, m);
                const credsFilePath = `./LynxJadiBot/${cleanedPhoneNumber}/creds.json`;
        
                if (fs.existsSync(credsFilePath)) {
                    const credsBase64 = Buffer.from(fs.readFileSync(credsFilePath), "utf-8").toString("base64");
                    await parent.sendMessage(conn.user.jid, { 
                        text: usedPrefix + command + " " + credsBase64 
                    }, { quoted: m });
                } else {
                    console.log('No se encontró el archivo creds.json');
                }
            }
        }

        setInterval(async () => {
            if (!conn.user) {
                try { conn.ws.close() } catch { }
                conn.ev.removeAllListeners();
                let i = global.conns.indexOf(conn);
                if (i < 0) return;
                delete global.conns[i];
                global.conns.splice(i, 1);
            }
        }, 60000);

        let handler = await import('../handler.js');
        let creloadHandler = async function (restatConn) {
            try {
                const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error);
                if (Object.keys(Handler || {}).length) handler = Handler;
            } catch (e) {
                console.error(e);
            }
            if (restatConn) {
                try { conn.ws.close() } catch { }
                conn.ev.removeAllListeners();
                conn = makeWASocket(connectionOptions);
                isInit = true;
            }

            if (!isInit) {
                conn.ev.off('messages.upsert', conn.handler);
                conn.ev.off('connection.update', conn.connectionUpdate);
                conn.ev.off('creds.update', conn.credsUpdate);
            }

            conn.handler = handler.handler.bind(conn);
            conn.connectionUpdate = connectionUpdate.bind(conn);
            conn.credsUpdate = saveCreds.bind(conn, true);

            conn.ev.on('messages.upsert', conn.handler);
            conn.ev.on('connection.update', conn.connectionUpdate);
            conn.ev.on('creds.update', conn.credsUpdate);
            isInit = false;
            return true;
        };
        creloadHandler(false);
    }

    serbot();
};

handler.help = ['code'];
handler.tags = ['serbot'];
handler.command = ['code', 'serbotcode'];
handler.rowner = false;

export default handler;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

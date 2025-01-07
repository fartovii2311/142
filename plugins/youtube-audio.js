import fetch from 'node-fetch';

let handler = async (m, { conn, text }) => {
  if (!m.quoted) {
    await m.react('✖️');
    return conn.reply(m.chat, `⚠️ Debes etiquetar el mensaje que contenga el resultado de YouTube Play.`, m);
  }

  if (!m.quoted.text.includes("乂  Y O U T U B E  -  P L A Y")) {
    await m.react('✖️');
    return conn.reply(m.chat, `⚠️ El mensaje etiquetado no contiene un resultado de YouTube Play.`, m);
  }

  const urls = m.quoted.text.match(
    new RegExp(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch|v|embed|shorts)(?:\.php)?(?:\?.*v=|\/))([a-zA-Z0-9_-]+)/, 'gi')
  );

  if (!urls || urls.length < 1) {
    await m.react('✖️');
    return conn.reply(m.chat, `⚠️ No se encontraron enlaces válidos en el mensaje etiquetado.`, m);
  }

  await m.react('🕓');

  const videoUrl = urls[0];
  const apiUrl = `https://axeel.my.id/api/download/audio?url=${videoUrl}`;

  let downloadUrl = null;
  let title = "Archivo de YouTube";
  let size = null;

  try {
    const response = await fetch(apiUrl);
    const apiData = await response.json();

    if (apiData.downloads?.url) {
      title = apiData.metadata.title || "Archivo MP3";
      downloadUrl = apiData.downloads.url;
      size = apiData.downloads.size;
    }
  } catch (error) {
    console.log(`Error con la API: ${apiUrl}`, error.message);
  }

  try {
    const caption = `🎵 *${title}*\n📥 Tamaño: ${size || "Desconocido"}\n🔗 [YouTube Video](${videoUrl})`;
    await conn.sendMessage(m.chat,
      {
        audio: { url: downloadUrl },
        fileName: `${title}.mp3`,
        caption,
        mimetype: 'audio/mpeg',
      },
      { quoted: m }
    );

    await m.react('✅');
  } catch (error) {
    console.error('Error al enviar el audio:', error);
    await m.react('✖️');
  }
};

handler.help = ['Audio'];
handler.tags = ['downloader'];
handler.customPrefix = /^(Audio|audio)$/i;
handl

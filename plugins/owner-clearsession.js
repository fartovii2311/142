import { readdirSync, unlinkSync } from 'fs'
import fs from 'fs'
import { tmpdir } from 'os'
import path from 'path'

let handler = async (m, { conn }) => {
  let Sessions = path.join(tmpdir(), "./Сеанс рыси")

  if (fs.existsSync(Sessions)) {
    readdirSync(Sessions).forEach((file) => {
      let filePath = path.join(Sessions, file)
      if (file !== 'creds.json' && fs.statSync(filePath).isFile()) {
        unlinkSync(filePath)
      }
    })
    await m.react('✅')
  } 
}

handler.help = ['clearsession']
handler.tags = ['owner']
handler.command = /^(сс)$/i
handler.rowner = true

export default handler

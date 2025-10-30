import P from 'pino'
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason } from '../src'

const logger = P({
  level: 'trace',
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: { colorize: true },
        level: 'trace'
      }
    ]
  }
})

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_quick')
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`WA web version: ${version.join('.')} isLatest=${isLatest}`)

  const sock = makeWASocket({
    version,
    logger,
    browser: Browsers.ubuntu('QuickQR'),
    printQRInTerminal: true,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    auth: state
  })

  let sawQR = false

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update as any

    if (qr) {
      sawQR = true
      console.log('QR event received (base64 image omitted)')
    }

    console.log('connection.update:', {
      connection,
      statusCode: lastDisconnect?.error?.output?.statusCode,
      reason: lastDisconnect?.error?.message
    })

    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = status !== DisconnectReason.loggedOut
      console.log('closed with', { status, shouldReconnect })
      // do not loop reconnects; exit to let caller decide
      process.exit(shouldReconnect ? 2 : 0)
    } else if (connection === 'open') {
      console.log('connected (should not happen during QR test)')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // auto exit if no QR after 30s
  setTimeout(() => {
    if (!sawQR) {
      console.error('No QR emitted within timeout')
      process.exit(3)
    }
  }, 30000)
}

main().catch((err) => {
  console.error('quick-qr fatal:', err)
  process.exit(1)
})
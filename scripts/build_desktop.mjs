// Build desktop/plugin.js from desktop/src (run: node scripts/build_desktop.mjs)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = readFileSync(path.join(root, 'desktop', 'src', 'plugin.src.js'), 'utf8')
const qrlib = readFileSync(path.join(root, 'desktop', 'src', 'qrlib.js'), 'utf8').trimEnd()
const out = src.replace('/*__QRLIB__*/', () => qrlib + '\n')
writeFileSync(path.join(root, 'desktop', 'plugin.js'), out)
console.log('desktop/plugin.js', Buffer.byteLength(out), 'bytes')

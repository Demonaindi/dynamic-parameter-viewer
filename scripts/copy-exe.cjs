const fs = require('fs')
const path = require('path')
const os = require('os')

const releaseDir = path.join(os.tmpdir(), 'logueador-release')
const desktop = path.join(os.homedir(), 'Desktop')
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
const expected = `Dynamic-Parameter-viewer-${pkg.version}-portable.exe`
const from = path.join(releaseDir, expected)

if (!fs.existsSync(from)) {
  console.error('No se encontró', from)
  process.exit(1)
}

const to = path.join(desktop, expected)
fs.copyFileSync(from, to)
const mb = (fs.statSync(to).size / (1024 * 1024)).toFixed(1)
console.log(`Listo: ${to} (${mb} MB)`)

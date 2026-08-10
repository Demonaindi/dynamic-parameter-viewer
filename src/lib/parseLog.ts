import * as XLSX from 'xlsx'
import type { LogMeta, LogParameter, ParsedLog } from './types'

export type ParseErrorCode =
  | 'error.parseFormat'
  | 'error.noParams'
  | 'error.noData'
  | 'error.noSheet'

export class ParseLogError extends Error {
  code: ParseErrorCode
  constructor(code: ParseErrorCode) {
    super(code)
    this.code = code
  }
}

type LogFormat = 'viaje' | 'recording'

function normalizeKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '')
  if (!t || t === '-' || t === '--' || t === '__' || t === '___') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function decodeBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes)
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function splitRow(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim())
  if (line.includes(';')) return line.split(';').map((c) => c.trim())
  return line.split(',').map((c) => c.trim())
}

function isParamHeader(norm: string): boolean {
  return (
    norm.startsWith('PARAMETROS') ||
    norm.startsWith('PARAMETERS') ||
    norm.startsWith('PARAMETRI')
  )
}

function isUnitHeader(norm: string): boolean {
  return (
    norm.startsWith('UNIDAD DE MEDIDA') ||
    norm.startsWith('UNIDADE DE MEDICAO') ||
    norm.startsWith('UNIT OF MEASURE') ||
    norm.startsWith('UNITA DI MISURA') ||
    norm.startsWith('MEASUREMENT UNIT')
  )
}

function isTimeHeader(norm: string): boolean {
  return (
    norm.includes('TIEMPOS RELATIVOS') ||
    norm.includes('TEMPO REL') ||
    norm.includes('TEMPI RELATIVI') ||
    norm.includes('RELATIVE TIME') ||
    norm.includes('HORA DETECCION') ||
    norm.includes('PER. DETECAO') ||
    norm.includes('PER DETECAO') ||
    norm.includes('DETECTION TIME') ||
    norm.includes('ORA RILEVAZIONE')
  )
}

function parseSampleIndex(cell: string): number | null {
  const m = cell.trim().match(/^n\s*[°ºo.]?\s*:\s*0*(\d+)\s*$/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function findHeaderIndices(lines: string[]): {
  paramLine: number
  unitLine: number
  dataStart: number
  format: LogFormat
} {
  let paramLine = -1
  let unitLine = -1
  let timeHeader = -1

  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeKey(lines[i])
    if (paramLine < 0 && isParamHeader(norm)) paramLine = i
    if (unitLine < 0 && isUnitHeader(norm)) unitLine = i
    if (timeHeader < 0 && isTimeHeader(norm)) timeHeader = i
  }

  if (paramLine < 0) {
    throw new ParseLogError('error.parseFormat')
  }
  if (unitLine < 0) unitLine = paramLine + 1

  if (timeHeader >= 0) {
    return {
      paramLine,
      unitLine,
      dataStart: timeHeader + 1,
      format: 'viaje',
    }
  }

  let dataStart = unitLine + 1
  for (let i = unitLine + 1; i < lines.length; i++) {
    const cells = splitRow(lines[i])
    if (cells[0] && parseSampleIndex(cells[0]) !== null) {
      dataStart = i
      break
    }
  }

  return { paramLine, unitLine, dataStart, format: 'recording' }
}

const META_ALIASES: Record<string, string> = {
  MARCA: 'MARCA',
  BRAND: 'MARCA',
  MAKE: 'MARCA',
  MODELO: 'MODELO',
  MODEL: 'MODELO',
  MODELLO: 'MODELO',
  MOTORIZACION: 'MOTORIZACION',
  'TIPO DE MOTOR': 'MOTORIZACION',
  ENGINE: 'MOTORIZACION',
  MOTORIZZAZIONE: 'MOTORIZACION',
  'ENGINE TYPE': 'MOTORIZACION',
  'TIPO SISTEMA': 'TIPO SISTEMA',
  'TIPO DO SISTEMA': 'TIPO SISTEMA',
  'SYSTEM TYPE': 'TIPO SISTEMA',
  'CODIGO MOTOR': 'CODIGO MOTOR',
  'CODIGO DO MOTOR': 'CODIGO MOTOR',
  'ENGINE CODE': 'CODIGO MOTOR',
  'CODICE MOTORE': 'CODIGO MOTOR',
  SISTEMA: 'SISTEMA',
  SYSTEM: 'SISTEMA',
  PERIODO: 'PERIODO',
  PERIOD: 'PERIODO',
  'INICIO VIAJE': 'INICIO VIAJE',
  'INICIO PERC': 'INICIO VIAJE',
  'START TRIP': 'INICIO VIAJE',
  'TRIP START': 'INICIO VIAJE',
  'INIZIO VIAGGIO': 'INICIO VIAJE',
  'INIZIO PERC': 'INICIO VIAJE',
  'FIN VIAJE': 'FIN VIAJE',
  'FIM PERC': 'FIN VIAJE',
  'END TRIP': 'FIN VIAJE',
  'TRIP END': 'FIN VIAJE',
  'FINE VIAGGIO': 'FIN VIAJE',
  'FINE PERC': 'FIN VIAJE',
  'TIPO REGISTRAZIONE': 'TIPO REGISTRO',
  'TIPO REGISTRO': 'TIPO REGISTRO',
  'RECORDING TYPE': 'TIPO REGISTRO',
  'NUMERO CAMPIONI': 'MUESTRAS',
  'NUMERO DE MUESTRAS': 'MUESTRAS',
  'SAMPLE COUNT': 'MUESTRAS',
  CAMPIONAMENTO: 'MUESTREO',
  MUESTREO: 'MUESTREO',
  SAMPLING: 'MUESTREO',
}

function canonicalizeMetaKey(key: string): string {
  const norm = normalizeKey(key)
  return META_ALIASES[norm] || norm
}

function parseMeta(lines: string[], stopAt: number): LogMeta {
  const meta: LogMeta = {}
  for (let i = 0; i < stopAt; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = canonicalizeMetaKey(line.slice(0, idx).trim())
    const value = line.slice(idx + 1).trim()
    if (key && value) meta[key] = value
  }
  return meta
}

function parseSamplingSeconds(meta: LogMeta, lines: string[]): number {
  const raw = meta.MUESTREO || ''
  const fromMeta = raw.match(/([\d.,]+)\s*s?/i)
  if (fromMeta) {
    const n = parseNumber(fromMeta[1])
    if (n && n > 0) return n
  }
  for (const line of lines) {
    const norm = normalizeKey(line)
    if (!norm.includes('CAMPIONAMENTO') && !norm.includes('MUESTREO') && !norm.includes('SAMPLING')) {
      continue
    }
    const m = line.match(/([\d.,]+)\s*s/i)
    if (m) {
      const n = parseNumber(m[1])
      if (n && n > 0) return n
    }
  }
  return 0.5
}

function uniquifyNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = (seen.get(name) || 0) + 1
    seen.set(name, count)
    return count === 1 ? name : `${name} (${count})`
  })
}

function parseParameterNames(paramCells: string[]): string[] {
  const names: string[] = []
  for (let i = 1; i < paramCells.length; i++) {
    const cell = paramCells[i]
    if (!cell || cell === '') continue
    const norm = normalizeKey(cell)
    if (norm === 'PARAMETROS' || norm === 'PARAMETERS' || norm === 'PARAMETRI') continue
    names.push(cell)
  }
  return uniquifyNames(names)
}

function metaFromFilename(sourceName: string): LogMeta {
  const base = sourceName.replace(/\.[^.]+$/i, '')
  const skip = new Set([
    'ESP',
    'ENG',
    'EN',
    'PT',
    'IT',
    'OK',
    'GABARITO',
    'LOG',
    'PARAMETRI',
    'PARAMETROS',
  ])
  const parts = base
    .split(/[_\s-]+/)
    .map((p) => p.trim())
    .filter((p) => p && !skip.has(p.toUpperCase()))
  if (parts.length === 0) return {}
  if (parts.length === 1) return { MODELO: parts[0] }
  return {
    MARCA: parts[0],
    MODELO: parts.slice(1).join(' '),
  }
}

function parseFromLines(lines: string[], sourceName: string): ParsedLog {
  const nonempty = lines.filter((l, i) => l.trim() || i < 25)
  const { paramLine, unitLine, dataStart, format } = findHeaderIndices(nonempty)
  const meta = {
    ...metaFromFilename(sourceName),
    ...parseMeta(nonempty, paramLine),
  }

  const paramCells = splitRow(nonempty[paramLine])
  const unitCells = splitRow(nonempty[unitLine] || '')
  const names = parseParameterNames(paramCells)

  if (names.length === 0) {
    throw new ParseLogError('error.noParams')
  }

  const units = names.map((_, i) => {
    const unitIdx = format === 'recording' ? i + 1 : i + 2
    return (unitCells[unitIdx] || '').trim()
  })

  const sampling = parseSamplingSeconds(meta, nonempty)
  meta.MUESTREO = meta.MUESTREO || `${sampling}s`

  const timeSeconds: number[] = []
  const timeLabels: string[] = []
  const detectionTimes: string[] = []
  const valueColumns: (number | null)[][] = names.map(() => [])

  for (let i = dataStart; i < nonempty.length; i++) {
    const line = nonempty[i].trim()
    if (!line) continue
    const cells = splitRow(line)
    if (cells.length < 2) continue

    let t: number | null = null
    let valueOffset = 2
    let detection = ''

    if (format === 'recording') {
      const sampleIdx = parseSampleIndex(cells[0] || '')
      if (sampleIdx === null) continue
      t = (sampleIdx - 1) * sampling
      valueOffset = 1
      detection = String(sampleIdx)
    } else {
      t = parseNumber(cells[0])
      if (t === null) continue
      detection = cells[1] || ''
      valueOffset = 2
    }

    timeSeconds.push(t)
    timeLabels.push(formatElapsed(t))
    detectionTimes.push(detection)

    for (let p = 0; p < names.length; p++) {
      const cell = cells[p + valueOffset] ?? ''
      valueColumns[p].push(parseNumber(cell))
    }
  }

  if (timeSeconds.length === 0) {
    throw new ParseLogError('error.noData')
  }

  const parameters: LogParameter[] = names.map((name, i) => ({
    name,
    unit: units[i] || '',
    values: valueColumns[i],
  }))

  return { meta, timeSeconds, timeLabels, detectionTimes, parameters, sourceName }
}

function sheetToLines(sheet: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })
  return rows.map((row) =>
    row.map((c) => String(c ?? '').trim()).join('\t'),
  )
}

export async function parseLogFile(file: File): Promise<ParsedLog> {
  const name = file.name
  const lower = name.toLowerCase()
  const buf = await file.arrayBuffer()

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) {
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) throw new ParseLogError('error.noSheet')
    return parseFromLines(sheetToLines(sheet), name)
  }

  const text = decodeBuffer(buf)
  return parseFromLines(splitLines(text), name)
}

export function metaLabel(key: string, t?: (k: string) => string): string {
  const canon = canonicalizeMetaKey(key)
  if (t) {
    const translated = t(`meta.${canon}`)
    if (translated !== `meta.${canon}`) return translated
  }
  return canon
}

export type LogMeta = Record<string, string>

export type LogParameter = {
  name: string
  unit: string
  values: (number | null)[]
}

export type ParsedLog = {
  meta: LogMeta
  timeSeconds: number[]
  timeLabels: string[]
  detectionTimes: string[]
  parameters: LogParameter[]
  sourceName: string
}

export type ChartMark = {
  id: string
  index: number
}

export const MARK_COLORS = [
  '#e65100',
  '#6a1b9a',
  '#00838f',
  '#ad1457',
  '#f9a825',
  '#283593',
  '#558b2f',
  '#c62828',
]

export const CHART_COLORS = [
  '#c62828',
  '#2e7d32',
  '#1565c0',
  '#616161',
  '#ef6c00',
  '#6a1b9a',
  '#00838f',
  '#ad1457',
  '#558b2f',
  '#283593',
  '#f9a825',
  '#455a64',
]

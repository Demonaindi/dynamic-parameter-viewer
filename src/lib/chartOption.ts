import type { EChartsOption } from 'echarts'
import type { ChartMark, CompareMark, LogParameter, ParsedLog } from './types'
import { CHART_COLORS, MARK_COLORS } from './types'

export const PANEL_HEIGHT = 210
export const PDF_PANELS_PER_PAGE = 4
export const PDF_MARK_PARAMS_PER_TABLE = 4
export const PDF_MARK_PARAMS_PER_TABLE_COMPARE = 2

export type ZoomRange = { start: number; end: number }

export type ExportWindow = {
  startPercent: number
  endPercent: number
}

export function clampExportWindow(win: ExportWindow): ExportWindow {
  let start = Math.max(0, Math.min(99.9, win.startPercent))
  let end = Math.max(0.1, Math.min(100, win.endPercent))
  if (end <= start) end = Math.min(100, start + 0.5)
  return {
    startPercent: Number(start.toFixed(1)),
    endPercent: Number(end.toFixed(1)),
  }
}

export function indicesFromPercent(
  length: number,
  startPct: number,
  endPct: number,
): { start: number; end: number } {
  if (length <= 0) return { start: 0, end: 0 }
  if (length === 1) return { start: 0, end: 0 }
  const start = Math.max(
    0,
    Math.min(length - 1, Math.floor((startPct / 100) * (length - 1))),
  )
  const end = Math.max(
    start,
    Math.min(length - 1, Math.ceil((endPct / 100) * (length - 1))),
  )
  return { start, end }
}

export function labelAtIndex(log: ParsedLog, index: number): string {
  const det = log.detectionTimes[index]
  if (det && det.trim()) return det
  return log.timeLabels[index] ?? '—'
}

export function shiftZoomRange(
  zoom: ZoomRange,
  direction: -1 | 1,
  fraction = 0.2,
): ZoomRange {
  const span = Math.max(1, zoom.end - zoom.start)
  let start = zoom.start + direction * span * fraction
  let end = zoom.end + direction * span * fraction
  if (start < 0) {
    end -= start
    start = 0
  }
  if (end > 100) {
    start -= end - 100
    end = 100
  }
  start = Math.max(0, start)
  end = Math.min(100, end)
  if (end - start < 1) {
    if (direction < 0) {
      start = 0
      end = Math.min(100, span)
    } else {
      end = 100
      start = Math.max(0, 100 - span)
    }
  }
  return {
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
  }
}

export const COMPARE_COLOR_A = '#0c2577'
export const COMPARE_COLOR_B = '#c62828'

function yRange(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return { min: 0, max: 1 }
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min
  const pad = span === 0 ? Math.max(Math.abs(max) * 0.1, 1) : span * 0.15
  return {
    min: Number((min - pad).toFixed(3)),
    max: Number((max + pad).toFixed(3)),
  }
}

export function paramLabel(p: LogParameter): string {
  return p.unit ? `${p.name} (${p.unit})` : p.name
}

export function resolveParams(log: ParsedLog, selectedNames: string[]) {
  return selectedNames
    .map((name) => log.parameters.find((p) => p.name === name))
    .filter((p): p is LogParameter => Boolean(p))
}

export function commonParamNames(logA: ParsedLog, logB: ParsedLog): string[] {
  const setB = new Set(logB.parameters.map((p) => p.name))
  return logA.parameters.map((p) => p.name).filter((n) => setB.has(n))
}

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function toSeriesPoints(
  log: ParsedLog,
  param: LogParameter,
  offsetSec = 0,
): [number, number | null][] {
  return log.timeSeconds.map((t, i) => [t + offsetSec, param.values[i] ?? null])
}

export { toSeriesPoints, yRange, formatElapsed }

export function peakTime(log: ParsedLog, paramName: string): number | null {
  const param = log.parameters.find((p) => p.name === paramName)
  if (!param) return null
  let best = -Infinity
  let bestT: number | null = null
  for (let i = 0; i < param.values.length; i++) {
    const v = param.values[i]
    if (v === null) continue
    if (v > best) {
      best = v
      bestT = log.timeSeconds[i] ?? null
    }
  }
  return bestT
}

export function alignOffsetsByPeak(
  logA: ParsedLog,
  logB: ParsedLog,
  paramName: string,
): { offsetA: number; offsetB: number } | null {
  const peakA = peakTime(logA, paramName)
  const peakB = peakTime(logB, paramName)
  if (peakA === null || peakB === null) return null
  return { offsetA: 0, offsetB: Number((peakA - peakB).toFixed(1)) }
}

export function suggestAlignParams(names: string[]): string[] {
  const scored = names.map((name) => {
    const n = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    let score = 0
    if (
      /\brpm\b/.test(n) ||
      n.includes('regimen') ||
      n.includes('regime') ||
      n.includes('engine speed') ||
      n.includes('rotacao') ||
      n.includes('rotazione')
    ) {
      score += 100
    }
    if (
      n.includes('mariposa') ||
      n.includes('throttle') ||
      n.includes('borboleta') ||
      n.includes('farfalla')
    ) {
      score += 50
    }
    if (n.includes('veloc') || n.includes('speed')) score += 30
    return { name, score }
  })
  return scored.sort((a, b) => b.score - a.score).map((x) => x.name)
}

export function formatSampleValue(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  const abs = Math.abs(n)
  if (abs >= 1000) return n.toFixed(0)
  if (abs >= 10) return n.toFixed(1)
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

export function markLabel(order: number): string {
  return `M${order}`
}

export function buildSeriesMarkExtras(
  _log: ParsedLog,
  param: LogParameter,
  marks: ChartMark[],
) {
  if (marks.length === 0) {
    return { markLine: undefined, markPoint: undefined }
  }

  const markLine = {
    silent: true,
    symbol: ['none', 'none'] as [string, string],
    animation: false,
    data: marks.map((m, i) => {
      const color = MARK_COLORS[i % MARK_COLORS.length]
      const value = param.values[m.index]
      return {
        name: markLabel(i + 1),
        xAxis: m.index,
        label: {
          show: true,
          position: 'insideEndTop' as const,
          formatter: `${markLabel(i + 1)}\n${formatSampleValue(value)}`,
          color,
          fontSize: 10,
          fontWeight: 700 as const,
          lineHeight: 13,
        },
        lineStyle: {
          color,
          type: 'dashed' as const,
          width: 1.6,
        },
      }
    }),
  }

  const markPoint = {
    silent: true,
    animation: false,
    symbol: 'circle',
    symbolSize: 8,
    data: marks
      .map((m, i) => {
        const value = param.values[m.index]
        if (value === null || value === undefined) return null
        const color = MARK_COLORS[i % MARK_COLORS.length]
        return {
          name: markLabel(i + 1),
          coord: [m.index, value] as [number, number],
          itemStyle: { color, borderColor: '#fff', borderWidth: 1.5 },
          label: { show: false },
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  }

  return { markLine, markPoint }
}

const STACK_TITLE_H = 34
const STACK_GAP = 12
const STACK_LEFT = 22
const STACK_RIGHT = 62
export const STACK_AXIS_AREA = 62

export function stackedChartHeight(panelCount: number): number {
  return Math.max(1, panelCount) * PANEL_HEIGHT + STACK_AXIS_AREA
}

function stackedGrids(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    left: STACK_LEFT,
    right: STACK_RIGHT,
    top: i * PANEL_HEIGHT + STACK_TITLE_H,
    height: PANEL_HEIGHT - STACK_TITLE_H - STACK_GAP,
    containLabel: false,
  }))
}

function valueAxisLabel() {
  return {
    color: '#546e7a',
    fontSize: 11,
    formatter: (v: number) => {
      const abs = Math.abs(v)
      if (abs >= 1000) return v.toFixed(0)
      if (abs >= 10) return v.toFixed(1)
      return v.toFixed(2)
    },
  }
}

function stackedDataZoom(count: number, sliderLabel?: (v: number) => string) {
  const xAxisIndex = Array.from({ length: count }, (_, i) => i)
  return [
    {
      type: 'inside' as const,
      xAxisIndex,
      filterMode: 'none' as const,
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: true,
      preventDefaultMouseMove: true,
      throttle: 0,
      start: 0,
      end: 100,
    },
    {
      type: 'slider' as const,
      xAxisIndex,
      filterMode: 'none' as const,
      height: 18,
      bottom: 8,
      left: STACK_LEFT,
      right: STACK_RIGHT,
      borderColor: '#cfd8dc',
      fillerColor: 'rgba(12, 37, 119, 0.18)',
      handleStyle: { color: '#0c2577' },
      textStyle: { color: '#607d8b', fontSize: 10 },
      brushSelect: false,
      realtime: true,
      throttle: 0,
      ...(sliderLabel ? { labelFormatter: sliderLabel } : {}),
      start: 0,
      end: 100,
    },
  ]
}

export function buildStackedOption(
  log: ParsedLog,
  params: LogParameter[],
  marks: ChartMark[] = [],
): EChartsOption {
  const count = params.length
  const last = count - 1

  return {
    animation: false,
    backgroundColor: '#fff',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#cfd8dc',
      textStyle: { color: '#263238', fontSize: 12 },
      valueFormatter: (v) =>
        v === null || v === undefined || Number.isNaN(Number(v))
          ? '—'
          : String(v),
    },
    axisPointer: { snap: true },
    title: params.map((p, i) => ({
      text: paramLabel(p),
      left: STACK_LEFT,
      top: i * PANEL_HEIGHT + 10,
      textStyle: {
        fontSize: 13,
        fontWeight: 600 as const,
        color: CHART_COLORS[i % CHART_COLORS.length],
        fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif',
      },
    })),
    grid: stackedGrids(count),
    xAxis: params.map((_, i) => ({
      type: 'category' as const,
      gridIndex: i,
      data: log.timeLabels,
      boundaryGap: false,
      axisLabel: {
        show: i === last,
        color: '#546e7a',
        fontSize: 11,
        hideOverlap: true,
      },
      axisTick: { show: i === last },
      axisLine: { lineStyle: { color: '#cfd8dc' } },
      splitLine: { show: true, lineStyle: { color: '#eef2f4' } },
    })),
    yAxis: params.map((p, i) => {
      const { min, max } = yRange(p.values)
      return {
        type: 'value' as const,
        gridIndex: i,
        position: 'right' as const,
        min,
        max,
        scale: true,
        axisLabel: valueAxisLabel(),
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#eef2f4' } },
        name: p.unit || '',
        nameLocation: 'end' as const,
        nameGap: 8,
        nameTextStyle: {
          color: '#78909c',
          fontSize: 10,
          align: 'right' as const,
        },
      }
    }),
    series: params.map((p, i) => {
      const color = CHART_COLORS[i % CHART_COLORS.length]
      const { markLine, markPoint } = buildSeriesMarkExtras(log, p, marks)
      return {
        name: paramLabel(p),
        type: 'line' as const,
        showSymbol: false,
        sampling: 'lttb' as const,
        xAxisIndex: i,
        yAxisIndex: i,
        data: p.values,
        lineStyle: { width: 1.8, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}33` },
              { offset: 1, color: `${color}05` },
            ],
          },
        },
        markLine,
        markPoint,
      }
    }),
    dataZoom: stackedDataZoom(count),
  }
}

export function nearestIndexAt(log: ParsedLog, localTime: number): number {
  const times = log.timeSeconds
  if (times.length === 0) return -1
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs((times[i] ?? 0) - localTime)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export function sampleAtAxisTime(
  log: ParsedLog,
  paramName: string,
  axisTime: number,
  offset: number,
): number | null {
  const idx = nearestIndexAt(log, axisTime - offset)
  if (idx < 0) return null
  const param = log.parameters.find((p) => p.name === paramName)
  return param?.values[idx] ?? null
}

export function buildCompareMarkExtras(
  marks: CompareMark[],
  paramName: string,
  logA: ParsedLog,
  logB: ParsedLog,
  offsetA: number,
  offsetB: number,
  visibility: CompareVisibility,
) {
  if (marks.length === 0) {
    return { markLine: undefined, markPoint: undefined }
  }

  const markLine = {
    silent: true,
    symbol: ['none', 'none'] as [string, string],
    animation: false,
    data: marks.map((m, i) => {
      const color = MARK_COLORS[i % MARK_COLORS.length]
      const va =
        visibility !== 'b'
          ? sampleAtAxisTime(logA, paramName, m.time, offsetA)
          : null
      const vb =
        visibility !== 'a'
          ? sampleAtAxisTime(logB, paramName, m.time, offsetB)
          : null
      const parts = [`${markLabel(i + 1)} · ${formatElapsed(m.time)}`]
      if (visibility !== 'b') parts.push(`A ${formatSampleValue(va)}`)
      if (visibility !== 'a') parts.push(`B ${formatSampleValue(vb)}`)
      return {
        name: markLabel(i + 1),
        xAxis: m.time,
        label: {
          show: true,
          position: 'insideEndTop' as const,
          formatter: parts.join('\n'),
          color,
          fontSize: 10,
          fontWeight: 700 as const,
          lineHeight: 13,
        },
        lineStyle: {
          color,
          type: 'dashed' as const,
          width: 1.6,
        },
      }
    }),
  }

  const markPointData: Array<{
    name: string
    coord: [number, number]
    itemStyle: { color: string; borderColor: string; borderWidth: number }
    label: { show: boolean }
  }> = []

  marks.forEach((m, i) => {
    const color = MARK_COLORS[i % MARK_COLORS.length]
    if (visibility !== 'b') {
      const va = sampleAtAxisTime(logA, paramName, m.time, offsetA)
      if (va !== null) {
        markPointData.push({
          name: `${markLabel(i + 1)}A`,
          coord: [m.time, va],
          itemStyle: { color: COMPARE_COLOR_A, borderColor: '#fff', borderWidth: 1.5 },
          label: { show: false },
        })
      }
    }
    if (visibility !== 'a') {
      const vb = sampleAtAxisTime(logB, paramName, m.time, offsetB)
      if (vb !== null) {
        markPointData.push({
          name: `${markLabel(i + 1)}B`,
          coord: [m.time, vb],
          itemStyle: {
            color: visibility === 'both' ? color : COMPARE_COLOR_B,
            borderColor: '#fff',
            borderWidth: 1.5,
          },
          label: { show: false },
        })
      }
    }
  })

  return {
    markLine,
    markPoint: {
      silent: true,
      animation: false,
      symbol: 'circle',
      symbolSize: 8,
      data: markPointData,
    },
  }
}

export type CompareVisibility = 'both' | 'a' | 'b'

type CompareTipItem = {
  axisValue?: number | string
  marker?: string
  seriesName?: string
  value?: unknown
}

export function buildCompareStackedOption(
  logA: ParsedLog,
  logB: ParsedLog,
  names: string[],
  visibility: CompareVisibility,
  opts: {
    labelA: string
    labelB: string
    offsetA?: number
    offsetB?: number
    marks?: CompareMark[]
  },
): EChartsOption {
  const offsetA = opts.offsetA ?? 0
  const offsetB = opts.offsetB ?? 0
  const marks = opts.marks ?? []
  const count = names.length
  const last = count - 1

  const series: Record<string, unknown>[] = []
  names.forEach((name, i) => {
    const paramA = logA.parameters.find((p) => p.name === name)
    const paramB = logB.parameters.find((p) => p.name === name)
    const extras = buildCompareMarkExtras(
      marks,
      name,
      logA,
      logB,
      offsetA,
      offsetB,
      visibility,
    )
    let markHost = true

    if (visibility !== 'b' && paramA) {
      series.push({
        name: opts.labelA,
        type: 'line',
        showSymbol: false,
        sampling: 'lttb',
        xAxisIndex: i,
        yAxisIndex: i,
        data: toSeriesPoints(logA, paramA, offsetA),
        z: 1,
        lineStyle: { width: 2, color: COMPARE_COLOR_A },
        itemStyle: { color: COMPARE_COLOR_A },
        ...(visibility === 'a'
          ? {
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${COMPARE_COLOR_A}33` },
                    { offset: 1, color: `${COMPARE_COLOR_A}05` },
                  ],
                },
              },
            }
          : {}),
        ...(markHost
          ? { markLine: extras.markLine, markPoint: extras.markPoint }
          : {}),
      })
      markHost = false
    }

    if (visibility !== 'a' && paramB) {
      series.push({
        name: opts.labelB,
        type: 'line',
        showSymbol: false,
        sampling: 'lttb',
        xAxisIndex: i,
        yAxisIndex: i,
        data: toSeriesPoints(logB, paramB, offsetB),
        z: 2,
        lineStyle: {
          width: 2,
          color: COMPARE_COLOR_B,
          type: visibility === 'both' ? 'dashed' : 'solid',
        },
        itemStyle: { color: COMPARE_COLOR_B },
        ...(visibility === 'b'
          ? {
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${COMPARE_COLOR_B}33` },
                    { offset: 1, color: `${COMPARE_COLOR_B}05` },
                  ],
                },
              },
            }
          : {}),
        ...(markHost
          ? { markLine: extras.markLine, markPoint: extras.markPoint }
          : {}),
      })
    }
  })

  return {
    animation: false,
    backgroundColor: '#fff',
    legend: {
      show: true,
      top: 6,
      right: STACK_RIGHT + 8,
      data: [
        ...(visibility !== 'b' ? [opts.labelA] : []),
        ...(visibility !== 'a' ? [opts.labelB] : []),
      ],
      textStyle: { fontSize: 11, color: '#546e7a' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#cfd8dc',
      textStyle: { color: '#263238', fontSize: 12 },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params]
        if (list.length === 0) return ''
        const head = formatElapsed(Number((list[0] as CompareTipItem).axisValue))
        const rows = list.map((raw) => {
          const item = raw as CompareTipItem
          const value = Array.isArray(item.value) ? item.value[1] : item.value
          const shown = formatSampleValue(
            typeof value === 'number' ? value : null,
          )
          return `${item.marker ?? ''}${item.seriesName ?? ''}&nbsp;<b>${shown}</b>`
        })
        return [`<b>${head}</b>`, ...rows].join('<br/>')
      },
    },
    axisPointer: { snap: false },
    title: names.map((name, i) => {
      const unit =
        logA.parameters.find((p) => p.name === name)?.unit ||
        logB.parameters.find((p) => p.name === name)?.unit ||
        ''
      return {
        text: unit ? `${name} (${unit})` : name,
        left: STACK_LEFT,
        top: i * PANEL_HEIGHT + 10,
        textStyle: {
          fontSize: 13,
          fontWeight: 600 as const,
          color: '#0c2577',
          fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif',
        },
      }
    }),
    grid: stackedGrids(count),
    xAxis: names.map((_, i) => ({
      type: 'value' as const,
      gridIndex: i,
      min: 'dataMin' as const,
      max: 'dataMax' as const,
      axisLabel: {
        show: i === last,
        color: '#546e7a',
        fontSize: 11,
        formatter: (v: number) => formatElapsed(v),
      },
      axisTick: { show: i === last },
      axisLine: { lineStyle: { color: '#cfd8dc' } },
      splitLine: { show: true, lineStyle: { color: '#eef2f4' } },
    })),
    yAxis: names.map((name, i) => {
      const paramA = logA.parameters.find((p) => p.name === name)
      const paramB = logB.parameters.find((p) => p.name === name)
      const unit = paramA?.unit || paramB?.unit || ''
      const values: (number | null)[] = []
      if (visibility !== 'b' && paramA) values.push(...paramA.values)
      if (visibility !== 'a' && paramB) values.push(...paramB.values)
      const { min, max } = yRange(values)
      return {
        type: 'value' as const,
        gridIndex: i,
        position: 'right' as const,
        min,
        max,
        scale: true,
        axisLabel: valueAxisLabel(),
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#eef2f4' } },
        name: unit,
        nameLocation: 'end' as const,
        nameGap: 8,
        nameTextStyle: {
          color: '#78909c',
          fontSize: 10,
          align: 'right' as const,
        },
      }
    }),
    series: series as EChartsOption['series'],
    dataZoom: stackedDataZoom(count, (v: number) => formatElapsed(v)),
  }
}

export function chunkParams<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

import type { EChartsOption } from 'echarts'
import type { LogParameter, ParsedLog } from './types'
import { CHART_COLORS } from './types'

export const PANEL_HEIGHT = 210
export const PDF_PANELS_PER_PAGE = 4

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

export function buildPanelOption(
  log: ParsedLog,
  param: LogParameter,
  colorIndex: number,
  opts: {
    showXAxis: boolean
    showSlider: boolean
  },
): EChartsOption {
  const color = CHART_COLORS[colorIndex % CHART_COLORS.length]
  const { min, max } = yRange(param.values)
  const label = paramLabel(param)

  return {
    animation: false,
    backgroundColor: '#fff',
    title: {
      text: label,
      left: 8,
      top: 6,
      textStyle: {
        fontSize: 13,
        fontWeight: 600,
        color,
        fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif',
      },
    },
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
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
    },
    grid: {
      left: 18,
      right: 58,
      top: 36,
      bottom: opts.showSlider ? 52 : opts.showXAxis ? 28 : 12,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: log.timeLabels,
      boundaryGap: false,
      axisLabel: {
        show: opts.showXAxis || opts.showSlider,
        color: '#546e7a',
        fontSize: 11,
        hideOverlap: true,
      },
      axisTick: { show: opts.showXAxis },
      axisLine: { lineStyle: { color: '#cfd8dc' } },
      splitLine: {
        show: true,
        lineStyle: { color: '#eef2f4' },
      },
    },
    yAxis: {
      type: 'value',
      position: 'right',
      min,
      max,
      scale: true,
      axisLabel: {
        color: '#546e7a',
        fontSize: 11,
        formatter: (v: number) => {
          const abs = Math.abs(v)
          if (abs >= 1000) return v.toFixed(0)
          if (abs >= 10) return v.toFixed(1)
          return v.toFixed(2)
        },
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#eef2f4' } },
      name: param.unit || '',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { color: '#78909c', fontSize: 10, align: 'right' },
    },
    series: [
      {
        name: label,
        type: 'line',
        showSymbol: false,
        sampling: 'lttb',
        data: param.values,
        lineStyle: { width: 1.8, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear',
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
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none',
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
      ...(opts.showSlider
        ? [
            {
              type: 'slider' as const,
              xAxisIndex: 0,
              height: 18,
              bottom: 6,
              borderColor: '#cfd8dc',
              fillerColor: 'rgba(12, 37, 119, 0.18)',
              handleStyle: { color: '#0c2577' },
              textStyle: { color: '#607d8b', fontSize: 10 },
              brushSelect: false,
            },
          ]
        : []),
    ],
  }
}

export type CompareVisibility = 'both' | 'a' | 'b'

export function buildComparePanelOption(
  logA: ParsedLog,
  logB: ParsedLog,
  paramName: string,
  visibility: CompareVisibility,
  opts: {
    showXAxis: boolean
    showSlider: boolean
    labelA: string
    labelB: string
    offsetA?: number
    offsetB?: number
  },
): EChartsOption {
  const offsetA = opts.offsetA ?? 0
  const offsetB = opts.offsetB ?? 0
  const paramA = logA.parameters.find((p) => p.name === paramName)
  const paramB = logB.parameters.find((p) => p.name === paramName)
  const unit = paramA?.unit || paramB?.unit || ''
  const title = unit ? `${paramName} (${unit})` : paramName

  const values: (number | null)[] = []
  if (visibility !== 'b' && paramA) values.push(...paramA.values)
  if (visibility !== 'a' && paramB) values.push(...paramB.values)
  const { min, max } = yRange(values)

  const series = []
  if (visibility !== 'b' && paramA) {
    series.push({
      name: opts.labelA,
      type: 'line' as const,
      showSymbol: false,
      sampling: 'lttb' as const,
      data: toSeriesPoints(logA, paramA, offsetA),
      z: 1,
      lineStyle: { width: 2, color: COMPARE_COLOR_A },
      itemStyle: { color: COMPARE_COLOR_A },
      areaStyle:
        visibility === 'a'
          ? {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${COMPARE_COLOR_A}33` },
                  { offset: 1, color: `${COMPARE_COLOR_A}05` },
                ],
              },
            }
          : undefined,
    })
  }
  if (visibility !== 'a' && paramB) {
    series.push({
      name: opts.labelB,
      type: 'line' as const,
      showSymbol: false,
      sampling: 'lttb' as const,
      data: toSeriesPoints(logB, paramB, offsetB),
      z: 2,
      lineStyle: {
        width: 2,
        color: COMPARE_COLOR_B,
        type: visibility === 'both' ? ('dashed' as const) : ('solid' as const),
      },
      itemStyle: { color: COMPARE_COLOR_B },
      areaStyle:
        visibility === 'b'
          ? {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${COMPARE_COLOR_B}33` },
                  { offset: 1, color: `${COMPARE_COLOR_B}05` },
                ],
              },
            }
          : undefined,
    })
  }

  return {
    animation: false,
    backgroundColor: '#fff',
    title: {
      text: title,
      left: 8,
      top: 6,
      textStyle: {
        fontSize: 13,
        fontWeight: 600,
        color: '#0c2577',
        fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif',
      },
    },
    legend: {
      show: true,
      top: 4,
      right: 70,
      textStyle: { fontSize: 11, color: '#546e7a' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#cfd8dc',
      textStyle: { color: '#263238', fontSize: 12 },
    },
    grid: {
      left: 18,
      right: 58,
      top: 40,
      bottom: opts.showSlider ? 52 : opts.showXAxis ? 28 : 12,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      min: 'dataMin',
      max: 'dataMax',
      axisLabel: {
        show: opts.showXAxis || opts.showSlider,
        color: '#546e7a',
        fontSize: 11,
        formatter: (v: number) => formatElapsed(v),
      },
      axisTick: { show: opts.showXAxis },
      axisLine: { lineStyle: { color: '#cfd8dc' } },
      splitLine: { show: true, lineStyle: { color: '#eef2f4' } },
    },
    yAxis: {
      type: 'value',
      position: 'right',
      min,
      max,
      scale: true,
      axisLabel: {
        color: '#546e7a',
        fontSize: 11,
        formatter: (v: number) => {
          const abs = Math.abs(v)
          if (abs >= 1000) return v.toFixed(0)
          if (abs >= 10) return v.toFixed(1)
          return v.toFixed(2)
        },
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#eef2f4' } },
      name: unit,
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { color: '#78909c', fontSize: 10, align: 'right' },
    },
    series,
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none',
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
      ...(opts.showSlider
        ? [
            {
              type: 'slider' as const,
              xAxisIndex: 0,
              height: 18,
              bottom: 6,
              borderColor: '#cfd8dc',
              fillerColor: 'rgba(12, 37, 119, 0.18)',
              handleStyle: { color: '#0c2577' },
              textStyle: { color: '#607d8b', fontSize: 10 },
              brushSelect: false,
              labelFormatter: (v: number) => formatElapsed(v),
            },
          ]
        : []),
    ],
  }
}

export function chunkParams<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

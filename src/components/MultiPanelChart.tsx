import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption, EChartsType } from 'echarts'
import { shiftZoomRange, type ZoomRange } from '../lib/chartOption'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  option: EChartsOption
  height: number
  panelCount: number
  resetKey?: string
  onAxisClick?: (value: number) => void
}

type ZrEvent = { offsetX: number; offsetY: number }

type DataZoomEvent = {
  start?: number
  end?: number
  batch?: Array<{ start?: number; end?: number }>
}

const FULL_RANGE: ZoomRange = { start: 0, end: 100 }

function readZoomFromEvent(params: DataZoomEvent): ZoomRange | null {
  const src = params.batch?.[0] ?? params
  if (typeof src.start !== 'number' || typeof src.end !== 'number') return null
  return { start: src.start, end: src.end }
}

function readZoomFromChart(chart: EChartsType): ZoomRange | null {
  const opt = chart.getOption() as {
    dataZoom?: Array<{ start?: number; end?: number }>
  }
  const dz = opt.dataZoom?.[0]
  if (!dz || typeof dz.start !== 'number' || typeof dz.end !== 'number') {
    return null
  }
  return { start: dz.start, end: dz.end }
}

function withZoom(option: EChartsOption, zoom: ZoomRange): EChartsOption {
  const raw = option.dataZoom
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  return {
    ...option,
    dataZoom: list.map((dz) => ({
      ...(dz as object),
      start: zoom.start,
      end: zoom.end,
    })),
  } as EChartsOption
}

export function MultiPanelChart({
  option,
  height,
  panelCount,
  resetKey,
  onAxisClick,
}: Props) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const zoomRef = useRef<ZoomRange>({ ...FULL_RANGE })
  const clickRef = useRef(onAxisClick)
  clickRef.current = onAxisClick
  const panelsRef = useRef(panelCount)
  panelsRef.current = panelCount
  const zoomCountRef = useRef(1)
  zoomCountRef.current = Array.isArray(option.dataZoom)
    ? Math.max(1, option.dataZoom.length)
    : 1

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    chartRef.current = chart

    chart.on('datazoom', (params: unknown) => {
      const next =
        readZoomFromEvent(params as DataZoomEvent) ?? readZoomFromChart(chart)
      if (next) zoomRef.current = next
    })

    const zr = chart.getZr()
    let down: { x: number; y: number } | null = null

    zr.on('mousedown', (e: ZrEvent) => {
      down = { x: e.offsetX, y: e.offsetY }
    })

    zr.on('mouseup', (e: ZrEvent) => {
      const start = down
      down = null
      if (!start || !clickRef.current) return
      if (Math.abs(e.offsetX - start.x) > 6) return
      if (Math.abs(e.offsetY - start.y) > 6) return

      const point: [number, number] = [e.offsetX, e.offsetY]
      let inside = false
      for (let i = 0; i < panelsRef.current; i++) {
        if (chart.containPixel({ gridIndex: i }, point)) {
          inside = true
          break
        }
      }
      if (!inside) return

      const value = chart.convertFromPixel({ xAxisIndex: 0 }, e.offsetX)
      if (typeof value !== 'number' || Number.isNaN(value)) return
      clickRef.current(value)
    })

    const observer = new ResizeObserver(() => chart.resize())
    if (scrollRef.current) observer.observe(scrollRef.current)

    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    zoomRef.current = { ...FULL_RANGE }
  }, [resetKey])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.resize()
    chart.setOption(withZoom(option, zoomRef.current), {
      notMerge: true,
      lazyUpdate: false,
    })
  }, [option, height])

  const pan = (direction: -1 | 1) => {
    const chart = chartRef.current
    if (!chart) return
    const next = shiftZoomRange(zoomRef.current, direction, 0.25)
    zoomRef.current = next
    for (let i = 0; i < zoomCountRef.current; i++) {
      chart.dispatchAction({
        type: 'dataZoom',
        dataZoomIndex: i,
        start: next.start,
        end: next.end,
      })
    }
  }

  return (
    <div className="charts-nav">
      <button
        type="button"
        className="charts-nav-btn left"
        aria-label={t('charts.panLeft')}
        onClick={() => pan(-1)}
      >
        ‹
      </button>
      <div className="charts-stack" ref={scrollRef}>
        <div
          className="charts-canvas"
          ref={hostRef}
          style={{ height, width: '100%' }}
        />
      </div>
      <button
        type="button"
        className="charts-nav-btn right"
        aria-label={t('charts.panRight')}
        onClick={() => pan(1)}
      >
        ›
      </button>
    </div>
  )
}

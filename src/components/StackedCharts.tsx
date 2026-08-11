import { useEffect, useId, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import type { EChartsType } from 'echarts'
import type { ChartMark, ParsedLog } from '../lib/types'
import {
  PANEL_HEIGHT,
  buildPanelOption,
  resolveParams,
  buildSeriesMarkExtras,
} from '../lib/chartOption'
import { CHART_COLORS } from '../lib/types'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  log: ParsedLog
  selected: string[]
  marks?: ChartMark[]
  onToggleMark?: (index: number) => void
  onReady?: (charts: EChartsType[]) => void
}

export function StackedCharts({
  log,
  selected,
  marks = [],
  onToggleMark,
  onReady,
}: Props) {
  const { t } = useI18n()
  const groupId = useId().replace(/:/g, '')
  const instances = useRef<EChartsType[]>([])
  const clickCleanups = useRef<Array<() => void>>([])
  const params = useMemo(() => resolveParams(log, selected), [log, selected])
  const onToggleRef = useRef(onToggleMark)
  onToggleRef.current = onToggleMark
  const logLenRef = useRef(log.timeLabels.length)
  logLenRef.current = log.timeLabels.length

  useEffect(() => {
    if (instances.current.length > 0) {
      echarts.connect(groupId)
    }
    return () => {
      echarts.disconnect(groupId)
      clickCleanups.current.forEach((fn) => fn())
      clickCleanups.current = []
    }
  }, [groupId, params.length])

  if (params.length === 0) {
    return (
      <div className="charts-empty">{t('params.emptyCharts')}</div>
    )
  }

  const attachClick = (chart: EChartsType) => {
    const zr = chart.getZr()
    let down: { x: number; y: number } | null = null

    const onDown = (e: { offsetX: number; offsetY: number }) => {
      down = { x: e.offsetX, y: e.offsetY }
    }

    const onUp = (e: { offsetX: number; offsetY: number }) => {
      if (!down || !onToggleRef.current) {
        down = null
        return
      }
      const dx = Math.abs(e.offsetX - down.x)
      const dy = Math.abs(e.offsetY - down.y)
      down = null
      if (dx > 6 || dy > 6) return
      if (!chart.containPixel('grid', [e.offsetX, e.offsetY])) return
      const point = chart.convertFromPixel({ seriesIndex: 0 }, [
        e.offsetX,
        e.offsetY,
      ])
      if (!point || point[0] === undefined) return
      const index = Math.round(Number(point[0]))
      if (index < 0 || index >= logLenRef.current) return
      onToggleRef.current(index)
    }

    zr.on('mousedown', onDown)
    zr.on('mouseup', onUp)
    clickCleanups.current.push(() => {
      zr.off('mousedown', onDown)
      zr.off('mouseup', onUp)
    })
  }

  const register = (idx: number, chart: EChartsType) => {
    chart.group = groupId
    instances.current[idx] = chart
    attachClick(chart)
    if (instances.current.filter(Boolean).length === params.length) {
      echarts.connect(groupId)
      onReady?.(instances.current.slice(0, params.length))
    }
  }

  return (
    <div className="charts-stack" data-group={groupId}>
      {params.map((param, i) => {
        const isLast = i === params.length - 1
        const option = buildPanelOption(log, param, i, {
          showXAxis: isLast,
          showSlider: isLast,
          marks,
        })
        const height = isLast ? PANEL_HEIGHT + 36 : PANEL_HEIGHT
        return (
          <div key={param.name} className="chart-panel" style={{ height }}>
            <ReactECharts
              option={option}
              style={{ height: '100%', width: '100%' }}
              notMerge
              lazyUpdate
              opts={{ renderer: 'canvas' }}
              onChartReady={(instance) => register(i, instance)}
            />
          </div>
        )
      })}
    </div>
  )
}

export async function renderPanelsToDataUrls(
  log: ParsedLog,
  selected: string[],
  panelsPerPage = 4,
  marks: ChartMark[] = [],
): Promise<string[]> {
  const params = resolveParams(log, selected)
  if (params.length === 0) return []

  const width = 1100
  const urls: string[] = []

  for (let start = 0; start < params.length; start += panelsPerPage) {
    const slice = params.slice(start, start + panelsPerPage)
    const height = slice.length * PANEL_HEIGHT + 48
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;background:#fff;`
    document.body.appendChild(el)

    const chart = echarts.init(el, undefined, {
      renderer: 'canvas',
      width,
      height,
    })

    const grids = slice.map((_, i) => ({
      left: 24,
      right: 64,
      top: 40 + i * PANEL_HEIGHT,
      height: PANEL_HEIGHT - 44,
    }))

    chart.setOption({
      animation: false,
      backgroundColor: '#fff',
      title: slice.map((p, i) => ({
        text: p.unit ? `${p.name} (${p.unit})` : p.name,
        left: 24,
        top: 14 + i * PANEL_HEIGHT,
        textStyle: {
          fontSize: 13,
          fontWeight: 600,
          color: CHART_COLORS[(start + i) % CHART_COLORS.length],
        },
      })),
      grid: grids,
      xAxis: slice.map((_, i) => ({
        type: 'category',
        gridIndex: i,
        data: log.timeLabels,
        boundaryGap: false,
        axisLabel: {
          show: i === slice.length - 1,
          color: '#546e7a',
          fontSize: 11,
          hideOverlap: true,
        },
        axisTick: { show: i === slice.length - 1 },
        axisLine: { lineStyle: { color: '#cfd8dc' } },
        splitLine: { show: true, lineStyle: { color: '#eef2f4' } },
      })),
      yAxis: slice.map((p, i) => {
        const nums = p.values.filter((v): v is number => v !== null)
        const min = nums.length ? Math.min(...nums) : 0
        const max = nums.length ? Math.max(...nums) : 1
        const span = max - min
        const pad = span === 0 ? Math.max(Math.abs(max) * 0.1, 1) : span * 0.15
        return {
          type: 'value',
          gridIndex: i,
          position: 'right',
          min: Number((min - pad).toFixed(3)),
          max: Number((max + pad).toFixed(3)),
          scale: true,
          axisLabel: { color: '#546e7a', fontSize: 11 },
          splitLine: { lineStyle: { color: '#eef2f4' } },
          axisLine: { show: false },
        }
      }),
      series: slice.map((p, i) => {
        const color = CHART_COLORS[(start + i) % CHART_COLORS.length]
        const extras = buildSeriesMarkExtras(log, p, marks)
        return {
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          xAxisIndex: i,
          yAxisIndex: i,
          data: p.values,
          lineStyle: { width: 1.8, color },
          itemStyle: { color },
          markLine: extras.markLine,
          markPoint: extras.markPoint,
        }
      }),
    })

    await new Promise((r) => requestAnimationFrame(() => r(null)))
    urls.push(
      chart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      }),
    )
    chart.dispose()
    document.body.removeChild(el)
  }

  return urls
}

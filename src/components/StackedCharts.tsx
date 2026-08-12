import { useMemo } from 'react'
import * as echarts from 'echarts'
import type { ChartMark, ParsedLog } from '../lib/types'
import {
  PANEL_HEIGHT,
  buildStackedOption,
  resolveParams,
  stackedChartHeight,
  buildSeriesMarkExtras,
  type ZoomRange,
} from '../lib/chartOption'
import { CHART_COLORS } from '../lib/types'
import { useI18n } from '../i18n/I18nContext'
import { MultiPanelChart } from './MultiPanelChart'

type Props = {
  log: ParsedLog
  selected: string[]
  marks?: ChartMark[]
  onToggleMark?: (index: number) => void
}

export function StackedCharts({
  log,
  selected,
  marks = [],
  onToggleMark,
}: Props) {
  const { t } = useI18n()
  const params = useMemo(() => resolveParams(log, selected), [log, selected])
  const option = useMemo(
    () => buildStackedOption(log, params, marks),
    [log, params, marks],
  )

  if (params.length === 0) {
    return <div className="charts-empty">{t('params.emptyCharts')}</div>
  }

  const handleClick = (value: number) => {
    if (!onToggleMark) return
    const index = Math.round(value)
    if (index < 0 || index >= log.timeLabels.length) return
    onToggleMark(index)
  }

  return (
    <MultiPanelChart
      option={option}
      height={stackedChartHeight(params.length)}
      panelCount={params.length}
      resetKey={log.sourceName}
      onAxisClick={handleClick}
    />
  )
}

export async function renderPanelsToDataUrls(
  log: ParsedLog,
  selected: string[],
  panelsPerPage = 4,
  marks: ChartMark[] = [],
  viewRange?: ZoomRange,
): Promise<string[]> {
  const params = resolveParams(log, selected)
  if (params.length === 0) return []
  const zoom = viewRange ?? { start: 0, end: 100 }

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
      dataZoom: slice.map((_, i) => ({
        type: 'inside',
        xAxisIndex: i,
        start: zoom.start,
        end: zoom.end,
        disabled: true,
      })),
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

import { useEffect, useId, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import type { EChartsType } from 'echarts'
import type { ParsedLog } from '../lib/types'
import {
  PANEL_HEIGHT,
  buildPanelOption,
  resolveParams,
} from '../lib/chartOption'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  log: ParsedLog
  selected: string[]
  onReady?: (charts: EChartsType[]) => void
}

export function StackedCharts({ log, selected, onReady }: Props) {
  const { t } = useI18n()
  const groupId = useId().replace(/:/g, '')
  const instances = useRef<EChartsType[]>([])
  const params = useMemo(() => resolveParams(log, selected), [log, selected])

  useEffect(() => {
    if (instances.current.length > 0) {
      echarts.connect(groupId)
    }
    return () => {
      echarts.disconnect(groupId)
    }
  }, [groupId, params.length])

  if (params.length === 0) {
    return (
      <div className="charts-empty">
        {t('params.emptyCharts')}
      </div>
    )
  }

  const register = (idx: number, chart: EChartsType) => {
    chart.group = groupId
    instances.current[idx] = chart
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
          color: ['#c62828', '#2e7d32', '#1565c0', '#616161', '#ef6c00', '#6a1b9a', '#00838f', '#ad1457'][
            (start + i) % 8
          ],
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
        const colors = [
          '#c62828',
          '#2e7d32',
          '#1565c0',
          '#616161',
          '#ef6c00',
          '#6a1b9a',
          '#00838f',
          '#ad1457',
        ]
        const color = colors[(start + i) % colors.length]
        return {
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          xAxisIndex: i,
          yAxisIndex: i,
          data: p.values,
          lineStyle: { width: 1.8, color },
          itemStyle: { color },
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

import { useEffect, useId, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import type { EChartsType } from 'echarts'
import type { ParsedLog } from '../lib/types'
import {
  PANEL_HEIGHT,
  buildComparePanelOption,
  COMPARE_COLOR_A,
  COMPARE_COLOR_B,
  formatElapsed,
  toSeriesPoints,
  yRange,
  type CompareVisibility,
} from '../lib/chartOption'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  logA: ParsedLog
  logB: ParsedLog
  selected: string[]
  visibility: CompareVisibility
  labelA: string
  labelB: string
  offsetA: number
  offsetB: number
}

export function CompareCharts({
  logA,
  logB,
  selected,
  visibility,
  labelA,
  labelB,
  offsetA,
  offsetB,
}: Props) {
  const { t } = useI18n()
  const groupId = useId().replace(/:/g, '')
  const instances = useRef<EChartsType[]>([])
  const params = useMemo(() => selected, [selected])

  useEffect(() => {
    if (instances.current.length > 0) echarts.connect(groupId)
    return () => {
      echarts.disconnect(groupId)
    }
  }, [groupId, params.length, visibility, offsetA, offsetB])

  if (params.length === 0) {
    return <div className="charts-empty">{t('params.emptyCommon')}</div>
  }

  const register = (idx: number, chart: EChartsType) => {
    chart.group = groupId
    instances.current[idx] = chart
    if (instances.current.filter(Boolean).length === params.length) {
      echarts.connect(groupId)
    }
  }

  return (
    <div className="charts-stack" data-group={groupId}>
      {params.map((name, i) => {
        const isLast = i === params.length - 1
        const option = buildComparePanelOption(logA, logB, name, visibility, {
          showXAxis: isLast,
          showSlider: isLast,
          labelA,
          labelB,
          offsetA,
          offsetB,
        })
        const height = isLast ? PANEL_HEIGHT + 36 : PANEL_HEIGHT
        return (
          <div key={`${name}-${offsetA}-${offsetB}`} className="chart-panel" style={{ height }}>
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

export async function renderComparePanelsToDataUrls(
  logA: ParsedLog,
  logB: ParsedLog,
  selected: string[],
  visibility: CompareVisibility,
  offsetA: number,
  offsetB: number,
  panelsPerPage = 4,
): Promise<string[]> {
  if (selected.length === 0) return []

  const width = 1100
  const urls: string[] = []

  for (let start = 0; start < selected.length; start += panelsPerPage) {
    const slice = selected.slice(start, start + panelsPerPage)
    const height = slice.length * PANEL_HEIGHT + 56
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;background:#fff;`
    document.body.appendChild(el)

    const chart = echarts.init(el, undefined, {
      renderer: 'canvas',
      width,
      height,
    })

    const grids = slice.map((_, i) => ({
      left: 28,
      right: 64,
      top: 44 + i * PANEL_HEIGHT,
      height: PANEL_HEIGHT - 48,
    }))

    const titles = slice.map((name, i) => {
      const unit =
        logA.parameters.find((p) => p.name === name)?.unit ||
        logB.parameters.find((p) => p.name === name)?.unit ||
        ''
      return {
        text: unit ? `${name} (${unit})` : name,
        left: 28,
        top: 16 + i * PANEL_HEIGHT,
        textStyle: {
          fontSize: 13,
          fontWeight: 600 as const,
          color: '#0c2577',
        },
      }
    })

    const xAxes = slice.map((_, i) => ({
      type: 'value' as const,
      gridIndex: i,
      min: 'dataMin' as const,
      max: 'dataMax' as const,
      axisLabel: {
        show: i === slice.length - 1,
        color: '#546e7a',
        fontSize: 11,
        formatter: (v: number) => formatElapsed(v),
      },
      axisTick: { show: i === slice.length - 1 },
      axisLine: { lineStyle: { color: '#cfd8dc' } },
      splitLine: { show: true, lineStyle: { color: '#eef2f4' } },
    }))

    const yAxes = slice.map((name, i) => {
      const paramA = logA.parameters.find((p) => p.name === name)
      const paramB = logB.parameters.find((p) => p.name === name)
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
        axisLabel: { color: '#546e7a', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef2f4' } },
        axisLine: { show: false },
      }
    })

    const series: object[] = []
    slice.forEach((name, i) => {
      const paramA = logA.parameters.find((p) => p.name === name)
      const paramB = logB.parameters.find((p) => p.name === name)
      if (visibility !== 'b' && paramA) {
        series.push({
          name: i === 0 ? 'A' : undefined,
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          xAxisIndex: i,
          yAxisIndex: i,
          data: toSeriesPoints(logA, paramA, offsetA),
          lineStyle: { width: 1.8, color: COMPARE_COLOR_A },
          itemStyle: { color: COMPARE_COLOR_A },
        })
      }
      if (visibility !== 'a' && paramB) {
        series.push({
          name: i === 0 ? 'B' : undefined,
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          xAxisIndex: i,
          yAxisIndex: i,
          data: toSeriesPoints(logB, paramB, offsetB),
          lineStyle: {
            width: 1.8,
            color: COMPARE_COLOR_B,
            type: visibility === 'both' ? 'dashed' : 'solid',
          },
          itemStyle: { color: COMPARE_COLOR_B },
        })
      }
    })

    chart.setOption({
      animation: false,
      backgroundColor: '#fff',
      title: titles,
      legend: {
        show: true,
        top: 4,
        right: 70,
        data: [
          ...(visibility !== 'b' ? ['A'] : []),
          ...(visibility !== 'a' ? ['B'] : []),
        ],
        textStyle: { fontSize: 11, color: '#546e7a' },
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
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

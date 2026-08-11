import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDropzone } from './components/FileDropzone'
import { ParamSelector } from './components/ParamSelector'
import { StackedCharts, renderPanelsToDataUrls } from './components/StackedCharts'
import { CompareCharts, renderComparePanelsToDataUrls } from './components/CompareCharts'
import { CompareParamSelector } from './components/CompareParamSelector'
import { MarksPanel } from './components/MarksPanel'
import { ExportWorkshopModal } from './components/ExportWorkshopModal'
import {
  loadWorkshop,
  saveWorkshop,
  type WorkshopInfo,
} from './components/WorkshopForm'
import { LangSwitcher } from './components/LangSwitcher'
import { ShiftAlignPanel } from './components/ShiftAlignPanel'
import { parseLogFile, ParseLogError } from './lib/parseLog'
import { exportComparePdfReport, exportPdfReport } from './lib/exportPdf'
import {
  PDF_PANELS_PER_PAGE,
  alignOffsetsByPeak,
  commonParamNames,
  suggestAlignParams,
  type CompareVisibility,
} from './lib/chartOption'
import type { ChartMark, ParsedLog } from './lib/types'
import { useI18n } from './i18n/I18nContext'
import './App.css'

type AppMode = 'analisis' | 'comparativa'
type ExportKind = 'analisis' | 'comparativa' | null

const APP_NAME = 'Dynamic Parameter viewer'

function shortLabel(log: ParsedLog, fallback: string) {
  const marca = log.meta.MARCA || ''
  const modelo = log.meta.MODELO || ''
  const name = `${marca} ${modelo}`.trim()
  return name || log.sourceName || fallback
}

export default function App() {
  const { t } = useI18n()
  const [mode, setMode] = useState<AppMode>('analisis')
  const [workshop, setWorkshop] = useState<WorkshopInfo>(loadWorkshop)
  const [error, setError] = useState<string | null>(null)
  const [exportKind, setExportKind] = useState<ExportKind>(null)

  const [log, setLog] = useState<ParsedLog | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [marks, setMarks] = useState<ChartMark[]>([])
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [logA, setLogA] = useState<ParsedLog | null>(null)
  const [logB, setLogB] = useState<ParsedLog | null>(null)
  const [busyA, setBusyA] = useState(false)
  const [busyB, setBusyB] = useState(false)
  const [compareSelected, setCompareSelected] = useState<string[]>([])
  const [visibility, setVisibility] = useState<CompareVisibility>('both')
  const [offsetA, setOffsetA] = useState(0)
  const [offsetB, setOffsetB] = useState(0)
  const [alignParam, setAlignParam] = useState('')

  const commonNames = useMemo(() => {
    if (!logA || !logB) return []
    return commonParamNames(logA, logB)
  }, [logA, logB])

  useEffect(() => {
    if (!logA || !logB) {
      setCompareSelected([])
      setOffsetA(0)
      setOffsetB(0)
      setAlignParam('')
      return
    }
    const names = commonParamNames(logA, logB)
    setCompareSelected(names.slice(0, Math.min(4, names.length)))
    const suggested = suggestAlignParams(names)
    setAlignParam(suggested[0] || '')
    setOffsetA(0)
    setOffsetB(0)
  }, [logA, logB])

  const shiftRange = useMemo(() => {
    const durA = logA?.timeSeconds.at(-1) ?? 0
    const durB = logB?.timeSeconds.at(-1) ?? 0
    return Math.max(30, Math.ceil(Math.max(durA, durB)))
  }, [logA, logB])

  const mapError = useCallback(
    (e: unknown) => {
      if (e instanceof ParseLogError) return t(e.code)
      if (e instanceof Error && e.message.startsWith('error.')) return t(e.message)
      return t('error.read')
    },
    [t],
  )

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      try {
        const parsed = await parseLogFile(file)
        setLog(parsed)
        setSelected(parsed.parameters.slice(0, 4).map((p) => p.name))
        setMarks([])
      } catch (e) {
        setLog(null)
        setSelected([])
        setMarks([])
        setError(mapError(e))
      } finally {
        setBusy(false)
      }
    },
    [mapError],
  )

  const toggleMark = useCallback((index: number) => {
    setMarks((prev) => {
      const existing = prev.find((m) => m.index === index)
      if (existing) return prev.filter((m) => m.id !== existing.id)
      return [...prev, { id: `m-${index}-${Date.now()}`, index }]
    })
  }, [])

  const loadCompare = useCallback(
    async (slot: 'a' | 'b', file: File) => {
      if (slot === 'a') setBusyA(true)
      else setBusyB(true)
      setError(null)
      try {
        const parsed = await parseLogFile(file)
        if (slot === 'a') setLogA(parsed)
        else setLogB(parsed)
      } catch (e) {
        if (slot === 'a') setLogA(null)
        else setLogB(null)
        setError(mapError(e))
      } finally {
        if (slot === 'a') setBusyA(false)
        else setBusyB(false)
      }
    },
    [mapError],
  )

  const labelA = logA ? shortLabel(logA, 'A') : 'A'
  const labelB = logB ? shortLabel(logB, 'B') : 'B'

  const runExport = async (data: WorkshopInfo) => {
    saveWorkshop(data)
    setWorkshop(data)
    setExporting(true)
    try {
      if (exportKind === 'analisis') {
        if (!log) return
        const pages = await renderPanelsToDataUrls(
          log,
          selected,
          PDF_PANELS_PER_PAGE,
          marks,
        )
        await exportPdfReport(log, pages, data, t, { marks, selected })
      } else if (exportKind === 'comparativa') {
        if (!logA || !logB || compareSelected.length === 0) return
        const pages = await renderComparePanelsToDataUrls(
          logA,
          logB,
          compareSelected,
          visibility,
          offsetA,
          offsetB,
          PDF_PANELS_PER_PAGE,
        )
        await exportComparePdfReport(logA, logB, pages, data, t, {
          labelA,
          labelB,
          offsetA,
          offsetB,
          visibility,
        })
      }
      setExportKind(null)
    } catch {
      setError(t('error.export'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="./texa-logo.png?v=1.5.0" alt="TEXA" />
          <div>
            <h1>{APP_NAME}</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>
        <div className="top-actions">
          <LangSwitcher />
          <nav className="mode-tabs" aria-label="Mode">
            <button
              type="button"
              className={`mode-tab ${mode === 'analisis' ? 'active' : ''}`}
              onClick={() => setMode('analisis')}
            >
              {t('nav.analisis')}
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'comparativa' ? 'active' : ''}`}
              onClick={() => setMode('comparativa')}
            >
              {t('nav.comparativa')}
            </button>
          </nav>
          {mode === 'analisis' && log ? (
            <button
              type="button"
              className="btn primary"
              disabled={exporting || selected.length === 0}
              onClick={() => setExportKind('analisis')}
            >
              {t('btn.exportPdf')}
            </button>
          ) : null}
          {mode === 'comparativa' && logA && logB ? (
            <button
              type="button"
              className="btn primary"
              disabled={exporting || compareSelected.length === 0}
              onClick={() => setExportKind('comparativa')}
            >
              {t('btn.exportPdf')}
            </button>
          ) : null}
        </div>
      </header>

      {mode === 'analisis' ? (
        <main className="layout">
          <aside className="sidebar">
            <FileDropzone onFile={onFile} busy={busy} />
            {error ? <div className="error">{error}</div> : null}
            {log ? (
              <>
                <div className="file-chip">
                  <span>{log.sourceName}</span>
                  <em>
                    {t('chip.samples', {
                      n: log.timeSeconds.length,
                      p: log.parameters.length,
                    })}
                  </em>
                </div>
                <ParamSelector log={log} selected={selected} onChange={setSelected} />
                <MarksPanel
                  log={log}
                  selected={selected}
                  marks={marks}
                  onRemove={(id) => setMarks((prev) => prev.filter((m) => m.id !== id))}
                  onClear={() => setMarks([])}
                />
              </>
            ) : (
              <div className="hint">{t('hint.analisis')}</div>
            )}
          </aside>

          <section className="stage">
            {log ? (
              <>
                <div className="stage-head">
                  <h2>{t('stage.analisis')}</h2>
                  <span>
                    {log.meta['MARCA'] || ''} {log.meta['MODELO'] || ''} ·{' '}
                    {log.meta['INICIO VIAJE'] || ''} → {log.meta['FIN VIAJE'] || ''}
                    {marks.length > 0 ? ` · ${t('marks.count', { n: marks.length })}` : ''}
                  </span>
                  <em className="marks-hint">{t('marks.hint')}</em>
                </div>
                <StackedCharts
                  log={log}
                  selected={selected}
                  marks={marks}
                  onToggleMark={toggleMark}
                />
              </>
            ) : (
              <div className="stage-empty">
                <h2>{t('stage.empty.title')}</h2>
                <p>{t('stage.empty.body')}</p>
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className="layout">
          <aside className="sidebar">
            <FileDropzone
              tone="a"
              title={t('drop.a.title')}
              subtitle={t('drop.a.subtitle')}
              busy={busyA}
              onFile={(f) => loadCompare('a', f)}
            />
            {logA ? (
              <div className="file-chip chip-a">
                <span>A · {logA.sourceName}</span>
                <em>
                  {t('chip.samples', {
                    n: logA.timeSeconds.length,
                    p: logA.parameters.length,
                  })}
                </em>
              </div>
            ) : null}

            <FileDropzone
              tone="b"
              title={t('drop.b.title')}
              subtitle={t('drop.b.subtitle')}
              busy={busyB}
              onFile={(f) => loadCompare('b', f)}
            />
            {logB ? (
              <div className="file-chip chip-b">
                <span>B · {logB.sourceName}</span>
                <em>
                  {t('chip.samples', {
                    n: logB.timeSeconds.length,
                    p: logB.parameters.length,
                  })}
                </em>
              </div>
            ) : null}

            {error ? <div className="error">{error}</div> : null}

            {logA && logB ? (
              <>
                <section className="panel">
                  <div className="panel-head">
                    <h2>{t('vis.title')}</h2>
                  </div>
                  <div className="visibility-row">
                    <button
                      type="button"
                      className={`vis-btn ${visibility === 'a' ? 'active' : ''}`}
                      onClick={() => setVisibility('a')}
                    >
                      {t('vis.a')}
                    </button>
                    <button
                      type="button"
                      className={`vis-btn ${visibility === 'both' ? 'active' : ''}`}
                      onClick={() => setVisibility('both')}
                    >
                      {t('vis.both')}
                    </button>
                    <button
                      type="button"
                      className={`vis-btn ${visibility === 'b' ? 'active' : ''}`}
                      onClick={() => setVisibility('b')}
                    >
                      {t('vis.b')}
                    </button>
                  </div>
                  <div className="legend-row">
                    <span>
                      <i style={{ background: '#0c2577' }} /> {labelA}
                    </span>
                    <span>
                      <i className="dashed" style={{ background: '#c62828' }} /> {labelB}
                    </span>
                  </div>
                </section>
                <CompareParamSelector
                  names={commonNames}
                  selected={compareSelected}
                  onChange={setCompareSelected}
                  logA={logA}
                  logB={logB}
                />
                <ShiftAlignPanel
                  commonNames={commonNames}
                  offsetA={offsetA}
                  offsetB={offsetB}
                  onOffsetA={setOffsetA}
                  onOffsetB={setOffsetB}
                  alignParam={alignParam}
                  onAlignParam={setAlignParam}
                  range={shiftRange}
                  onReset={() => {
                    setOffsetA(0)
                    setOffsetB(0)
                  }}
                  onAlignPeak={() => {
                    if (!alignParam) return
                    const aligned = alignOffsetsByPeak(logA, logB, alignParam)
                    if (!aligned) return
                    setOffsetA(aligned.offsetA)
                    setOffsetB(aligned.offsetB)
                  }}
                />
              </>
            ) : (
              <div className="hint">{t('hint.compare')}</div>
            )}
          </aside>

          <section className="stage">
            {logA && logB ? (
              <>
                <div className="stage-head">
                  <h2>{t('stage.compare')}</h2>
                  <span>
                    A: {labelA}
                    {logA.meta['INICIO VIAJE'] ? ` (${logA.meta['INICIO VIAJE']})` : ''}
                    {' · '}
                    B: {labelB}
                    {logB.meta['INICIO VIAJE'] ? ` (${logB.meta['INICIO VIAJE']})` : ''}
                    {offsetA !== 0 || offsetB !== 0
                      ? ` · ΔA ${offsetA >= 0 ? '+' : ''}${offsetA.toFixed(1)}s · ΔB ${offsetB >= 0 ? '+' : ''}${offsetB.toFixed(1)}s`
                      : ''}
                  </span>
                </div>
                <CompareCharts
                  logA={logA}
                  logB={logB}
                  selected={compareSelected}
                  visibility={visibility}
                  labelA="A"
                  labelB="B"
                  offsetA={offsetA}
                  offsetB={offsetB}
                />
              </>
            ) : (
              <div className="stage-empty">
                <h2>{t('stage.compare.empty.title')}</h2>
                <p>{t('stage.compare.empty.body')}</p>
              </div>
            )}
          </section>
        </main>
      )}

      {exportKind ? (
        <ExportWorkshopModal
          value={workshop}
          onChange={setWorkshop}
          busy={exporting}
          onCancel={() => {
            if (!exporting) setExportKind(null)
          }}
          onConfirm={() => runExport(workshop)}
        />
      ) : null}
    </div>
  )
}

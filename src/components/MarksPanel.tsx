import type { ChartMark, CompareMark, ParsedLog } from '../lib/types'
import { MARK_COLORS } from '../lib/types'
import {
  formatElapsed,
  formatSampleValue,
  markLabel,
  resolveParams,
  sampleAtAxisTime,
  type CompareVisibility,
} from '../lib/chartOption'
import { useI18n } from '../i18n/I18nContext'

type AnalisisProps = {
  mode?: 'analisis'
  log: ParsedLog
  selected: string[]
  marks: ChartMark[]
  onRemove: (id: string) => void
  onClear: () => void
}

type CompareProps = {
  mode: 'compare'
  logA: ParsedLog
  logB: ParsedLog
  selected: string[]
  marks: CompareMark[]
  offsetA: number
  offsetB: number
  visibility: CompareVisibility
  onRemove: (id: string) => void
  onClear: () => void
}

type Props = AnalisisProps | CompareProps

export function MarksPanel(props: Props) {
  const { t } = useI18n()
  const { marks, onRemove, onClear } = props

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('marks.title')}</h2>
        {marks.length > 0 ? (
          <button type="button" className="btn ghost" onClick={onClear}>
            {t('marks.clear')}
          </button>
        ) : null}
      </div>
      <p className="marks-help">{t('marks.help')}</p>
      {marks.length === 0 ? (
        <p className="marks-empty">{t('marks.empty')}</p>
      ) : props.mode === 'compare' ? (
        <ul className="marks-list">
          {props.marks.map((m, i) => {
            const color = MARK_COLORS[i % MARK_COLORS.length]
            const mark = m as CompareMark
            return (
              <li key={mark.id} className="marks-item">
                <div className="marks-item-top">
                  <strong style={{ color }}>{markLabel(i + 1)}</strong>
                  <span>{formatElapsed(mark.time)}</span>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => onRemove(mark.id)}
                  >
                    {t('marks.remove')}
                  </button>
                </div>
                {props.selected.length > 0 ? (
                  <div className="marks-values">
                    {props.selected.map((name) => {
                      const unit =
                        props.logA.parameters.find((p) => p.name === name)?.unit ||
                        props.logB.parameters.find((p) => p.name === name)?.unit ||
                        ''
                      const va =
                        props.visibility !== 'b'
                          ? sampleAtAxisTime(
                              props.logA,
                              name,
                              mark.time,
                              props.offsetA,
                            )
                          : null
                      const vb =
                        props.visibility !== 'a'
                          ? sampleAtAxisTime(
                              props.logB,
                              name,
                              mark.time,
                              props.offsetB,
                            )
                          : null
                      const parts: string[] = []
                      if (props.visibility !== 'b') {
                        parts.push(`A ${formatSampleValue(va)}`)
                      }
                      if (props.visibility !== 'a') {
                        parts.push(`B ${formatSampleValue(vb)}`)
                      }
                      return (
                        <span key={name}>
                          {name}: {parts.join(' · ')}
                          {unit ? ` ${unit}` : ''}
                        </span>
                      )
                    })}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="marks-list">
          {marks.map((m, i) => {
            const color = MARK_COLORS[i % MARK_COLORS.length]
            const mark = m as ChartMark
            const params = resolveParams(props.log, props.selected)
            const time = props.log.timeLabels[mark.index] ?? '—'
            return (
              <li key={mark.id} className="marks-item">
                <div className="marks-item-top">
                  <strong style={{ color }}>{markLabel(i + 1)}</strong>
                  <span>{time}</span>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => onRemove(mark.id)}
                  >
                    {t('marks.remove')}
                  </button>
                </div>
                {params.length > 0 ? (
                  <div className="marks-values">
                    {params.map((p) => (
                      <span key={p.name}>
                        {p.name}: {formatSampleValue(p.values[mark.index])}
                        {p.unit ? ` ${p.unit}` : ''}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

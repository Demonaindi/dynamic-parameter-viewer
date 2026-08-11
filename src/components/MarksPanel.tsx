import type { ChartMark, ParsedLog } from '../lib/types'
import { MARK_COLORS } from '../lib/types'
import { formatSampleValue, markLabel, resolveParams } from '../lib/chartOption'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  log: ParsedLog
  selected: string[]
  marks: ChartMark[]
  onRemove: (id: string) => void
  onClear: () => void
}

export function MarksPanel({ log, selected, marks, onRemove, onClear }: Props) {
  const { t } = useI18n()
  const params = resolveParams(log, selected)

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
      ) : (
        <ul className="marks-list">
          {marks.map((m, i) => {
            const color = MARK_COLORS[i % MARK_COLORS.length]
            const time = log.timeLabels[m.index] ?? '—'
            return (
              <li key={m.id} className="marks-item">
                <div className="marks-item-top">
                  <strong style={{ color }}>{markLabel(i + 1)}</strong>
                  <span>{time}</span>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => onRemove(m.id)}
                  >
                    {t('marks.remove')}
                  </button>
                </div>
                {params.length > 0 ? (
                  <div className="marks-values">
                    {params.map((p) => (
                      <span key={p.name}>
                        {p.name}: {formatSampleValue(p.values[m.index])}
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

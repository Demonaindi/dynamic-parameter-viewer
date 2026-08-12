import { MARK_COLORS } from '../lib/types'
import { markLabel } from '../lib/chartOption'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  marks: Array<{ id: string }>
  onRemove: (id: string) => void
  onClear: () => void
}

export function MarksPanel({ marks, onRemove, onClear }: Props) {
  const { t } = useI18n()

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
            return (
              <li key={m.id} className="marks-item">
                <div className="marks-item-top">
                  <strong style={{ color }}>{markLabel(i + 1)}</strong>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => onRemove(m.id)}
                  >
                    {t('marks.remove')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

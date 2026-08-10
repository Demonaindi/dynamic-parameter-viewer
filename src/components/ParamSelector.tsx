import { useI18n } from '../i18n/I18nContext'
import type { ParsedLog } from '../lib/types'
import { CHART_COLORS } from '../lib/types'
import { metaLabel } from '../lib/parseLog'

type Props = {
  log: ParsedLog
  selected: string[]
  onChange: (names: string[]) => void
}

export function ParamSelector({ log, selected, onChange }: Props) {
  const { t } = useI18n()

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name))
    } else {
      onChange([...selected, name])
    }
  }

  const selectAll = () => onChange(log.parameters.map((p) => p.name))
  const clear = () => onChange([])
  const defaults = () =>
    onChange(log.parameters.slice(0, Math.min(4, log.parameters.length)).map((p) => p.name))

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('params.title')}</h2>
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={defaults}>
            {t('params.first4')}
          </button>
          <button type="button" className="btn ghost" onClick={selectAll}>
            {t('params.all')}
          </button>
          <button type="button" className="btn ghost" onClick={clear}>
            {t('params.none')}
          </button>
        </div>
      </div>
      <ul className="param-list">
        {log.parameters.map((p) => {
          const active = selected.includes(p.name)
          const color = CHART_COLORS[selected.indexOf(p.name) % CHART_COLORS.length]
          return (
            <li key={p.name}>
              <label className={`param-item ${active ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle(p.name)}
                />
                <span
                  className="swatch"
                  style={{ background: active ? color : '#cfd8dc' }}
                />
                <span className="param-name">
                  {p.name}
                  {p.unit ? <em> ({p.unit})</em> : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="meta-mini">
        {Object.entries(log.meta).map(([k, v]) => (
          <div key={k}>
            <span>{metaLabel(k, t)}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

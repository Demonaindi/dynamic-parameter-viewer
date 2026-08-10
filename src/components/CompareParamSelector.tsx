import { useI18n } from '../i18n/I18nContext'
import type { ParsedLog } from '../lib/types'
import { COMPARE_COLOR_A, COMPARE_COLOR_B } from '../lib/chartOption'

type Props = {
  names: string[]
  selected: string[]
  onChange: (names: string[]) => void
  logA: ParsedLog
  logB: ParsedLog
}

export function CompareParamSelector({
  names,
  selected,
  onChange,
  logA,
  logB,
}: Props) {
  const { t } = useI18n()
  const toggle = (name: string) => {
    if (selected.includes(name)) onChange(selected.filter((n) => n !== name))
    else onChange([...selected, name])
  }

  const unitOf = (name: string) =>
    logA.parameters.find((p) => p.name === name)?.unit ||
    logB.parameters.find((p) => p.name === name)?.unit ||
    ''

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('params.common')}</h2>
        <div className="btn-row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => onChange(names.slice(0, Math.min(4, names.length)))}
          >
            {t('params.first4')}
          </button>
          <button type="button" className="btn ghost" onClick={() => onChange([...names])}>
            {t('params.all')}
          </button>
          <button type="button" className="btn ghost" onClick={() => onChange([])}>
            {t('params.none')}
          </button>
        </div>
      </div>
      <ul className="param-list">
        {names.map((name) => {
          const active = selected.includes(name)
          const unit = unitOf(name)
          return (
            <li key={name}>
              <label className={`param-item ${active ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle(name)}
                />
                <span className="swatch-duo">
                  <i style={{ background: COMPARE_COLOR_A }} />
                  <i style={{ background: COMPARE_COLOR_B }} />
                </span>
                <span className="param-name">
                  {name}
                  {unit ? <em> ({unit})</em> : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {names.length === 0 ? (
        <div className="hint-inline">{t('params.noCommon')}</div>
      ) : null}
    </section>
  )
}

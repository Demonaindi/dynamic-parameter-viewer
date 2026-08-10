import { LANG_OPTIONS, type Lang } from '../i18n/translations'
import { useI18n } from '../i18n/I18nContext'

export function LangSwitcher() {
  const { lang, setLang } = useI18n()

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`lang-btn ${lang === opt.id ? 'active' : ''}`}
          onClick={() => setLang(opt.id as Lang)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

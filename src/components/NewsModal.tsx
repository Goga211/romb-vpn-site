import { IconClose, IconRss } from '../icons'

// Пока без ленты новостей — простое пустое состояние. Когда появится источник
// (канал/БД), заменить содержимое на список.
export default function NewsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--config" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="close">
          <IconClose size={22} />
        </button>
        <span className="modal__icon">
          <IconRss size={30} />
        </span>
        <div className="modal__title" style={{ fontSize: 22 }}>
          Новости
        </div>
        <div className="modal__sub">Последние обновления сервиса</div>

        <div className="pay-empty">Актуальных новостей пока нет</div>

        <button className="btn-text" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

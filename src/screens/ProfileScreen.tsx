import { profileList } from '../data'
import { haptic } from '../lib/telegram'
import {
  IconCard,
  IconChevronRight,
  IconDoc,
  IconQuestion,
  IconRss,
  IconSend,
  IconShield,
  IconShieldCheck,
  IconUser,
} from '../icons'

const itemIcon = {
  rss: IconRss,
  send: IconSend,
  shield: IconShield,
  doc: IconDoc,
  export: IconShield,
  question: IconQuestion,
  login: IconShield,
  card: IconCard,
}

export type ProfileModal = 'payments' | 'howToPay' | 'linkEmail'

type Props = {
  onOpenModal: (m: ProfileModal) => void
  linkedEmail: string | null
}

export default function ProfileScreen({ onOpenModal, linkedEmail }: Props) {
  const handle = (id: string) => {
    if (id === 'payments') onOpenModal('payments')
    else haptic('light')
  }

  const handleHowToPay = () => {
    haptic('light')
    onOpenModal('howToPay')
  }

  const handleLinkEmail = () => {
    haptic('light')
    onOpenModal('linkEmail')
  }

  return (
    <div className="profile">
      <div className="profile-head">
        <span className="profile-head__avatar">
          <IconUser size={30} />
        </span>
        <div className="profile-head__txt">
          <div className="profile-head__name">Профиль</div>
          <div className="profile-head__sub">Управление аккаунтом и бонусами</div>
        </div>
      </div>

      {/* Продление подписки: открывает инструкцию по оплате (реквизиты МБАНК).
          Автоматической оплаты пока нет — перевод вручную + скриншот в поддержку. */}
      <button type="button" className="btn btn-primary profile-renew" onClick={handleHowToPay}>
        <IconCard size={20} />
        Как оплатить
      </button>

      {/* Привязка почты для входа на сайте (десктоп). Подписка остаётся общей. */}
      {linkedEmail ? (
        <div className="profile-linked">
          <IconShieldCheck size={20} />
          <span className="profile-linked__txt">
            Вход на сайте: <b>{linkedEmail}</b>
          </span>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={handleLinkEmail}>
          <IconShield size={20} />
          Привязать почту для входа на сайте
        </button>
      )}

      <div className="group__card">
        {profileList.map((item) => {
          const Icon = itemIcon[item.icon]
          return (
            <button key={item.id} className="group-row" onClick={() => handle(item.id)}>
              <span className="group-row__ic">
                <Icon size={22} />
              </span>
              <span className="group-row__title">{item.title}</span>
              <span className="group-row__chev">
                <IconChevronRight size={20} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

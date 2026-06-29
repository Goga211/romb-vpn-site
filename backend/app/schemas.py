"""Response models the frontend consumes (decoupled from Remnawave's raw shape)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Subscription(BaseModel):
    id: str  # shortUuid — stable public id used by the frontend
    uuid: str  # full uuid — used for actions (renew/config)
    label: str  # "Основная" / "Подписка #100564"
    name: str  # tariff: "Pro" / "Whitelist"
    status: str  # ACTIVE | DISABLED | LIMITED | EXPIRED
    pro: bool

    used_traffic_bytes: int
    traffic_limit_bytes: int  # 0 = unlimited
    traffic_text: str | None  # "0/5 GB" or None when unlimited

    expire_at: str  # ISO
    expire_text: str  # "14.06.2026"
    expired: bool

    devices_used: int
    device_limit: int  # 0 = unlimited
    devices_text: str  # "0/∞ устройств"

    subscription_url: str


class ServerNode(BaseModel):
    name: str  # город/метка ноды ("Амстердам")
    country: str  # название страны ("Нидерланды")
    country_code: str  # ISO-код ("NL")
    online: bool
    users_online: int
    load: int  # загрузка ноды, 0..100


class ServerListResponse(BaseModel):
    servers: list[ServerNode]


class TrafficPoint(BaseModel):
    date: str  # YYYY-MM-DD
    bytes: int


class TrafficSeriesResponse(BaseModel):
    points: list[TrafficPoint]
    total_bytes: int


class MeResponse(BaseModel):
    telegram_id: int
    subscriptions: list[Subscription]
    is_admin: bool = False
    trial_days: int  # срок пробного периода (для текстов на фронте)
    # E-mail, привязанный к этому Telegram-аккаунту для входа на сайт (если есть).
    linked_email: str | None = None
    # Привязан ли Telegram к этому аккаунту (для e-mail-входа на десктопе).
    telegram_linked: bool = False


class Payment(BaseModel):
    id: str
    date: str  # "26.06.2026"
    amount: str  # "1500 ₽"
    title: str  # "Продление подписки · 6 мес."
    status: str  # ok | pending | failed


class PaymentListResponse(BaseModel):
    payments: list[Payment]


class PaymentRecordRequest(BaseModel):
    telegram_id: int
    months: int


class PaymentRecordResponse(BaseModel):
    ok: bool


class PromoRedeemRequest(BaseModel):
    code: str


class PromoRedeemResponse(BaseModel):
    ok: bool
    bonus_days: int


class PromoCreateRequest(BaseModel):
    code: str
    days: int | None = None  # None → promo_bonus_days из настроек
    max_uses: int = 0


class PromoCreateResponse(BaseModel):
    ok: bool
    code: str
    bonus_days: int


class ReferralInfoResponse(BaseModel):
    link: str
    invited: int
    rewarded: int
    bonus_days: int
    goal: int
    goal_bonus_days: int


class ReferralRegisterRequest(BaseModel):
    invitee_telegram_id: int
    referrer_telegram_id: int


class ReferralRegisterResponse(BaseModel):
    ok: bool


class ConfigResponse(BaseModel):
    subscription_url: str


class Device(BaseModel):
    hwid: str
    platform: str = ""
    device_model: str = ""
    created_at: str | None = None  # ISO


class DeviceListResponse(BaseModel):
    devices: list[Device]


class DeviceDeleteRequest(BaseModel):
    hwid: str = Field(min_length=1)


class SupportResponse(BaseModel):
    ok: bool
    ticket_id: int


class TicketMessage(BaseModel):
    id: int
    author: str  # user | admin
    text: str
    created_at: str
    # URL защищённого эндпоинта с картинкой-вложением, либо None
    attachment_url: str | None = None


class Ticket(BaseModel):
    id: int
    status: str  # open | answered | closed
    created_at: str
    updated_at: str
    last_message: str | None = None
    last_author: str | None = None
    # заполняется только в админских ответах — кто автор обращения
    user_telegram_id: int | None = None
    username: str | None = None
    first_name: str | None = None


class TicketDetail(Ticket):
    messages: list[TicketMessage] = Field(default_factory=list)


class TicketListResponse(BaseModel):
    tickets: list[Ticket]

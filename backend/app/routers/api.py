import logging
import secrets
from datetime import datetime, timedelta, timezone

import aiosqlite
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..config import Settings, get_settings
from ..db import get_db
from ..remnawave import RemnawaveError, get_client
from ..schemas import (
    ConfigResponse,
    DeviceDeleteRequest,
    DeviceListResponse,
    MeResponse,
    PaymentListResponse,
    PaymentRecordRequest,
    PaymentRecordResponse,
    PromoCreateRequest,
    PromoCreateResponse,
    PromoRedeemRequest,
    PromoRedeemResponse,
    ReferralInfoResponse,
    ReferralRegisterRequest,
    ReferralRegisterResponse,
    ServerListResponse,
    Subscription,
    SupportResponse,
    Ticket,
    TicketDetail,
    TicketListResponse,
    TrafficPoint,
    TrafficSeriesResponse,
)
from ..security import is_admin
from ..auth import Principal, require_principal
from .. import (
    account_store,
    attachments,
    payment_store,
    promo_store,
    referral_store,
    service,
    support_store,
    telegram,
)

logger = logging.getLogger("romb.api")

# Лимит длины текста обращения (совпадает с maxLength на фронте).
MESSAGE_MAX = 2000

router = APIRouter(prefix="/api", tags=["subscriptions"])


def _client():
    return get_client()


async def _find_user(client, telegram_id: int, uuid: str) -> dict:
    users = await client.get_users_by_telegram_id(telegram_id)
    for u in users:
        if u.get("uuid") == uuid or u.get("shortUuid") == uuid:
            return u
    raise HTTPException(status_code=404, detail="subscription not found")


@router.get("/me", response_model=MeResponse)
async def get_me(
    user: Principal = Depends(require_principal),
    client=Depends(_client),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
):
    try:
        raws = await client.get_users_by_telegram_id(user.telegram_id)
        # подмешиваем число подключённых устройств (HWID) в каждую подписку
        for r in raws:
            try:
                r["_devices_used"] = await client.get_hwid_count(r.get("uuid"))
            except RemnawaveError:
                r["_devices_used"] = 0
    except RemnawaveError as exc:
        raise HTTPException(status_code=502, detail=f"panel error: {exc}") from exc

    # Telegram-вход: показываем привязанный e-mail (если задан для входа на сайт).
    # E-mail-вход: адрес известен из сессии, а telegram_linked — по полю аккаунта.
    if user.kind == "email":
        linked_email = user.email
        account = (
            await account_store.get_by_id(conn, user.account_id)
            if user.account_id is not None
            else None
        )
        telegram_linked = bool(account and account["telegram_id"])
    else:
        account = await account_store.get_by_telegram_id(conn, user.telegram_id)
        linked_email = account["email"] if account else None
        telegram_linked = True  # это и есть Telegram-вход

    return MeResponse(
        telegram_id=user.telegram_id,
        subscriptions=service.map_all(raws),
        is_admin=is_admin(user.telegram_id),
        trial_days=settings.trial_days,
        linked_email=linked_email,
        telegram_linked=telegram_linked,
    )


@router.post("/trial", response_model=Subscription)
async def activate_trial(
    user: Principal = Depends(require_principal),
    client=Depends(_client),
    settings: Settings = Depends(get_settings),
):
    try:
        existing = await client.get_users_by_telegram_id(user.telegram_id)
        if existing:
            # already has a subscription — return the first instead of duplicating
            return service.map_subscription(existing[0], 0)
        payload = service.build_trial_payload(settings, user.telegram_id, user.username)
        created = await client.create_user(payload)
    except RemnawaveError as exc:
        raise HTTPException(status_code=502, detail=f"panel error: {exc}") from exc
    return service.map_subscription(created, 0)


# NB: продление подписки — платная операция, выполняется вручную оператором (перевод +
# скриншот в поддержку → бот `vpn_payment_bot` продлевает через панель). Публичной ручки
# самопродления здесь намеренно нет: иначе любой авторизованный пользователь продлевал бы
# подписку бесплатно. Логика расчёта срока живёт в service.build_renew_*_payload.


@router.get("/servers", response_model=ServerListResponse)
async def list_servers(
    user: Principal = Depends(require_principal),
    client=Depends(_client),
):
    """Серверы из подписки пользователя для блока «Серверы» в кабинете.

    Показываем только ноды, обслуживающие его подписку: activeInternalSquads
    пользователя → inbound-uuid'ы этих сквадов → ноды с такими inbound'ами.
    Не критично к ошибкам панели: при недоступности возвращаем пусто — фронт
    покажет аккуратное «нет данных», а не падение кабинета.
    """
    try:
        users = await client.get_users_by_telegram_id(user.telegram_id)
        squads = await client.get_internal_squads()
        nodes = await client.get_nodes()
    except RemnawaveError:
        return ServerListResponse(servers=[])

    squad_index = service.squad_inbound_index(squads)
    user_inbounds = service.user_inbound_uuids(users, squad_index)
    visible = service.filter_nodes_for_user(nodes, user_inbounds)
    return ServerListResponse(servers=service.map_nodes(visible))


@router.get("/usage", response_model=TrafficSeriesResponse)
async def usage_series(
    days: int = 14,
    user: Principal = Depends(require_principal),
    client=Depends(_client),
):
    """Суточный трафик пользователя за последние `days` дней (для графика).

    Суммируем ряды по всем подпискам пользователя. Любые ошибки панели → пустой
    ряд (блок графика покажет состояние «нет данных»).
    """
    days = max(1, min(60, days))
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)

    try:
        users = await client.get_users_by_telegram_id(user.telegram_id)
    except RemnawaveError:
        users = []

    by_date: dict[str, int] = {}
    for u in users:
        uid = u.get("uuid")
        if not uid:
            continue
        try:
            series = await client.get_user_traffic_series(uid, start.isoformat(), end.isoformat())
        except RemnawaveError:
            series = []
        for point in service.map_traffic_series(series):
            if point.date:
                by_date[point.date] = by_date.get(point.date, 0) + point.bytes

    points = [TrafficPoint(date=d, bytes=b) for d, b in sorted(by_date.items())]
    return TrafficSeriesResponse(points=points, total_bytes=sum(p.bytes for p in points))


@router.get("/payments", response_model=PaymentListResponse)
async def list_payments(
    user: Principal = Depends(require_principal),
    conn: aiosqlite.Connection = Depends(get_db),
):
    """История платежей текущего пользователя (ручные продления оператором)."""
    rows = await payment_store.list_by_telegram_id(conn, user.telegram_id)
    return PaymentListResponse(payments=[service.map_payment(r) for r in rows])


def _check_internal_secret(settings: Settings, x_internal_secret: str | None) -> None:
    """Проверяет внутренний секрет (= bot_token) — общий для эндпоинтов, которые
    дёргает только бот. Наружу не торчат (как /api/auth/link-telegram/confirm)."""
    if (
        not settings.bot_token
        or not x_internal_secret
        or not secrets.compare_digest(x_internal_secret, settings.bot_token)
    ):
        raise HTTPException(status_code=403, detail="forbidden")


@router.post("/payments/record", response_model=PaymentRecordResponse)
async def record_payment(
    body: PaymentRecordRequest,
    client=Depends(_client),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
    x_internal_secret: str | None = Header(default=None),
):
    """Внутренний endpoint для бота: фиксирует платёж за ручное продление.

    Бот не пишет в БД напрямую — единственный писатель API. Цена берётся из настроек
    (RENEW_PRICE/CURRENCY). Здесь же начисляем реферальный бонус пригласившему —
    при ПЕРВОЙ оплате приглашённого (claim_reward одноразовый).
    """
    _check_internal_secret(settings, x_internal_secret)

    await payment_store.record(
        conn,
        telegram_id=body.telegram_id,
        amount=settings.renew_price,
        currency=settings.renew_currency,
        period_months=body.months,
    )

    # Реферальный бонус пригласившему — один раз, при первой оплате приглашённого.
    referrer = await referral_store.claim_reward(conn, body.telegram_id)
    if referrer is not None:
        try:
            await service.extend_subscription_days(
                client, referrer, settings.referral_bonus_days
            )
        except RemnawaveError as exc:
            # Бонус помечен начисленным, но панель не ответила — лог, без падения ручки.
            logger.warning("referral bonus apply failed referrer=%s: %s", referrer, exc)

        # Веха «N оплативших друзей» — одноразовый бонус сверх обычного.
        if await referral_store.claim_milestone(conn, referrer, settings.referral_goal):
            try:
                await service.extend_subscription_days(
                    client, referrer, settings.referral_goal_bonus_days
                )
            except RemnawaveError as exc:
                logger.warning(
                    "referral milestone bonus apply failed referrer=%s: %s", referrer, exc
                )

    return PaymentRecordResponse(ok=True)


@router.post("/promo/redeem", response_model=PromoRedeemResponse)
async def redeem_promo(
    body: PromoRedeemRequest,
    user: Principal = Depends(require_principal),
    client=Depends(_client),
    conn: aiosqlite.Connection = Depends(get_db),
):
    """Активация промокода: проверяет код и продлевает подписку на bonus_days дней."""
    try:
        users = await client.get_users_by_telegram_id(user.telegram_id)
    except RemnawaveError as exc:
        raise HTTPException(status_code=502, detail=f"panel error: {exc}") from exc
    if not users:
        raise HTTPException(status_code=400, detail="нет активной подписки для бонуса")

    bonus_days = await promo_store.redeem(conn, body.code, user.telegram_id)
    if bonus_days is None:
        raise HTTPException(status_code=400, detail="код недействителен или уже использован")

    try:
        await service.extend_subscription_days(client, user.telegram_id, bonus_days)
    except RemnawaveError as exc:
        raise HTTPException(status_code=502, detail=f"panel error: {exc}") from exc
    return PromoRedeemResponse(ok=True, bonus_days=bonus_days)


@router.post("/promo/create", response_model=PromoCreateResponse)
async def create_promo(
    body: PromoCreateRequest,
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
    x_internal_secret: str | None = Header(default=None),
):
    """Внутренний endpoint для бота: админ создаёт промокод (по умолчанию на
    PROMO_BONUS_DAYS дней)."""
    _check_internal_secret(settings, x_internal_secret)
    days = body.days if body.days and body.days > 0 else settings.promo_bonus_days
    created = await promo_store.create(conn, body.code, days, max_uses=body.max_uses)
    if not created:
        raise HTTPException(status_code=409, detail="такой код уже существует")
    return PromoCreateResponse(ok=True, code=promo_store.normalize(body.code), bonus_days=days)


@router.get("/referral", response_model=ReferralInfoResponse)
async def referral_info(
    user: Principal = Depends(require_principal),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
):
    """Реф-ссылка текущего пользователя и статистика приглашённых."""
    link = f"https://t.me/{settings.bot_username}?start=ref_{user.telegram_id}"
    return ReferralInfoResponse(
        link=link,
        invited=await referral_store.count_invited(conn, user.telegram_id),
        rewarded=await referral_store.count_rewarded(conn, user.telegram_id),
        bonus_days=settings.referral_bonus_days,
        goal=settings.referral_goal,
        goal_bonus_days=settings.referral_goal_bonus_days,
    )


@router.post("/referral/register", response_model=ReferralRegisterResponse)
async def register_referral(
    body: ReferralRegisterRequest,
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
    x_internal_secret: str | None = Header(default=None),
):
    """Внутренний endpoint для бота: привязывает приглашённого к пригласившему
    (при /start ref_<id>). Самореферал и повторная привязка игнорируются."""
    _check_internal_secret(settings, x_internal_secret)
    ok = await referral_store.register(
        conn, body.invitee_telegram_id, body.referrer_telegram_id
    )
    return ReferralRegisterResponse(ok=ok)


@router.get("/subscriptions/{uuid}/config", response_model=ConfigResponse)
async def get_config(
    uuid: str,
    user: Principal = Depends(require_principal),
    client=Depends(_client),
):
    try:
        raw = await _find_user(client, user.telegram_id, uuid)
    except RemnawaveError as exc:
        raise HTTPException(status_code=502, detail=f"panel error: {exc}") from exc
    url = str(raw.get("subscriptionUrl") or "")
    return ConfigResponse(subscription_url=url)


@router.get("/subscriptions/{uuid}/devices", response_model=DeviceListResponse)
async def list_devices(
    uuid: str,
    user: Principal = Depends(require_principal),
    client=Depends(_client),
):
    try:
        raw = await _find_user(client, user.telegram_id, uuid)
        devices = await client.get_devices(raw["uuid"])
    except RemnawaveError as exc:
        raise HTTPException(status_code=502, detail=f"panel error: {exc}") from exc
    return DeviceListResponse(devices=service.map_devices(devices))


@router.post("/subscriptions/{uuid}/devices/delete", response_model=DeviceListResponse)
async def delete_device(
    uuid: str,
    payload: DeviceDeleteRequest,
    user: Principal = Depends(require_principal),
    client=Depends(_client),
):
    """Удаляет одно устройство (HWID) и возвращает обновлённый список.

    Владелец подписки проверяется через _find_user (uuid привязан к telegram_id),
    поэтому удалить можно только своё устройство.
    """
    try:
        raw = await _find_user(client, user.telegram_id, uuid)
        await client.delete_device(raw["uuid"], payload.hwid)
        devices = await client.get_devices(raw["uuid"])
    except RemnawaveError as exc:
        raise HTTPException(status_code=502, detail=f"panel error: {exc}") from exc
    return DeviceListResponse(devices=service.map_devices(devices))


@router.post("/support", response_model=SupportResponse)
async def send_support(
    message: str = Form(default=""),
    ticket_id: int | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    user: Principal = Depends(require_principal),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
):
    """Создаёт новое обращение или дописывает в существующий тикет пользователя.

    Принимает multipart-форму: текст и/или картинку-вложение. Обращение
    сохраняется в БД (источник истины для раздела «Заявки»), а в чат поддержки
    уходит короткий алерт (фото — через sendPhoto) — без падения запроса, если
    чат недоступен/не настроен (тикет уже сохранён, виден в мини-аппе).
    """
    text = message.strip()
    if len(text) > MESSAGE_MAX:
        raise HTTPException(status_code=422, detail="message too long")

    attach_name = attach_mime = None
    if file is not None and file.filename:
        try:
            attach_name, attach_mime = await attachments.save_upload(
                file, db_path=settings.db_path
            )
        except attachments.AttachmentError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not text and attach_name is None:
        raise HTTPException(status_code=422, detail="empty message")

    if ticket_id is None:
        ticket_id = await support_store.create_ticket(
            conn,
            user_telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            message=text,
            attachment_path=attach_name,
            attachment_mime=attach_mime,
        )
    else:
        ticket = await support_store.get_ticket(conn, ticket_id)
        if ticket is None or ticket["user_telegram_id"] != user.telegram_id:
            raise HTTPException(status_code=404, detail="ticket not found")
        await support_store.add_user_message(
            conn, ticket_id, text,
            attachment_path=attach_name,
            attachment_mime=attach_mime,
        )

    if settings.support_chat_id and settings.bot_token:
        alert = telegram.build_alert_text(
            ticket_id=ticket_id,
            username=user.username,
            first_name=user.first_name,
            message=text or "(скриншот)",
            telegram_id=user.telegram_id,
        )
        try:
            if attach_name:
                path = attachments.resolve(attach_name, db_path=settings.db_path)
                await telegram.send_photo(
                    settings.bot_token, settings.support_chat_id, str(path), alert
                )
            else:
                await telegram.send_message(settings.bot_token, settings.support_chat_id, alert)
        except telegram.TelegramSendError as exc:
            logger.warning("support alert delivery failed for ticket %s: %s", ticket_id, exc)

    return SupportResponse(ok=True, ticket_id=ticket_id)


@router.get("/support/attachments/{message_id}")
async def get_attachment(
    message_id: int,
    user: Principal = Depends(require_principal),
    settings: Settings = Depends(get_settings),
    conn: aiosqlite.Connection = Depends(get_db),
):
    """Отдаёт картинку-вложение. Доступ: владелец тикета или админ.

    Картинку фронт догружает отдельным запросом с initData в заголовке (тег
    <img> заголовки слать не умеет), поэтому это обычный защищённый GET.
    """
    msg = await support_store.get_message(conn, message_id)
    if msg is None or not msg.get("attachment_path"):
        raise HTTPException(status_code=404, detail="attachment not found")

    ticket = await support_store.get_ticket(conn, msg["ticket_id"])
    if ticket is None:
        raise HTTPException(status_code=404, detail="attachment not found")
    if not is_admin(user.telegram_id) and ticket["user_telegram_id"] != user.telegram_id:
        raise HTTPException(status_code=404, detail="attachment not found")

    path = attachments.resolve(msg["attachment_path"], db_path=settings.db_path)
    if path is None:
        raise HTTPException(status_code=404, detail="attachment not found")

    return FileResponse(
        path,
        media_type=msg.get("attachment_mime") or "application/octet-stream",
        content_disposition_type="inline",
    )


@router.get("/support/tickets", response_model=TicketListResponse)
async def my_tickets(
    user: Principal = Depends(require_principal),
    conn: aiosqlite.Connection = Depends(get_db),
):
    rows = await support_store.list_by_user(conn, user.telegram_id)
    return TicketListResponse(tickets=[Ticket.model_validate(r) for r in rows])


@router.get("/support/tickets/{ticket_id}", response_model=TicketDetail)
async def my_ticket(
    ticket_id: int,
    user: Principal = Depends(require_principal),
    conn: aiosqlite.Connection = Depends(get_db),
):
    ticket = await support_store.get_with_messages(conn, ticket_id)
    if ticket is None or ticket["user_telegram_id"] != user.telegram_id:
        raise HTTPException(status_code=404, detail="ticket not found")
    return TicketDetail.model_validate(ticket)

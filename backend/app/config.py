import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("romb.config")

# Дефолт session_secret — заведомо небезопасный плейсхолдер. В проде обязан быть
# переопределён; validate_runtime_config() это проверяет и не даёт стартовать.
DEFAULT_SESSION_SECRET = "dev-insecure-change-me-please-set-a-real-32b-secret"
MIN_SESSION_SECRET_LEN = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Окружение: "prod" включает обязательные проверки безопасности на старте.
    environment: str = "dev"

    # Telegram
    bot_token: str = ""
    bot_username: str = "akenaivpn_bot"
    webapp_url: str = "https://example.com"
    support_url: str = "https://t.me/akenaivpn_support"
    channel_url: str = "https://t.me/AkenaiVPN"
    # Чат/группа, куда бот доставляет обращения из мини-аппа (id, напр. -1001234567890)
    support_chat_id: str = ""
    # Telegram id админов через запятую — им доступен раздел «Заявки» в мини-аппе
    admin_ids: str = ""

    # Хранилище обращений (SQLite). В Docker монтируется в volume: DB_PATH=/data/support.db
    db_path: str = "support.db"

    # Remnawave
    remnawave_mock: bool = True
    remnawave_base_url: str = "https://panel.example.com"
    remnawave_token: str = ""
    # Альтернатива токену: вход по логину/паролю админки (панель выдаёт JWT)
    remnawave_username: str = ""
    remnawave_password: str = ""
    remnawave_squad_uuid: str = ""
    subscription_domain: str = ""
    # Фиксированная ссылка подписки для mock-режима (реальный тестовый юзер)
    mock_subscription_url: str = ""

    # Tariff defaults
    trial_days: int = 7
    trial_traffic_gb: int = 100
    trial_device_limit: int = 3
    # Срок ручного продления оператором (forward→кнопка в боте), месяцев
    renew_months: int = 6

    # Напоминание об окончании подписки: за сколько дней предупреждать и как
    # часто бот проверяет панель (фоновый цикл рядом с polling).
    notify_before_days: int = 3
    notify_check_interval_hours: int = 6

    # Desktop e-mail auth (сессия в HttpOnly-cookie, подписанной JWT)
    session_secret: str = DEFAULT_SESSION_SECRET
    session_cookie_name: str = "romb_session"
    session_ttl_days: int = 30
    cookie_secure: bool = False  # True в проде (HTTPS); в dev по http — False
    # Rate-limit на /api/auth/* (скользящее окно по IP): max запросов за window секунд.
    auth_rate_limit_max: int = 20
    auth_rate_limit_window_seconds: int = 300

    # Misc
    cors_origins: str = "http://localhost:5173,http://localhost:5180"
    dev_telegram_id: str = ""
    # Внутренний адрес API для бота (подтверждение привязки Telegram). Бот и API
    # на одном хосте; секрет внутреннего endpoint — bot_token (наружу не торчит).
    internal_api_url: str = "http://127.0.0.1:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_id_list(self) -> list[int]:
        ids: list[int] = []
        for part in self.admin_ids.split(","):
            part = part.strip()
            if part:
                try:
                    ids.append(int(part))
                except ValueError:
                    continue
        return ids

    @property
    def api_base(self) -> str:
        return self.remnawave_base_url.rstrip("/") + "/api"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_runtime_config(settings: Settings) -> None:
    """Проверка безопасности конфигурации на старте приложения.

    В проде (ENVIRONMENT=prod) небезопасный конфиг — фатальная ошибка: лучше не
    подняться, чем работать с подделываемыми сессиями или cookie по http. В dev —
    только предупреждение про дефолтный секрет.
    """
    is_default_secret = settings.session_secret == DEFAULT_SESSION_SECRET
    is_weak_secret = len(settings.session_secret) < MIN_SESSION_SECRET_LEN

    if settings.environment == "prod":
        problems: list[str] = []
        if is_default_secret or is_weak_secret:
            problems.append(
                f"SESSION_SECRET must be a strong unique value (>= {MIN_SESSION_SECRET_LEN} chars)"
            )
        if not settings.cookie_secure:
            problems.append("COOKIE_SECURE must be true in production (HTTPS-only cookies)")
        if "*" in settings.cors_origin_list:
            problems.append("CORS_ORIGINS must not contain '*' with credentialed cookies")
        if settings.remnawave_mock:
            problems.append(
                "REMNAWAVE_MOCK must be false in production "
                "(in-memory mock loses all subscriptions on restart)"
            )
        if problems:
            raise RuntimeError("Insecure production config: " + "; ".join(problems))
    elif is_default_secret:
        logger.warning(
            "Using default SESSION_SECRET — OK for local dev, NEVER for production."
        )

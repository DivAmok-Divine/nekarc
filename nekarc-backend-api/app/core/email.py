import smtplib
from email.message import EmailMessage

from app.config import settings


def send_email(to: str, subject: str, body: str) -> None:
    """Send an email, or print to the console when SMTP is not configured (dev)."""
    if not settings.SMTP_HOST:
        print("\n" + "=" * 64)
        print(f"[DEV EMAIL]  To: {to}")
        print(f"[DEV EMAIL]  Subject: {subject}")
        print(f"[DEV EMAIL]  {body}")
        print("=" * 64 + "\n", flush=True)
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
        server.send_message(msg)


def send_password_reset(to: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    body = (
        "You requested a password reset for your nekarc account.\n\n"
        f"Reset your password: {link}\n\n"
        "This link expires soon. If you did not request this, ignore this email."
    )
    send_email(to, "Reset your nekarc password", body)

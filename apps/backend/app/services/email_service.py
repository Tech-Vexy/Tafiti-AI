"""
Async email service using aiosmtplib + Jinja2 templates.
Used for Ghost Profile invite emails.
"""

import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("email")


_INVITE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }}
    .container {{ max-width: 560px; margin: 40px auto; background: #1e293b; border-radius: 12px; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 24px; color: white; }}
    .body {{ padding: 32px; }}
    .body p {{ line-height: 1.6; color: #94a3b8; }}
    .body strong {{ color: #e2e8f0; }}
    .btn {{ display: inline-block; margin-top: 24px; padding: 14px 28px;
            background: #6366f1; color: white; text-decoration: none;
            border-radius: 8px; font-weight: 600; }}
    .footer {{ padding: 16px 32px; font-size: 12px; color: #475569; border-top: 1px solid #334155; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tafiti AI — Research at the Speed of Thought</h1>
    </div>
    <div class="body">
      <p>Hello <strong>{display_name}</strong>,</p>
      <p>
        A researcher on Tafiti AI found you as a co-author on a published paper.
        A profile has been created for you — claim it to connect with your collaborators,
        track your publications, and access the AI research tools used across Africa.
      </p>
      <p>Your co-publication: <strong>{paper_doi}</strong></p>
      <a href="{claim_url}" class="btn">Claim Your Profile</a>
      <p style="margin-top:24px; font-size:13px; color:#64748b;">
        This link expires in 7 days. If you did not expect this email, you can safely ignore it.
      </p>
    </div>
    <div class="footer">
      &copy; 2025 Tafiti AI &bull; Nairobi, Kenya &bull;
      <a href="https://tafitiai.co.ke" style="color:#6366f1;">tafitiai.co.ke</a>
    </div>
  </div>
</body>
</html>
"""


async def send_ghost_invite(
    recipient_email: str,
    display_name: str,
    invite_token: str,
    paper_doi: Optional[str] = None,
) -> bool:
    """
    Send a Ghost Profile claim invitation email.
    Returns True on success, False on failure (never raises).
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — ghost invite email skipped")
        return False

    claim_url = f"{settings.FRONTEND_URL}/claim-profile?token={invite_token}"
    doi_display = paper_doi or "a recent publication"

    html_body = _INVITE_TEMPLATE.format(
        display_name=display_name,
        paper_doi=doi_display,
        claim_url=claim_url,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Claim your Tafiti AI researcher profile, {display_name.split()[0]}"
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = recipient_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Ghost invite email sent to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send ghost invite to {recipient_email}: {e}")
        return False

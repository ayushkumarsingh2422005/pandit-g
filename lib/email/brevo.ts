type SendTransactionalEmailInput = {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
};

export function isBrevoConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY?.trim() &&
      process.env.BREVO_SENDER_EMAIL?.trim(),
  );
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName =
    process.env.BREVO_SENDER_NAME?.trim() || "Pandit G Admin";

  if (!apiKey || !senderEmail) {
    return {
      ok: false,
      error: "Brevo is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL)",
    };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: input.toEmail,
          name: input.toName || input.toEmail,
        },
      ],
      subject: input.subject,
      htmlContent: input.htmlContent,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Brevo error ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  return { ok: true };
}

export function buildPasswordResetEmailHtml(params: {
  name: string;
  resetUrl: string;
}): string {
  const safeName = escapeHtml(params.name || "Admin");
  const safeUrl = escapeHtml(params.resetUrl);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>Namaste ${safeName},</p>
  <p>We received a request to reset your Pandit G admin password.</p>
  <p>
    <a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#00a884;color:#fff;text-decoration:none;border-radius:6px;">
      Reset password
    </a>
  </p>
  <p>Or open this link:</p>
  <p><a href="${safeUrl}">${safeUrl}</a></p>
  <p>This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
  <p>— Pandit G</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

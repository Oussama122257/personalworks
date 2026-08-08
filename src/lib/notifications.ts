/**
 * Outbound notifications (email / SMS).
 *
 * No provider credentials ship with this repo, so the default transport writes
 * a structured line to the server log and reports success. Wire a real provider
 * by setting the env vars below and replacing the fetch bodies — every caller
 * already awaits this module, so nothing else has to change.
 *
 *   EMAIL_API_URL / EMAIL_API_KEY / EMAIL_FROM   (e.g. Resend, Sendgrid)
 *   SMS_API_URL   / SMS_API_KEY   / SMS_SENDER   (e.g. Twilio, a local DZ gateway)
 *
 * Notifications must never break the business flow: all failures are caught and
 * logged, never rethrown.
 */

export type NotificationChannel = "email" | "sms";

interface NotificationResult {
  channel: NotificationChannel;
  delivered: boolean;
  transport: "log" | "provider";
}

async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<NotificationResult> {
  const url = process.env.EMAIL_API_URL;
  const key = process.env.EMAIL_API_KEY;
  if (!url || !key) {
    console.info(`[notify:email→${to}] ${subject} :: ${body}`);
    return { channel: "email", delivered: false, transport: "log" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "no-reply@zeem.dz",
      to,
      subject,
      text: body,
    }),
  });
  if (!res.ok) throw new Error(`email provider ${res.status}`);
  return { channel: "email", delivered: true, transport: "provider" };
}

async function sendSms(to: string, body: string): Promise<NotificationResult> {
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_API_KEY;
  if (!url || !key) {
    console.info(`[notify:sms→${to}] ${body}`);
    return { channel: "sms", delivered: false, transport: "log" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      sender: process.env.SMS_SENDER ?? "ZEEM",
      to,
      message: body,
    }),
  });
  if (!res.ok) throw new Error(`sms provider ${res.status}`);
  return { channel: "sms", delivered: true, transport: "provider" };
}

export async function notify(params: {
  email?: string | null;
  phone?: string | null;
  subject: string;
  body: string;
  /** SMS is only worth sending for time-critical events. */
  smsToo?: boolean;
}): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];
  try {
    if (params.email) {
      results.push(await sendEmail(params.email, params.subject, params.body));
    }
    if (params.smsToo && params.phone) {
      results.push(await sendSms(params.phone, params.body));
    }
  } catch (err) {
    console.error("[notify] delivery failed", err);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Message templates (French — the seller/buyer facing language)
// ---------------------------------------------------------------------------

export const templates = {
  storeApproved: (storeName: string) => ({
    subject: "Félicitations, votre boutique est ouverte !",
    body: `Félicitations, votre boutique « ${storeName} » est ouverte ! Vous pouvez dès maintenant publier vos produits et recevoir des commandes sur Zeem Marketplace.`,
  }),
  storeRejected: (storeName: string, reason: string) => ({
    subject: "Votre demande de boutique n'a pas été retenue",
    body: `Votre demande pour la boutique « ${storeName} » a été refusée.\n\nMotif : ${reason}\n\nVous pouvez corriger les points signalés et soumettre une nouvelle demande.`,
  }),
  parcelReturned: (reference: string) => ({
    subject: `Colis retourné — commande ${reference}`,
    body: `Après 3 tentatives de livraison infructueuses, le colis de la commande ${reference} est en cours de retour vers votre boutique.`,
  }),
  ticketReply: (reference: string, message: string) => ({
    subject: `Réponse à votre demande ${reference}`,
    body: `Notre équipe support vous a répondu :\n\n${message}\n\nRépondez à cet email pour poursuivre la conversation.`,
  }),
  ticketEscalated: (reference: string, hours: number) => ({
    subject: `[Escalade] Ticket ${reference} sans réponse depuis ${hours}h`,
    body: `Le ticket ${reference} est ouvert depuis plus de ${hours} heures sans résolution. Une intervention est requise.`,
  }),
};

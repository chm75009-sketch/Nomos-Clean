// ────────────────────────────────────────────────────────────────────────────
// Nomos — Edge Function « envoyer-email »
// Envoi des e-mails de service via le SMTP OVH (serveurs en Union européenne),
// en remplacement d'EmailJS (USA) pour la conformité RGPD.
//
// SÉCURITÉ :
//   • Le mot de passe SMTP OVH n'est JAMAIS dans le code client.
//     Il est lu depuis les secrets Supabase (Deno.env) : SMTP_PASS.
//   • Les e-mails « admin » sont toujours envoyés à l'adresse fixe ADMIN_EMAIL
//     (le client ne peut pas détourner le destinataire).
//   • Filtrage par Origin : seules les pages nomos-haccp.fr peuvent appeler.
//
// SECRETS À DÉFINIR (Supabase → Edge Functions → envoyer-email → Secrets) :
//   SMTP_HOST       = ssl0.ovh.net
//   SMTP_PORT       = 465
//   SMTP_USER       = <l'adresse OVH complète, ex. contact@nomos-haccp.fr>
//   SMTP_PASS       = <mot de passe de la boîte OVH>
//   SMTP_FROM       = <l'adresse expéditrice affichée, ex. contact@nomos-haccp.fr>
//   SMTP_FROM_NAME  = Nomos HACCP
//   ADMIN_EMAIL     = lea@nomos-haccp.fr
// ────────────────────────────────────────────────────────────────────────────

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Origines autorisées à appeler la fonction (le site en production + tests locaux).
const ALLOWED_ORIGINS = [
  "https://nomos-haccp.fr",
  "https://www.nomos-haccp.fr",
  "http://localhost",
  "http://127.0.0.1",
];

function corsHeaders(origin: string): Record<string, string> {
  const allow = ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ? origin : "https://nomos-haccp.fr";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Rendu des 2 modèles d'e-mail (HTML sobre, compatible messageries) ─────────
function renderClient(p: Record<string, string>): { subject: string; html: string } {
  const subject = "Vos identifiants Nomos — " + (p.etablissement || "votre établissement");
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b">
    <div style="background:#4338ca;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:18px">Nomos HACCP</h2>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 22px">
      <p>Bonjour ${esc(p.responsable)},</p>
      <p>${esc(p.message)}</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;background:#f8fafc;border-radius:10px">
        <tr><td style="padding:8px 12px;color:#64748b">Établissement</td><td style="padding:8px 12px;font-weight:700">${esc(p.etablissement)}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b">Code d'accès</td><td style="padding:8px 12px;font-weight:700">${esc(p.code_acces)}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b">Mot de passe</td><td style="padding:8px 12px;font-weight:700">${esc(p.mot_de_passe)}</td></tr>
        ${p.formule ? `<tr><td style="padding:8px 12px;color:#64748b">Formule</td><td style="padding:8px 12px">${esc(p.formule)}</td></tr>` : ""}
      </table>
      <p style="font-size:13px;color:#64748b">Conservez ces identifiants : ils vous permettent de vous reconnecter.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:18px">Nomos HACCP — RTH NETGOCE, 49 rue de Douai, 75009 Paris.</p>
    </div>
  </div>`;
  return { subject, html };
}

function renderAdmin(p: Record<string, string>): { subject: string; html: string } {
  const subject = "Nomos — " + (p.etablissement || "notification") + " (" + (p.formule || "") + ")";
  const rows = [
    ["Établissement", p.etablissement],
    ["Secteur", p.secteur],
    ["Responsable", p.responsable],
    ["E-mail client", p.email_client],
    ["Téléphone", p.telephone],
    ["Formule", p.formule],
    ["Engagement", p.engagement],
    ["Repas/jour", p.nb_repas],
  ].filter(([, v]) => v && String(v).trim() && v !== "—");
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b">
    <h2 style="font-size:17px;color:#0f172a">Nomos — notification</h2>
    <p>${esc(p.message)}</p>
    <table style="width:100%;border-collapse:collapse;margin:10px 0">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 10px;color:#64748b;border-top:1px solid #eef2f7">${esc(k)}</td><td style="padding:6px 10px;border-top:1px solid #eef2f7">${esc(v)}</td></tr>`).join("")}
    </table>
  </div>`;
  return { subject, html };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...cors, "content-type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "");
    const params: Record<string, string> = body.params || {};

    const HOST = Deno.env.get("SMTP_HOST") || "ssl0.ovh.net";
    const PORT = Number(Deno.env.get("SMTP_PORT") || "465");
    const USER = Deno.env.get("SMTP_USER") || "";
    const PASS = Deno.env.get("SMTP_PASS") || "";
    const FROM = Deno.env.get("SMTP_FROM") || USER;
    const FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "Nomos HACCP";
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "lea@nomos-haccp.fr";

    if (!USER || !PASS) {
      return new Response(JSON.stringify({ error: "smtp_not_configured" }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
    }

    // Choix du destinataire et du contenu selon le type.
    let to = "";
    let subject = "";
    let html = "";
    if (type === "admin") {
      to = ADMIN_EMAIL; // destinataire fixe — non détournable par le client
      ({ subject, html } = renderAdmin(params));
    } else if (type === "client") {
      to = String(params.to_email || "").trim();
      ({ subject, html } = renderClient(params));
    } else {
      return new Response(JSON.stringify({ error: "invalid_type" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    // Validation minimale de l'adresse.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return new Response(JSON.stringify({ error: "invalid_recipient" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    const client = new SMTPClient({
      connection: {
        hostname: HOST,
        port: PORT,
        tls: true, // port 465 = SSL/TLS implicite
        auth: { username: USER, password: PASS },
      },
    });

    await client.send({
      from: `${FROM_NAME} <${FROM}>`,
      to,
      replyTo: ADMIN_EMAIL,
      subject,
      html,
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    console.error("[envoyer-email] échec:", e);
    return new Response(JSON.stringify({ error: "send_failed", detail: String(e && (e as Error).message || e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});

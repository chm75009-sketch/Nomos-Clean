// ────────────────────────────────────────────────────────────────────────────
// Nomos — Edge Function « rappel-mensuel » (PRÉPARÉE, non déployée)
//
// Envoie chaque mois, à chaque client actif, un e-mail lui rappelant d'EXPORTER
// son Pack DDPP (ses preuves) — via le SMTP OVH (UE). Déclenchée par pg_cron une
// fois par mois (voir rappel-mensuel.sql).
//
// SÉCURITÉ :
//   • Appelable uniquement avec le bon secret d'en-tête `x-cron-secret`
//     (= secret Supabase CRON_SECRET). Sinon 401. Désactiver « Verify JWT » sur
//     cette fonction (elle se protège par ce secret).
//   • La liste des destinataires vient d'une RPC SECURITY DEFINER côté base
//     (`clients_actifs_pour_rappel`) — pas d'exposition de table.
//
// SECRETS UTILISÉS (déjà présents, + CRON_SECRET à créer) :
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME
//   SUPABASE_URL (défaut), SUPABASE_SERVICE_ROLE_KEY (défaut)
//   CRON_SECRET  = <une longue chaîne aléatoire, à créer>
// ────────────────────────────────────────────────────────────────────────────

import nodemailer from "npm:nodemailer@6.9.16";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function corpsRappel(nom: string): { subject: string; html: string } {
  const subject = "Rappel mensuel — exportez votre Pack DDPP (preuves)";
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b">
    <div style="background:#4338ca;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:18px">Nomos HACCP — rappel mensuel</h2>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 22px">
      <p>Bonjour${nom ? " " + esc(nom) : ""},</p>
      <p>Pensez à <strong>exporter votre Pack DDPP</strong> (vos preuves d'autocontrôle en PDF)
         et à le sauvegarder sur votre propre support.</p>
      <p>Les relevés doivent être <strong>conservés plusieurs années</strong> et présentés
         en cas de contrôle officiel. Un export <strong>au moins une fois par mois</strong>
         vous met à l'abri.</p>
      <p style="margin:16px 0 4px"><strong>Comment faire :</strong> ouvrez l'application →
         bouton <strong>« Pack DDPP »</strong> → enregistrez le PDF généré.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:18px">Nomos HACCP — RTH NETGOCE, 49 rue de Douai, 75009 Paris.
         Vous recevez cet e-mail car vous êtes client actif de Nomos.</p>
    </div>
  </div>`;
  return { subject, html };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "content-type": "application/json" } });
  }
  // Authentification par secret partagé (pg_cron l'envoie dans l'en-tête).
  const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const HOST = Deno.env.get("SMTP_HOST") || "ssl0.ovh.net";
    const PORT = Number(Deno.env.get("SMTP_PORT") || "465");
    const USER = Deno.env.get("SMTP_USER") || "";
    const PASS = Deno.env.get("SMTP_PASS") || "";
    const FROM = Deno.env.get("SMTP_FROM") || USER;
    const FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "Nomos HACCP";

    // 1) Récupérer les clients actifs via la RPC SECURITY DEFINER.
    const rpcResp = await fetch(SUPABASE_URL + "/rest/v1/rpc/clients_actifs_pour_rappel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": "Bearer " + SERVICE_KEY,
      },
      body: "{}",
    });
    if (!rpcResp.ok) {
      const t = await rpcResp.text();
      return new Response(JSON.stringify({ error: "rpc_failed", detail: t }), { status: 500, headers: { "content-type": "application/json" } });
    }
    const clients: Array<{ email: string; nom: string }> = await rpcResp.json();

    // 2) Envoyer un e-mail à chacun (séquentiel, doux pour le SMTP).
    const transporter = nodemailer.createTransport({
      host: HOST, port: PORT, secure: PORT === 465, auth: { user: USER, pass: PASS },
    });

    let sent = 0, failed = 0;
    for (const c of clients) {
      const to = String(c.email || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { failed++; continue; }
      const { subject, html } = corpsRappel(c.nom || "");
      try {
        await transporter.sendMail({ from: `${FROM_NAME} <${FROM}>`, to, subject, html });
        sent++;
      } catch (e) {
        console.error("[rappel-mensuel] échec envoi", to, e);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, total: clients.length, sent, failed }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[rappel-mensuel] erreur:", e);
    return new Response(JSON.stringify({ error: "failed", detail: String(e && (e as Error).message || e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});

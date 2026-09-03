/* eslint-disable @typescript-eslint/no-require-imports */
const { botText } = require("../../shared/lib/copy");

const TICKET_DESCRIPTION_LIMIT = 8000;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncateDescription(value) {
  if (value.length <= TICKET_DESCRIPTION_LIMIT) {
    return value;
  }

  return `${value.slice(0, TICKET_DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function toParagraph(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function getDisplayName(from, locale) {
  const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ").trim();
  return name || from?.username || botText(locale, "report.ticket.noName");
}

function getContactName(contact) {
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim();
}

function buildPhotoBlock(photoFileIds, locale) {
  if (!photoFileIds.length) {
    return "";
  }

  const images = photoFileIds
    .map((_, index) => `<img src="tg://photo?id=ticket_photo_${index + 1}"/>`)
    .join("");

  if (photoFileIds.length === 1) {
    return `<figure>${images}<figcaption>${botText(locale, "report.ticket.userPhoto")}</figcaption></figure>`;
  }

  return `<tg-collage>${images}<figcaption>${botText(locale, "report.ticket.userPhotos")} · ${photoFileIds.length}</figcaption></tg-collage>`;
}

function buildDiagnosticsBlock(session, locale) {
  const report = session.diagnosticPayload;
  if (!report || typeof report !== "object") {
    return "";
  }

  const context = report.context && typeof report.context === "object"
    ? Object.entries(report.context)
        .slice(0, 24)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join("\n")
    : "";
  const breadcrumbs = Array.isArray(report.breadcrumbs)
    ? report.breadcrumbs
        .slice(-20)
        .map((item) => {
          const metadata = item?.metadata && typeof item.metadata === "object"
            ? ` · ${Object.entries(item.metadata)
                .map(([key, value]) => `${key}=${String(value)}`)
                .join(", ")}`
            : "";
          return `${item?.timestamp || "—"} · ${item?.category || botText(locale, "report.ticket.system")}/${item?.name || botText(locale, "report.ticket.unknown")} · ${item?.outcome || botText(locale, "report.ticket.info")}${metadata}`;
        })
        .join("\n")
    : "";
  const stack = typeof report.stack === "string" ? report.stack.slice(0, 5000) : "";

  return [
    `<h2>${botText(locale, "report.ticket.automaticDiagnostics")}</h2>`,
    `<p><b>${botText(locale, "report.ticket.reportId")}:</b> ${escapeHtml(session.diagnosticPublicId || report.id || "—")}<br>`,
    `<b>${botText(locale, "report.ticket.fingerprint")}:</b> ${escapeHtml(report.fingerprint || "—")}<br>`,
    `<b>${botText(locale, "report.ticket.area")}:</b> ${escapeHtml(report.area || "—")}<br>`,
    `<b>${botText(locale, "report.ticket.route")}:</b> ${escapeHtml(report.route || "—")}<br>`,
    `<b>${botText(locale, "report.ticket.time")}:</b> ${escapeHtml(report.timestamp || "—")}</p>`,
    `<h3>${botText(locale, "report.ticket.clientContext")}</h3>`,
    `<pre>${escapeHtml(context || botText(locale, "report.ticket.none"))}</pre>`,
    `<h3>${botText(locale, "report.ticket.recentActions")}</h3>`,
    `<pre>${escapeHtml(breadcrumbs || botText(locale, "report.ticket.none"))}</pre>`,
    stack
      ? `<h3>${botText(locale, "report.ticket.stack")}</h3><pre>${escapeHtml(stack)}</pre>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSupportTicketRichMessage(session, from) {
  const locale = session.locale === "en" ? "en" : "ru";
  const notSpecified = botText(locale, "report.ticket.notSpecifiedMasculine");
  const username = from?.username ? `@${from.username}` : notSpecified;
  const description = truncateDescription(
    (session.descriptionParts || []).filter(Boolean).join("\n\n"),
  );
  const contact = session.contact;
  const photoFileIds = (session.photoFileIds || []).filter(Boolean);
  const rows = [
    [botText(locale, "report.ticket.user"), getDisplayName(from, locale)],
    [botText(locale, "report.ticket.username"), username],
    [botText(locale, "report.ticket.telegramId"), from?.id || notSpecified],
    [botText(locale, "report.ticket.source"), session.source],
    ...(session.errorCode
      ? [[botText(locale, "report.ticket.errorCode"), session.errorCode]]
      : []),
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const contactBlock = contact
    ? [
        `<h2>${botText(locale, "report.ticket.contact")}</h2>`,
        `<p><b>${botText(locale, "report.ticket.name")}:</b> ${escapeHtml(getContactName(contact) || botText(locale, "report.ticket.notSpecifiedNeutral"))}<br>`,
        `<b>${botText(locale, "report.ticket.phone")}:</b> <a href="tel:${escapeHtml(contact.phone_number || "")}">${escapeHtml(contact.phone_number || notSpecified)}</a></p>`,
      ].join("")
    : `<h2>${botText(locale, "report.ticket.contact")}</h2><p>${botText(locale, "report.ticket.notAttached")}</p>`;
  const photoBlock = buildPhotoBlock(photoFileIds, locale);
  const diagnosticsBlock = buildDiagnosticsBlock(session, locale);
  const html = [
    `<h1>🆘 ${botText(locale, "report.ticket.title")}</h1>`,
    `<table bordered striped><tr><th>${botText(locale, "report.ticket.field")}</th><th>${botText(locale, "report.ticket.value")}</th></tr>${tableRows}</table>`,
    `<h2>${botText(locale, "report.ticket.problemDescription")}</h2>`,
    `<blockquote>${toParagraph(description || botText(locale, "report.ticket.descriptionMissing"))}</blockquote>`,
    diagnosticsBlock,
    contactBlock,
    photoBlock ? `<h2>${botText(locale, "report.ticket.attachments")}</h2>` : "",
    photoBlock,
    "<hr/>",
    `<footer>${botText(locale, "report.ticket.contact")}: ${contact ? botText(locale, "report.ticket.added") : botText(locale, "report.ticket.none")} · ${botText(locale, "report.ticket.photos")}: ${photoFileIds.length}</footer>`,
  ]
    .filter(Boolean)
    .join("\n");
  const media = photoFileIds.map((fileId, index) => ({
    id: `ticket_photo_${index + 1}`,
    media: {
      type: "photo",
      media: fileId,
    },
  }));

  return { html, media };
}

module.exports = {
  buildSupportTicketRichMessage,
};

/* eslint-disable @typescript-eslint/no-require-imports */
const { botText } = require("../../shared/lib/copy");

const REPORT_CALLBACK_PREFIX = "report";
const DESCRIPTION_PREVIEW_LIMIT = 1800;

function truncatePreview(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildReportPreview(session) {
  const locale = session.locale;
  const description = (session.descriptionParts || [])
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n\n");
  const descriptionPreview = description
    ? truncatePreview(description, DESCRIPTION_PREVIEW_LIMIT)
    : botText(locale, "report.preview.descriptionMissing");
  const contactPreview =
    session.contactLabel ||
    (session.hasContact
      ? botText(locale, "report.preview.contactAdded")
      : botText(locale, "report.preview.contactMissing"));

  return [
    botText(locale, "report.preview.title"),
    botText(locale, "report.preview.source", { source: session.source }),
    session.errorCode
      ? botText(locale, "report.preview.errorCode", {
          errorCode: session.errorCode,
        })
      : null,
    session.diagnosticPayload
      ? botText(locale, "report.preview.diagnostics")
      : null,
    "",
    botText(locale, "report.preview.description"),
    descriptionPreview,
    "",
    botText(locale, "report.preview.contact", { contact: contactPreview }),
    botText(locale, "report.preview.photos", {
      count: session.photoCount || 0,
    }),
    "",
    session.hasDescription
      ? botText(locale, "report.preview.ready")
      : botText(locale, "report.preview.needsDescription"),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function buildReportPreviewButtons(sessionId, locale = "ru") {
  return [
    {
      text: botText(locale, "report.submitLabel"),
      callback_data: `${REPORT_CALLBACK_PREFIX}:submit:${sessionId}`,
    },
    {
      text: botText(locale, "report.cancelLabel"),
      callback_data: `${REPORT_CALLBACK_PREFIX}:cancel:${sessionId}`,
    },
  ];
}

function parseReportCallback(data) {
  const match = String(data || "").match(/^report:(submit|cancel):([a-zA-Z0-9_-]{1,32})$/);

  if (!match) {
    return null;
  }

  return {
    action: match[1],
    sessionId: match[2],
  };
}

module.exports = {
  buildReportPreview,
  buildReportPreviewButtons,
  parseReportCallback,
};

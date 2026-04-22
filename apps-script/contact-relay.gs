const RECIPIENT = "thenotleysgc@gmail.com";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const subject = String(data.subject || "").trim();
    const message = String(data.message || "").trim();
    const website = String(data.website || "").trim();
    const source = String(data.source || "homepage-contact").trim();

    if (website) {
      return jsonResponse({ success: false, message: "Spam rejected." }, 400);
    }

    if (!name || !email || !subject || !message) {
      return jsonResponse({ success: false, message: "Missing required fields." }, 400);
    }

    MailApp.sendEmail({
      to: RECIPIENT,
      replyTo: email,
      subject: "[The Notleys] " + subject,
      htmlBody:
        "<p><strong>Name:</strong> " + escapeHtml(name) + "</p>" +
        "<p><strong>Email:</strong> " + escapeHtml(email) + "</p>" +
        "<p><strong>Source:</strong> " + escapeHtml(source) + "</p>" +
        "<p><strong>Message:</strong></p>" +
        "<p>" + escapeHtml(message).replace(/\n/g, "<br>") + "</p>",
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message }, 500);
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

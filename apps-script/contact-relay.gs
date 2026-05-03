const RECIPIENT = "thenotleysgc@gmail.com";
const ALLOWED_SUBJECTS = [
  "General enquiry",
  "Membership",
  "Visitor / green fee enquiry",
  "Society or group booking",
  "Course status",
  "Competitions",
  "Website feedback",
  "Other",
];
const ALLOWED_SOURCE = "homepage-contact";
const LIMITS = {
  name: 100,
  email: 254,
  phone: 40,
  source: 40,
  message: 2000,
};
const DAILY_GLOBAL_LIMIT = 80;
const DAILY_EMAIL_LIMIT = 5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-() \t.]*$/;

function doPost(e) {
  try {
    const data = parseRequestData(e);
    const name = cleanField(data.name, LIMITS.name);
    const email = cleanField(data.email, LIMITS.email).toLowerCase();
    const subject = cleanField(data.subject, 80);
    const phone = cleanField(data.phone, LIMITS.phone);
    const message = cleanField(data.message, LIMITS.message);
    const website = cleanField(data.website, 200);
    const source = cleanField(data.source || ALLOWED_SOURCE, LIMITS.source);

    if (website) {
      return jsonResponse({ success: false, message: "Spam rejected." }, 400);
    }

    if (!isValidSubmission(name, email, subject, phone, message, source)) {
      return jsonResponse({ success: false, message: "Missing required fields." }, 400);
    }

    if (!reserveSubmissionQuota(email)) {
      return jsonResponse({ success: false, message: "Too many submissions. Please email the club directly." }, 429);
    }

    const body =
      "Name: " + name + "\n" +
      "Email: " + email + "\n" +
      (phone ? "Phone: " + phone + "\n" : "") +
      "Source: " + source + "\n\n" +
      "Message:\n" +
      message;

    const phoneHtml = phone ? "<p><strong>Phone:</strong> " + escapeHtml(phone) + "</p>" : "";

    MailApp.sendEmail({
      to: RECIPIENT,
      replyTo: email,
      subject: "[The Notleys] " + subject,
      body: body,
      htmlBody:
        "<p><strong>Name:</strong> " + escapeHtml(name) + "</p>" +
        "<p><strong>Email:</strong> " + escapeHtml(email) + "</p>" +
        phoneHtml +
        "<p><strong>Source:</strong> " + escapeHtml(source) + "</p>" +
        "<p><strong>Message:</strong></p>" +
        "<p>" + escapeHtml(message).replace(/\n/g, "<br>") + "</p>",
    });

    return jsonResponse({ success: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ success: false, message: "Unable to send enquiry right now." }, 500);
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function parseRequestData(e) {
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }

  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  return JSON.parse(e.postData.contents || "{}");
}

function cleanField(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidSubmission(name, email, subject, phone, message, source) {
  return Boolean(
    name.length >= 2 &&
      EMAIL_REGEX.test(email) &&
      ALLOWED_SUBJECTS.indexOf(subject) !== -1 &&
      (!phone || PHONE_REGEX.test(phone)) &&
      message.length >= 10 &&
      source === ALLOWED_SOURCE
  );
}

function reserveSubmissionQuota(email) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(3000)) {
    return false;
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), "Etc/UTC", "yyyyMMdd");
    pruneOldQuotaCounters(properties, today);

    const globalKey = "contact:" + today + ":global";
    const emailKey = "contact:" + today + ":email:" + digestValue(email);
    const globalCount = Number(properties.getProperty(globalKey) || "0");
    const emailCount = Number(properties.getProperty(emailKey) || "0");

    if (globalCount >= DAILY_GLOBAL_LIMIT || emailCount >= DAILY_EMAIL_LIMIT) {
      return false;
    }

    properties.setProperty(globalKey, String(globalCount + 1));
    properties.setProperty(emailKey, String(emailCount + 1));
    return true;
  } finally {
    lock.releaseLock();
  }
}

function digestValue(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  let digest = "";

  for (let index = 0; index < bytes.length; index += 1) {
    digest += ("0" + (bytes[index] & 0xff).toString(16)).slice(-2);
  }

  return digest;
}

function pruneOldQuotaCounters(properties, today) {
  const activePrefix = "contact:" + today + ":";
  const allProperties = properties.getProperties();

  Object.keys(allProperties).forEach(function (key) {
    if (key.indexOf("contact:") === 0 && key.indexOf(activePrefix) !== 0) {
      properties.deleteProperty(key);
    }
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Server-side validation for enquiry submissions.
 *
 * The browser form is a convenience only — every rule here is enforced on the
 * server, and unknown fields are dropped rather than stored.
 */

const MAX = {
  short: 120,
  medium: 200,
  long: 2000,
};

const LODGES = [
  "Tengile River Lodge",
  "Rattray’s Lodge",
  "Rattray's Lodge",
  "MalaMala Camp",
  "Sable Camp",
  "Kirkman’s Kamp",
  "Kirkman's Kamp",
  "No preference",
  "No preference — recommend for me",
];

const TRANSFERS = [
  "Light aircraft from MQP",
  "Road transfer",
  "Self-drive",
  "Arrange for me",
];

const FLEXIBILITY = ["Exact dates", "± 3 days", "± 1 week", "Flexible"];

const SUBJECTS = [
  "New booking enquiry",
  "Existing reservation",
  "Trade / partner enquiry",
  "Media request",
  "Other",
];

const SOURCES = ["plan-your-stay", "quick-enquiry", "contact"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function str(v) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function intIn(v, min, max) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return undefined; // undefined = invalid
  return n;
}

/**
 * @param {unknown} body raw request body
 * @param {{ requireConsent?: boolean, requireDates?: boolean }} opts
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateEnquiry(body, opts = {}) {
  const { requireConsent = false, requireDates = false } = opts;
  const errors = {};
  const b = body && typeof body === "object" ? body : {};

  const source = str(b.source) || "plan-your-stay";
  if (!SOURCES.includes(source)) errors.source = "Unknown enquiry source.";

  /* ---- Step 1: dates & guests ---- */
  let arrival = str(b.arrival_date);
  let departure = str(b.departure_date);

  if (arrival && !isRealDate(arrival)) errors.arrival_date = "Arrival date is not a valid date.";
  if (departure && !isRealDate(departure)) errors.departure_date = "Departure date is not a valid date.";
  if (requireDates && !arrival) errors.arrival_date = "Please provide an arrival date.";
  if (requireDates && !departure) errors.departure_date = "Please provide a departure date.";
  if (arrival && departure && !errors.arrival_date && !errors.departure_date && departure <= arrival) {
    errors.departure_date = "Departure must be after arrival.";
  }

  const adults = intIn(b.adults, 1, 20);
  if (adults === undefined) errors.adults = "Adults must be between 1 and 20.";

  const children = intIn(b.children, 0, 20);
  if (children === undefined) errors.children = "Children must be between 0 and 20.";

  let flexibility = str(b.flexibility);
  if (flexibility && !FLEXIBILITY.includes(flexibility)) errors.flexibility = "Unknown flexibility option.";

  /* ---- Step 2: lodge & transfers ---- */
  let lodge = str(b.lodge);
  if (lodge && !LODGES.includes(lodge)) errors.lodge = "Unknown lodge selection.";

  let transfer = str(b.transfer);
  if (transfer && !TRANSFERS.includes(transfer)) errors.transfer = "Unknown transfer option.";

  const experiences = str(b.experiences);
  if (experiences.length > MAX.long) errors.experiences = "Experiences note is too long.";

  /* ---- Step 3: contact details ---- */
  const fullName = str(b.full_name);
  if (!fullName) errors.full_name = "Please provide your full name.";
  else if (fullName.length > MAX.short) errors.full_name = "Name is too long.";

  const email = str(b.email);
  if (!email) errors.email = "Please provide an email address.";
  else if (!EMAIL_RE.test(email) || email.length > MAX.medium) errors.email = "Please provide a valid email address.";

  const phone = str(b.phone);
  if (phone.length > MAX.medium) errors.phone = "Phone number is too long.";

  const country = str(b.country);
  if (country.length > MAX.short) errors.country = "Country is too long.";

  const notes = str(b.notes);
  if (notes.length > MAX.long) errors.notes = "Notes are too long.";

  // Optional contact-form subject is validated but stored in `notes` context via source.
  const subject = str(b.subject);
  if (subject && !SUBJECTS.includes(subject)) errors.subject = "Unknown subject.";

  const consentRaw = b.consent;
  const consent = consentRaw === true || consentRaw === "true" || consentRaw === "on" || consentRaw === 1 || consentRaw === "1";
  if (requireConsent && !consent) errors.consent = "Please agree to be contacted about your enquiry.";

  const ok = Object.keys(errors).length === 0;

  // Whitelisted, trimmed value set — nothing else from the body is persisted.
  const value = {
    arrival_date: arrival || null,
    departure_date: departure || null,
    adults: adults === undefined ? null : adults,
    children: children === undefined ? null : children,
    flexibility: flexibility || null,
    lodge: lodge || null,
    transfer: transfer || null,
    experiences: experiences || null,
    full_name: fullName || null,
    email: email ? email.toLowerCase() : null,
    phone: phone || null,
    country: country || null,
    notes: [subject ? `Subject: ${subject}` : "", notes].filter(Boolean).join("\n") || null,
    consent,
    source,
  };

  return { ok, errors, value };
}

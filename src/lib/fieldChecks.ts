/**
 * Shape checks for the fields a person types, mirroring the server's
 * app/core/field_checks.py.
 *
 * The server is the rule; this is the courtesy. Keeping the two in one
 * shape means the form refuses what the API would refuse, at the moment
 * it is typed, instead of after a round trip that reads as a crash. When
 * one side changes, change the other: the forms used to allow a six-digit
 * number and a nineteen-digit one, each page disagreeing with the next.
 *
 * Every message names what is wrong with the value rather than calling it
 * invalid, because the person reading it is the person who typed it.
 */

/** Deliberately loose - catches the typos, leaves the rest to a bounce. */
export const EMAIL = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

/** Indian mobile numbers: ten digits opening 6, 7, 8 or 9. */
export const MOBILE = /^[6-9]\d{9}$/;

/** 15 characters: two state digits, a PAN, an entity digit, Z, a checksum. */
export const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

/** Five letters, four digits, one letter. */
export const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;

/** Six digits, never opening with a zero. */
export const PIN = /^[1-9]\d{5}$/;

/** How many digits a mobile number has, once stripped. */
export const MOBILE_DIGITS = 10;

/**
 * A phone number as the digits that matter: separators and the country
 * code dropped, written any of the three usual ways.
 */
export function digits(value: string | null | undefined): string {
  const raw = String(value ?? "").replace(/\D/g, "");

  for (const prefix of ["0091", "91", "0"]) {
    if (raw.startsWith(prefix) && raw.length === prefix.length + MOBILE_DIGITS) {
      return raw.slice(prefix.length);
    }
  }

  return raw;
}

/**
 * What a mobile field should hold after this keystroke.
 *
 * Typing an eleventh digit does nothing, which is the whole point: the
 * field cannot hold a number the server will reject for its length.
 */
export function capMobile(value: string): string {
  const raw = String(value ?? "").replace(/\D/g, "");

  for (const prefix of ["0091", "91", "0"]) {
    if (raw.startsWith(prefix) && raw.length > prefix.length) {
      return raw.slice(prefix.length, prefix.length + MOBILE_DIGITS);
    }
  }

  return raw.slice(0, MOBILE_DIGITS);
}

/** Keeps a code field to the characters and the length it can hold. */
export function capCode(value: string, length: number): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, length);
}

/** Keeps a PIN field to six digits. */
export function capPin(value: string): string {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

export function emailError(
  value: string | null | undefined,
  { required = false, field = "Email address" } = {},
): string | null {
  const text = String(value ?? "").trim();

  if (!text) return required ? `${field} is required.` : null;

  return EMAIL.test(text) ? null : `“${text}” is not a valid email address.`;
}

export function mobileError(
  value: string | null | undefined,
  { required = false, field = "Mobile number" } = {},
): string | null {
  const text = String(value ?? "").trim();

  if (!text) return required ? `${field} is required.` : null;

  const cleaned = digits(text);

  if (!cleaned) return `${field} has no digits in it.`;

  if (cleaned.length !== MOBILE_DIGITS) {
    return `That is ${cleaned.length} digits; an Indian mobile number has 10.`;
  }

  if (!MOBILE.test(cleaned)) {
    return `A mobile number starts with 6, 7, 8 or 9, not ${cleaned[0]}.`;
  }

  return null;
}

export function gstinError(
  value: string | null | undefined,
  { field = "GSTIN" } = {},
): string | null {
  const text = String(value ?? "").trim().toUpperCase();

  if (!text) return null;

  if (text.length !== 15) {
    return `That is ${text.length} characters; a ${field} has 15.`;
  }

  return GSTIN.test(text)
    ? null
    : "Two state digits, a PAN, an entity digit, Z, then a checksum character.";
}

export function panError(
  value: string | null | undefined,
  { field = "PAN" } = {},
): string | null {
  const text = String(value ?? "").trim().toUpperCase();

  if (!text) return null;

  return PAN.test(text)
    ? null
    : `A ${field} is five letters, four digits, then a letter.`;
}

export function pinError(
  value: string | null | undefined,
  { required = false, field = "PIN code" } = {},
): string | null {
  const text = String(value ?? "").trim();

  if (!text) return required ? `${field} is required.` : null;

  return PIN.test(text) ? null : "A PIN code is six digits, not starting with 0.";
}

/**
 * A web address, as people actually type one.
 *
 * The field is required on the opportunity form and nothing checked it,
 * so "zdxfcgv" went through as a company's website. Accepted with or
 * without a scheme and with or without www, because nobody types
 * https:// into a form; what it insists on is a name with a dot and a
 * plausible suffix after it.
 */
const WEBSITE =
  /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d{2,5})?(\/[^\s]*)?$/i;

export function websiteError(
  value: string | null | undefined,
  { required = false, field = "Website" } = {},
): string | null {
  const text = String(value ?? "").trim();

  if (!text) return required ? `${field} is required.` : null;

  if (/\s/.test(text)) return "A web address has no spaces in it.";

  return WEBSITE.test(text)
    ? null
    : `“${text}” is not a web address. Try something like acme.com.`;
}

/** An address as the forms hold it. */
export interface AddressFields {
  street?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  pin?: string | null;
}

const isIndia = (country?: string | null) =>
  !String(country ?? "").trim() || /^india$/i.test(String(country).trim());

/**
 * What is wrong with one address, worded for the person who typed it.
 *
 * ``required`` asks for every field, as the forms' asterisks say. Without
 * it only the shape of what was typed is checked, which is how a draft is
 * saved. A PIN is held to six digits only for India; a foreign postcode is
 * whatever that country uses.
 */
export function addressErrors(
  address: AddressFields,
  { label, required = false }: { label: string; required?: boolean },
): string[] {
  const problems: string[] = [];
  const text = (value?: string | null) => String(value ?? "").trim();

  if (required) {
    if (!text(address.street))
      problems.push(`${label}: street address is required.`);
    if (!text(address.country)) problems.push(`${label}: country is required.`);
    if (!text(address.state)) problems.push(`${label}: state is required.`);
    if (!text(address.city)) problems.push(`${label}: city is required.`);
    if (!text(address.pin))
      problems.push(`${label}: PIN / ZIP code is required.`);
  }

  if (text(address.pin) && isIndia(address.country)) {
    const pinProblem = pinError(address.pin);
    if (pinProblem) problems.push(`${label}: ${pinProblem}`);
  }

  return problems;
}

/** Whether a PIN field should be held to six digits as it is typed. */
export function capPinFor(
  country: string | null | undefined,
  value: string,
): string {
  return isIndia(country) ? capPin(value) : value;
}

/**
 * The organisation's registration numbers.
 *
 * A registered business has a PAN, so it is required once Registration
 * says Registered - when ``required`` is on, which is everywhere but a
 * draft. GSTIN and PAN are checked for shape whenever they are typed.
 */
export function organisationErrors(
  {
    registration,
    gst,
    pan,
  }: { registration?: string | null; gst?: string | null; pan?: string | null },
  { required = false }: { required?: boolean } = {},
): string[] {
  const problems: string[] = [];
  const registered = String(registration ?? "").trim() === "Registered";

  if (required && registered && !String(pan ?? "").trim()) {
    problems.push("PAN is required for a registered organisation.");
  }

  const panProblem = panError(pan);
  if (panProblem) problems.push(panProblem);

  const gstProblem = gstinError(gst);
  if (gstProblem) problems.push(`GST: ${gstProblem}`);

  return problems;
}

/** One line for a toast: the first problem, and how many more there are. */
export function summariseProblems(problems: string[]): string {
  if (problems.length <= 1) return problems[0] || "";

  return `${problems[0]} (${problems.length - 1} more to fix)`;
}

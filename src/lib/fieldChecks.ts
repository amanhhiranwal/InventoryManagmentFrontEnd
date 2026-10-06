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

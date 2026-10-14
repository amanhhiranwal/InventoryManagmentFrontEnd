/** What a password somebody chooses has to be.
 *
 * The same rules the API enforces (app/services/password_service.py).
 * They are repeated here so a password is refused while it is being
 * typed rather than after a round trip - the API is still what decides.
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Everything that is not a letter, a digit, a space or an equals sign. */
const SYMBOLS = "!@#$%^&*()-_+[]{};:,.<>?/\\|~`'\"";

export interface PasswordRule {
  /** What the rule asks for, as it is shown beside the field. */
  label: string;
  met: boolean;
}

export function passwordRules(password: string): PasswordRule[] {
  const value = password || "";

  return [
    {
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: value.length >= MIN_PASSWORD_LENGTH,
    },
    {
      label: "A small letter (a-z)",
      met: /[a-z]/.test(value),
    },
    {
      label: "A capital letter (A-Z)",
      met: /[A-Z]/.test(value),
    },
    {
      label: "A number (0-9)",
      met: /[0-9]/.test(value),
    },
    {
      label: "A symbol such as ! @ # $",
      met: value.split("").some((character) => SYMBOLS.includes(character)),
    },
    {
      label: "No spaces and no equals sign",
      met: value.length > 0 && !/\s/.test(value) && !value.includes("="),
    },
  ];
}

/** Whether a password meets every rule. */
export function passwordIsStrong(password: string): boolean {
  return passwordRules(password).every((rule) => rule.met);
}

/** The first thing wrong with it, for a toast, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  const failed = passwordRules(password).filter((rule) => !rule.met);

  if (failed.length === 0) return null;

  return `A password needs: ${failed.map((rule) => rule.label.toLowerCase()).join(", ")}.`;
}

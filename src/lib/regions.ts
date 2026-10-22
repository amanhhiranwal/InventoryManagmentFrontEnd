/**
 * What "State / Province" means, per country.
 *
 * The picker used to offer the same list whatever the country was - the
 * states table, which holds India's - so a lead could be filed in
 * Jharkhand, China. The country now decides the list, and picking a
 * different country clears a state that does not belong to it.
 *
 * India is deliberately absent here: its states come from the masters
 * table, so adding one there reaches the form without a release.
 */

export const COUNTRIES = [
  "India",
  "United States",
  "China",
  "Malaysia",
  "Indonesia",
] as const;

export type Country = (typeof COUNTRIES)[number] | string;

const REGIONS: Record<string, string[]> = {
  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ],
  China: [
    "Anhui", "Beijing", "Chongqing", "Fujian", "Gansu", "Guangdong",
    "Guangxi", "Guizhou", "Hainan", "Hebei", "Heilongjiang", "Henan",
    "Hong Kong", "Hubei", "Hunan", "Inner Mongolia", "Jiangsu", "Jiangxi",
    "Jilin", "Liaoning", "Macau", "Ningxia", "Qinghai", "Shaanxi",
    "Shandong", "Shanghai", "Shanxi", "Sichuan", "Tianjin", "Tibet",
    "Xinjiang", "Yunnan", "Zhejiang",
  ],
  Malaysia: [
    "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Malacca",
    "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya",
    "Sabah", "Sarawak", "Selangor", "Terengganu",
  ],
  Indonesia: [
    "Aceh", "Bali", "Bangka Belitung", "Banten", "Bengkulu", "Central Java",
    "Central Kalimantan", "Central Sulawesi", "East Java",
    "East Kalimantan", "East Nusa Tenggara", "Gorontalo", "Jakarta", "Jambi",
    "Lampung", "Maluku", "North Kalimantan", "North Maluku",
    "North Sulawesi", "North Sumatra", "Papua", "Riau", "Riau Islands",
    "South Kalimantan", "South Sulawesi", "South Sumatra",
    "Southeast Sulawesi", "West Java", "West Kalimantan",
    "West Nusa Tenggara", "West Papua", "West Sulawesi", "West Sumatra",
    "Yogyakarta",
  ],
};

/**
 * The states or provinces to offer for a country.
 *
 * `indiaStates` is what the masters table holds; it is passed in rather
 * than fetched here so the caller keeps its one request.
 */
export function regionsFor(country: string, indiaStates: string[]): string[] {
  const name = (country || "").trim();

  if (!name || name === "India") return indiaStates;

  return REGIONS[name] ?? [];
}

/** Whether a state still makes sense once the country has changed. */
export function regionBelongsTo(
  country: string,
  state: string,
  indiaStates: string[],
): boolean {
  if (!state) return true;

  const list = regionsFor(country, indiaStates);

  // A country with no list of its own takes anything typed into it.
  if (!list.length) return true;

  return list.some((item) => item.toLowerCase() === state.toLowerCase());
}

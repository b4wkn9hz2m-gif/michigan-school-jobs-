// Adds facts that help job seekers and Google: the employer's city (from a hand-checked list —
// unknown employers get no city rather than a guess) and a salary range when the posting states one.

// District / agency -> city where its offices are. Only entries we're confident about.
export const EMPLOYER_CITY: Record<string, string> = {
  "Ann Arbor Public Schools": "Ann Arbor", "Walled Lake Consolidated Schools": "Walled Lake", "Monroe County Intermediate School District": "Monroe",
  "Southfield Public Schools": "Southfield", "Saginaw Public Schools": "Saginaw", "Ypsilanti Community Schools": "Ypsilanti",
  "Plymouth-Canton Community Schools": "Canton", "Wayne-Westland Community Schools": "Westland", "Waterford School District": "Waterford",
  "South Lyon Community Schools": "South Lyon", "Farmington Public Schools": "Farmington", "Battle Creek Public Schools": "Battle Creek",
  "West Ottawa Public Schools": "Holland", "Troy School District": "Troy", "Novi Community School District": "Novi", "Romeo Community Schools": "Romeo",
  "Southgate Community School District": "Southgate", "Hazel Park Schools": "Hazel Park", "Bloomfield Hills Schools": "Bloomfield Hills",
  "Branch Intermediate School District": "Coldwater", "Rockford Public Schools": "Rockford", "Oak Park Schools": "Oak Park", "Flint Community Schools": "Flint",
  "Berkley School District": "Berkley", "Birmingham Public Schools": "Birmingham", "Livonia Public Schools": "Livonia",
  "Montcalm Area Intermediate School District": "Stanton", "Dearborn Public Schools": "Dearborn", "School District of the City of Pontiac": "Pontiac",
  "Kentwood Public Schools": "Kentwood", "Grosse Ile Township Schools": "Grosse Ile", "Taylor School District": "Taylor", "Clarkston Community Schools": "Clarkston",
  "South Redford School District": "Redford", "Harper Woods School District": "Harper Woods", "South Haven Public Schools": "South Haven",
  "Lamphere Schools": "Madison Heights", "Holly Area Schools": "Holly", "Tahquamenon": "Newberry", "Northville Public Schools": "Northville",
  "River Rouge School District": "River Rouge", "St. Clair County RESA": "Marysville", "Allen Park Public Schools": "Allen Park",
  "Central Montcalm Public School": "Stanton", "Crestwood School District": "Dearborn Heights", "Mattawan Consolidated School": "Mattawan",
  "Oxford Community Schools": "Oxford", "Lincoln Park Public Schools": "Lincoln Park", "Royal Oak Schools": "Royal Oak", "Jenison Public Schools": "Jenison",
  "Manistee Intermediate School District": "Manistee", "Clawson Public Schools": "Clawson", "Clare-Gladwin RESD": "Clare", "Holland Public Schools": "Holland",
  "Redford Union School District No 1": "Redford", "Garden City Public Schools": "Garden City", "Spring Lake Public Schools": "Spring Lake",
  "Eastern Upper Peninsula Intermediate School District": "Sault Ste. Marie", "Madison District Public Schools": "Madison Heights",
  "Van Buren Public Schools": "Belleville", "Mt. Pleasant Public Schools": "Mount Pleasant", "Mt. Pleasant Schools": "Mount Pleasant", "Ferndale Public Schools": "Ferndale",
  "Wayne County RESA": "Wayne", "Dearborn Academy": "Dearborn", "Lapeer County ISD": "Lapeer", "Clarenceville School District": "Livonia",
  "Hamtramck Public Schools": "Hamtramck", "West Bloomfield School District": "West Bloomfield", "Gibraltar School District": "Gibraltar",
  "Melvindale Northern Allen Park Public Schools": "Melvindale", "Huron School District": "New Boston", "Romulus Community Schools": "Romulus",
  "Sault Area Public School District": "Sault Ste. Marie", "St. Louis Public Schools": "St. Louis", "Coopersville Area Public Schools": "Coopersville",
  "Woodhaven-Brownstown School District": "Woodhaven", "Atherton Community School District": "Burton", "Flushing Community Schools": "Flushing",
  "Mount Morris Consolidated Schools": "Mount Morris", "Reese Public Schools": "Reese", "Grosse Pointe Public Schools": "Grosse Pointe",
  "Hopkins Public Schools": "Hopkins", "Ida Public School District": "Ida", "Riverview Community School District": "Riverview",
  "Wyandotte Public Schools": "Wyandotte", "Oakland Schools": "Waterford", "Carson City-Crystal Schools": "Carson City", "Bangor Public Schools": "Bangor",
  "Lakeview Community Schools": "Lakeview", "Flat Rock Community Schools": "Flat Rock", "Detroit Leadership Academy": "Detroit", "Trenton Public Schools": "Trenton",
  "Fenton Area Public Schools": "Fenton", "Washtenaw Education Consortium": "Ann Arbor", "Montrose Community School District": "Montrose",
  "Dearborn Heights School District No. 7": "Dearborn Heights", "Charlevoix - Emmet ISD": "Charlevoix", "Engadine Consolidated Schools": "Engadine",
  "Vassar Public Schools": "Vassar", "Vestaburg Community School": "Vestaburg", "Swartz Creek Community School District": "Swartz Creek",
  "Kingsley Area Schools": "Kingsley", "Ecorse Public Schools": "Ecorse", "Pickford Public Schools": "Pickford", "Boyne City Schools": "Boyne City",
  "Goodrich Area Schools": "Goodrich", "Ashley Community Schools": "Ashley", "Gratiot-Isabella RESD": "Ithaca", "Grand Blanc Community Schools": "Grand Blanc",
  "Kalamazoo RESA": "Kalamazoo", "DeTour Area Schools": "DeTour Village", "Dundee Community Schools": "Dundee", "St. Ignace Area Schools": "St. Ignace",
  "Alanson Public Schools": "Alanson", "Brighton Area Schools": "Brighton", "Trinity Christian Academy": "Pontiac",
};

export function cityFor(employer: string): string {
  return EMPLOYER_CITY[employer] ?? "";
}

export type Salary = { min: number; max: number; unit: "HOUR" | "YEAR"; text: string };

const MONEY = String.raw`\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s?(k|K)?`;
const RANGE = new RegExp(`${MONEY}(?:\\s*(?:-|–|—|to)\\s*${MONEY})?`, "g");
const SKIP = /bonus|stipend|incentive|reimburse|tuition|fee|sign[- ]on/;
const PAY_WORDS = /salary|pay|wage|rate|hourly|per hour|\/\s?h(ou)?r|annual|per year|\/\s?yr|starting|compensation/;

/** Find a stated pay range. Conservative: needs pay wording nearby and skips bonuses/stipends. */
export function extractSalary(text: string): Salary | null {
  for (const m of text.matchAll(RANGE)) {
    const start = m.index ?? 0;
    const before = text.slice(Math.max(0, start - 45), start).toLowerCase();
    const after = text.slice(start + m[0].length, start + m[0].length + 30).toLowerCase();
    if (SKIP.test(before + " " + after)) continue;
    if (!PAY_WORDS.test(before + " " + after)) continue;
    const num = (v?: string, k?: string) => (v ? Number(v.replace(/,/g, "")) * (k ? 1000 : 1) : NaN);
    const lo = num(m[1], m[2]);
    const hi = m[3] ? num(m[3], m[4]) : lo;
    if (!isFinite(lo) || !isFinite(hi) || hi < lo) continue;
    const hourly = /hour|\/\s?h(ou)?r/.test(before + " " + after) || hi < 200;
    if (hourly ? lo < 7 || hi > 150 : lo < 15000 || hi > 300000) continue;
    const fmt = (n: number) => (hourly ? `$${n.toFixed(2).replace(/\.00$/, "")}` : `$${Math.round(n).toLocaleString("en-US")}`);
    return { min: lo, max: hi, unit: hourly ? "HOUR" : "YEAR", text: `${fmt(lo)}${hi !== lo ? `–${fmt(hi)}` : ""}${hourly ? "/hour" : "/year"}` };
  }
  return null;
}

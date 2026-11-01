export const COUNTIES = [
  "Alcona","Alger","Allegan","Alpena","Antrim","Arenac","Baraga","Barry","Bay","Benzie",
  "Berrien","Branch","Calhoun","Cass","Charlevoix","Cheboygan","Chippewa","Clare","Clinton","Crawford",
  "Delta","Dickinson","Eaton","Emmet","Genesee","Gladwin","Gogebic","Grand Traverse","Gratiot","Hillsdale",
  "Houghton","Huron","Ingham","Ionia","Iosco","Iron","Isabella","Jackson","Kalamazoo","Kalkaska",
  "Kent","Keweenaw","Lake","Lapeer","Leelanau","Lenawee","Livingston","Luce","Mackinac","Macomb",
  "Manistee","Marquette","Mason","Mecosta","Menominee","Midland","Missaukee","Monroe","Montcalm","Montmorency",
  "Muskegon","Newaygo","Oakland","Oceana","Ogemaw","Ontonagon","Osceola","Oscoda","Otsego","Ottawa",
  "Presque Isle","Roscommon","Saginaw","St. Clair","St. Joseph","Sanilac","Schoolcraft","Shiawassee","Tuscola","Van Buren",
  "Washtenaw","Wayne","Wexford",
] as const;

export const JOB_TYPES = ["Full Time", "Part Time", "Substitute", "Temporary", "Internship"] as const;

// Order matters: the first category whose keywords match a title wins as the primary category.
export const CATEGORIES = [
  { slug: "special-education", name: "Special Education", keywords: ["special ed", "sped", "resource room", "autism", "asd", "cognitively", "emotionally impaired", "learning disab", "inclusion", "iep"] },
  { slug: "therapies", name: "Therapies & Related Services", keywords: ["speech", "slp", "occupational therap", "physical therap", "school psych", "social worker", "counselor", "nurse", "audiolog", "behavior analyst", "bcba"] },
  { slug: "administrative", name: "Administration & Office", keywords: ["principal", "superintendent", "director", "coordinator", "secretary", "clerk", "administrative", "payroll", "accountant", "human resources", "receptionist"] },
  { slug: "transportation", name: "Transportation", keywords: ["bus driver", "bus aide", "transportation", "mechanic", "driver"] },
  { slug: "maintenance", name: "Maintenance & Custodial", keywords: ["custodian", "custodial", "maintenance", "groundskeeper", "facilities", "hvac", "electrician", "plumber"] },
  { slug: "food-service", name: "Food Service", keywords: ["food service", "cook", "cafeteria", "nutrition", "lunch"] },
  { slug: "paraprofessional", name: "Paraprofessionals & Aides", keywords: ["paraprofessional", "parapro", "para ", "aide", "instructional assistant", "teacher assistant", "interventionist"] },
  { slug: "coaching", name: "Coaching & Athletics", keywords: ["coach", "athletic"] },
  { slug: "teaching", name: "Teaching", keywords: ["teacher", "instructor", "educator", "kindergarten", "grade", "math", "science", "english", "ela", "social studies", "music", "art ", "spanish", "librarian", "media specialist"] },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export const OTHER_CATEGORY = { slug: "other", name: "Other School Jobs" } as const;

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? OTHER_CATEGORY.name;
}

// Pricing concept carried over from the Ohio hub (free tier + paid tiers), plus an agency tier,
// since staffing agencies and contractors are the most likely paying customers.
export const PLANS = [
  { id: "free", name: "Free", price: "$0", cadence: "forever", features: ["Your district's jobs listed automatically", "5 direct job posts", "Company profile reused on every post", "Listings live for 60 days"] },
  { id: "featured", name: "Featured Post", price: "$59", cadence: "per post", features: ["Pinned to the top of search for 30 days", "Highlighted in the weekly newsletter", "Featured badge"] },
  { id: "district", name: "District Pro", price: "$99", cadence: "per month", features: ["Unlimited direct posts", "3 featured posts per month", "Applicant inbox", "Priority support"] },
  { id: "agency", name: "Agency", price: "$249", cadence: "per month", features: ["For staffing agencies & contractors", "Unlimited posts across all 83 counties", "Agency badge & profile page", "Searchable candidate resumes"] },
] as const;

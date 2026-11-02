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
export const CATEGORIES: readonly { slug: string; name: string; keywords: readonly string[]; exclude?: readonly string[] }[] = [
  { slug: "special-education", name: "Special Education", keywords: ["special ed", "sped", "resource room", "autism", "asd", "cognitively", "emotionally impaired", "learning disab", "inclusion", "iep", "deaf", "dhh", "visually impaired", "intervener"] },
  { slug: "therapies", name: "Therapies & Related Services", keywords: ["speech", "slp", "occupational therap", "physical therap", "psycholog", "social worker", "counselor", "nurse", "audiolog", "behavior analyst", "bcba", "behavior specialist", "behavior support specialist", "behavior technician", "interpreter"] },
  { slug: "early-childhood", name: "Early Childhood & Child Care", keywords: ["preschool", "pre-k", "prek", "gsrp", "head start", "early childhood", "child care", "childcare", "latchkey", "aftercare", "before and after school", "kids club", "prime time care", "caregiver", "daycare"] },
  { slug: "technology", name: "Technology & IT", keywords: ["technology", "network", "programmer", "help desk", "technical assistant", "technical support", "av specialist", "media technician", "data analyst", "web developer", "software"], exclude: ["teacher", "instructor", "paraprofessional"] },
  { slug: "administrative", name: "Administration & Office", keywords: ["principal", "superintendent", "director", "coordinator", "supervisor", "manager", "chief", "dean", "secretary", "clerk", "administrative", "payroll", "accountant", "bookkeeper", "human resources", "receptionist", "registrar", "analyst"] },
  { slug: "transportation", name: "Transportation", keywords: ["bus driver", "bus aide", "transportation", "mechanic", "driver"] },
  { slug: "maintenance", name: "Maintenance & Custodial", keywords: ["custodian", "custodial", "maintenance", "groundskeeper", "grounds", "facilities", "hvac", "electrician", "plumber", "building helper"] },
  { slug: "safety-security", name: "Security & Safety", keywords: ["security", "hall monitor", "crossing guard", "safety", "resource officer"] },
  { slug: "food-service", name: "Food Service", keywords: ["food service", "cook", "cafeteria", "nutrition", "lunch", "kitchen", "cashier", "culinary"] },
  { slug: "paraprofessional", name: "Paraprofessionals & Aides", keywords: ["paraprofessional", "parapro", "para ", "aide", "instructional assistant", "teacher assistant", "interventionist", "tutor", "noon"] },
  { slug: "coaching", name: "Coaching, Clubs & Activities", keywords: ["coach", "athletic", "club sponsor", "sponsor", "advisor", "referee", "lifeguard", "life guard"], exclude: ["instructional coach", "literacy coach", "math coach", "academic coach", "reading coach"] },
  { slug: "teaching", name: "Teaching", keywords: ["teacher", "instructor", "educator", "kindergarten", "grade", "math", "science", "english", "ela", "social studies", "music", "art ", "spanish", "librarian", "media specialist", "instructional coach", "literacy coach", "math coach", "academic coach", "reading coach", "literacy", "language arts", "teaching"] },
] as const;

export const OTHER_CATEGORY = { slug: "other", name: "Other School Jobs" } as const;

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? OTHER_CATEGORY.name;
}

// Pricing concept carried over from the Ohio hub (free tier + paid tiers), plus an agency tier,
// since staffing agencies and contractors are the most likely paying customers.
// Features prefixed with "soon:" are not built yet and render as "coming soon".
export const PLANS = [
  { id: "free", name: "Free", price: "$0", cadence: "forever", features: ["Your district's public jobs listed automatically", "Listings link to your own application page", "Stay up while the job is open"] },
  { id: "posting", name: "Posting Plan", price: "$49", cadence: "per month", popular: true, features: ["Post your own jobs directly, any time", "Reviewed and live within 1 business day", "Organization details remembered for every post", "Cancel anytime"] },
  { id: "featured", name: "Featured Post", price: "$59", cadence: "per post", features: ["Pinned to the top of search for 30 days", "Featured badge and highlighted card", "Shown in Featured Jobs on the home page", "soon:Highlighted in the weekly newsletter"] },
  { id: "district", name: "District Pro", price: "$99", cadence: "per month", features: ["3 featured posts every month", "Priority support", "soon:Employer dashboard & applicant inbox"] },
  { id: "agency", name: "Agency", price: "$249", cadence: "per month", features: ["For staffing agencies & contractors", "Posts in every county we cover", "5 featured posts every month", "soon:Agency profile page", "soon:Searchable candidate resumes"] },
] as const;

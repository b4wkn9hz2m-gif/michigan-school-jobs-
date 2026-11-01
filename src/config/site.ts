// Single place to rebrand or clone the site for another state.
export const SITE = {
  name: "Michigan School Jobs",
  shortName: "MI School Jobs",
  state: "Michigan",
  stateCode: "MI",
  tagline: "Every Michigan school job, in one place.",
  description:
    "Search teaching, special education, therapy, support staff and administrative jobs at Michigan school districts and charter schools — updated daily.",
  domain: "michigan-school-jobs.com",
  // Forwarded to the owner's inbox via Cloudflare Email Routing.
  contactEmail: "hello@michigan-school-jobs.com",
  // Paste Stripe Payment Link URLs here (https://buy.stripe.com/...). Empty = button emails you instead.
  paymentLinks: {
    featured: "",
    district: "",
    agency: "",
  } as Record<string, string>,
};

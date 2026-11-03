// Single place to rebrand or clone the site for another state.
export const SITE = {
  name: "Michigan School Jobs",
  shortName: "MI School Jobs",
  state: "Michigan",
  stateCode: "MI",
  tagline: "Every Michigan school job, in one place.",
  description:
    "Search teaching, special education, therapy, support staff and administrative jobs at Michigan school districts and charter schools — updated daily.",
  domain: "www.michigan-school-jobs.com",
  // Forwarded to the owner's inbox via Cloudflare Email Routing.
  contactEmail: "hello@michigan-school-jobs.com",
  // Paste Stripe Payment Link URLs here (https://buy.stripe.com/...). Empty = button emails you instead.
  paymentLinks: {
    featured: "https://buy.stripe.com/6oUfZibYL1wi0Mj978gA800",
    district: "https://buy.stripe.com/aFa3cwaUH8YKcv13MOgA801",
    posting: "https://buy.stripe.com/bJe4gAd2P1widz5ersgA803",
    urgent: "https://buy.stripe.com/6oUfZi3sf6QCfHd0ACgA804",
    agency: "https://buy.stripe.com/5kQbJ20g33EqgLh5UWgA802",
  } as Record<string, string>,
};

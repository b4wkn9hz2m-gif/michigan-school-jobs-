// Frontline AppliTrack job boards (used by many Michigan districts and county consortia).
// Format verified against live pages (Nov 2026): each posting is a
//   <ul class='postingsList' id='p{JobID}_{n}'> block with a title cell, labeled fields
//   (Position Type, Date Posted, Location, District, Date Available, Description) and a
//   "Print Version" link to the single-posting page.
// robots.txt for applitrack.com only disallows /*/onlineapp/admin.
import { stripHtml, type RawPosting, type Source } from "../pipeline.ts";

const UA = "MichiganSchoolJobsBot/1.0 (+job listings aggregator; links back to the original posting)";

export function listUrl(slug: string): string {
  return `https://www.applitrack.com/${slug}/onlineapp/jobpostings/view.asp?all=1&embed=1`;
}

function field(block: string, label: string): string {
  const re = new RegExp(`<span class=["']label["'] ?>${label}:</span>([\\s\\S]*?)(?:</li>|<li>|<div)`, "i");
  const m = block.match(re);
  return m ? stripHtml(m[1]) : "";
}

function usDate(s: string): string | undefined {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return undefined;
  // Noon Eastern avoids the date shifting a day when converted to UTC.
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}T12:00:00-05:00`;
}

export function parseAppliTrack(html: string, source: Source): RawPosting[] {
  const slug = source.url.match(/applitrack\.com\/([^/]+)\//i)?.[1] ?? "";
  const blocks = html.split(/<ul class=['"]postingsList['"]/i).slice(1);
  const out: RawPosting[] = [];
  for (const raw of blocks) {
    const block = raw.split(/<ul class=['"]postingsList['"]/i)[0];
    const title = stripHtml(block.match(/id=['"]wrapword['"][^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "");
    const postingId = block.match(/^\s*id=['"]p([\w]+)['"]/)?.[1];
    if (!title || !postingId) continue;

    const districtHtml = block.match(/District:<\/span>[\s\S]*?<span class=['"]normal['"]>([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const district = stripHtml(districtHtml);
    const location = field(block, "Location");
    // "Administration/Business Manager" -> "Administration / Business Manager"
    const positionType = field(block, "Position Type").replace(/\s*\/\s*/g, " / ").replace(/ \/$/, "").trim();
    const available = field(block, "Date Available");
    // Full posting text lives in a hidden "Additional Information" block on many boards.
    const extra = block.match(/id=['"]DescriptionText[\w]*['"][^>]*>([\s\S]*?)<\/span>\s*(?:<br\s*\/?>\s*)*(?:<div|<\/div|<span>|$)/i)?.[1];
    const description = [field(block, "Description"), extra ? stripHtml(extra) : ""].filter(Boolean).join(" ");

    // Consortium boards also list jobs that live on a member district's own AppliTrack site
    // (Apply button calls applyForOutsideDistrict('<districtSlug>','<jobId>',...)). Those postings
    // only open on the district's site, so link there.
    const outside = block.match(/applyForOutsideDistrict\(\s*'([\w-]+)'\s*,\s*'(\d+)'/);
    const print = block.match(/href=['"](https:\/\/www\.applitrack\.com\/[^'"]+AppliTrackViewPosting=1)['"]/i)?.[1];
    const applyUrl = outside
      ? `https://www.applitrack.com/${outside[1]}/onlineapp/JobPostings/view.asp?AppliTrackJobId=${outside[2]}&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1`
      : (print ?? `https://www.applitrack.com/${slug}/onlineapp/JobPostings/view.asp?AppliTrackJobId=${postingId}&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1`).replace(/&amp;/g, "&");

    const summary = [
      positionType && `Position type: ${positionType}.`,
      location && location !== district && `Location: ${location}.`,
      available && `Date available: ${available}.`,
      description,
    ].filter(Boolean).join(" ");

    out.push({
      title,
      employer: district || source.employer,
      applyUrl,
      description: summary,
      postedAt: usDate(field(block, "Date Posted")),
    });
  }
  return out;
}

export async function fetchAppliTrack(source: Source): Promise<RawPosting[]> {
  const res = await fetch(source.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const postings = parseAppliTrack(html, source);
  // A page with jobs markup but nothing parsed means the format changed: fail loudly so the
  // source's old listings are kept (grace period) instead of being wiped.
  if (postings.length === 0 && /postingsList/i.test(html)) throw new Error("AppliTrack format changed: postings found but none parsed");
  return postings;
}

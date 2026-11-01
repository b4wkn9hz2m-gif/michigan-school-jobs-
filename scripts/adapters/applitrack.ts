// Frontline AppliTrack is used by many Michigan districts.
// NOT IMPLEMENTED YET: this session's network policy blocks applitrack.com, so the page format
// could not be inspected. Writing a parser blind would produce silently wrong data, so this throws
// and the collector reports the source as failed until the adapter is written against real pages.
import type { RawPosting, Source } from "../pipeline.ts";

export async function fetchAppliTrack(_source: Source): Promise<RawPosting[]> {
  throw new Error("AppliTrack adapter not implemented yet (needs access to applitrack.com to verify the format)");
}

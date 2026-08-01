/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Email open & click tracking.
 * Uses a 1x1 transparent pixel for opens and redirect URLs for clicks.
 * Tracks per-campaign, per-contact in memory (production should use Redis/DB).
 */

const openTracked = new Map<string, Set<string>>(); // campaignId -> Set<contactId>
const clickTracked = new Map<string, Map<string, number>>(); // campaignId -> Map<contactId, clicks>

const TRACKING_BASE_URL = process.env.API_URL || 'http://localhost:8080';

/**
 * Inject a tracking pixel into the HTML body.
 * The pixel fires a GET to the open-tracking endpoint when the email is viewed.
 */
export function injectTrackingPixel(html: string, campaignId: string, contactId: string): string {
  const pixelUrl = `${TRACKING_BASE_URL}/api/emails/track/open/${encodeURIComponent(campaignId)}/${encodeURIComponent(contactId)}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" aria-hidden="true" />`;
  // Insert before closing </body> or append to end
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Rewrite <a href> links in the HTML to route through click-tracking.
 * Preserves the original URL as a query parameter.
 */
export function injectClickTracking(html: string, campaignId: string, contactId: string): string {
  return html.replace(/<a\s+[^>]*href="([^"]*)"([^>]*)>/gi, (_match, url, rest) => {
    // Skip anchor links, mailto, and tracking pixel
    if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.includes('/api/emails/track/')) {
      return _match;
    }
    const trackUrl = `${TRACKING_BASE_URL}/api/emails/track/click/${encodeURIComponent(campaignId)}/${encodeURIComponent(contactId)}?url=${encodeURIComponent(url)}`;
    return `<a href="${trackUrl}"${rest}>`;
  });
}

export function recordOpen(campaignId: string, contactId: string): void {
  if (!openTracked.has(campaignId)) openTracked.set(campaignId, new Set());
  openTracked.get(campaignId)!.add(contactId);
}

export function recordClick(campaignId: string, contactId: string): void {
  if (!clickTracked.has(campaignId)) clickTracked.set(campaignId, new Map());
  const campaign = clickTracked.get(campaignId)!;
  campaign.set(contactId, (campaign.get(contactId) || 0) + 1);
}

export function getCampaignMetrics(campaignId: string) {
  const opens = openTracked.get(campaignId);
  const clicks = clickTracked.get(campaignId);
  return {
    unique_opens: opens ? opens.size : 0,
    unique_clicks: clicks ? clicks.size : 0,
    total_clicks: clicks ? Array.from(clicks.values()).reduce((a, b) => a + b, 0) : 0,
    opened_contact_ids: opens ? Array.from(opens) : [],
    clicked_contact_ids: clicks ? Array.from(clicks.keys()) : [],
  };
}

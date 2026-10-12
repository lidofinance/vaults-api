import { Event } from '@sentry/node';
import { satanizer } from '@lidofinance/satanizer';

// Sentry events leave the process without touching the logger, so nothing in them is masked
// by default. That matters because the values we hide from logs show up in events routinely:
//   - viem/ethers error messages embed the RPC url (`HTTP request failed. URL: <url>`), and
//     both EL and CL urls carry the api key in the path;
//   - the default Http integration records every outgoing node:http request as a breadcrumb
//     with the full url, and breadcrumbs are attached to every later event.
// So run the event through the same `secrets` list the logger transport uses.
//
// Only literal secrets are masked, no `commonPatterns`: unlike the startup env dump, events
// need vault addresses and ips to stay readable to be of any use for debugging.
export const createSentryEventMasker = (secrets: string[]) => {
  const mask = satanizer(secrets);

  return (event: Event): Event | null => {
    try {
      // `beforeSend` receives an already normalized event (see `prepareEvent` in @sentry/core),
      // i.e. a plain serializable structure, so a deep traversal is safe here.
      return mask(event);
    } catch {
      // Fail closed: an event we failed to mask is dropped rather than sent unmasked.
      return null;
    }
  };
};

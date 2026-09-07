import { Event } from '@sentry/node';

import { createSentryEventMasker } from './mask-sentry-event';

// ---------------------------------------------------------------------------
// createSentryEventMasker
//
// Sentry events bypass the logger, so this masker is the only thing standing between
// api keys embedded in urls and an external service.
// ---------------------------------------------------------------------------

// Placeholder value. Deliberately not held in a credential-looking constant
// (an `API_KEY`/`SECRET` name) — secret scanners flag that shape even in fixtures.
const urlTail = 'rpc-url-tail-to-mask';
const RPC_URL = `https://el.example.com/v1/${urlTail}`;

describe('createSentryEventMasker', () => {
  const maskEvent = createSentryEventMasker([urlTail]);

  it('masks the api key in an exception message', () => {
    const event = {
      exception: { values: [{ type: 'HttpRequestError', value: `HTTP request failed.\n\nURL: ${RPC_URL}` }] },
    } as Event;

    const masked = maskEvent(event);

    expect(masked?.exception?.values?.[0].value).not.toContain(urlTail);
    expect(masked?.exception?.values?.[0].type).toBe('HttpRequestError');
  });

  it('masks the api key in http breadcrumb urls', () => {
    const event = {
      breadcrumbs: [{ category: 'http', data: { method: 'POST', url: RPC_URL, status_code: 500 } }],
    } as Event;

    const masked = maskEvent(event);

    expect(masked?.breadcrumbs?.[0].data?.url).not.toContain(urlTail);
    expect(masked?.breadcrumbs?.[0].data?.status_code).toBe(500);
  });

  it('masks nested values, wherever they sit in the event', () => {
    const event = { extra: { attempts: [{ url: RPC_URL }] } } as unknown as Event;

    expect(JSON.stringify(maskEvent(event))).not.toContain(urlTail);
  });

  it('does not mutate the event it was given', () => {
    const event = { exception: { values: [{ value: RPC_URL }] } } as Event;

    maskEvent(event);

    expect(event.exception?.values?.[0].value).toBe(RPC_URL);
  });

  it('keeps addresses and ips readable — only literal secrets are masked', () => {
    const vault = '0x' + '1'.repeat(40);
    const event = { exception: { values: [{ value: `vault ${vault} at 10.1.2.3 failed` }] } } as Event;

    expect(maskEvent(event)?.exception?.values?.[0].value).toBe(`vault ${vault} at 10.1.2.3 failed`);
  });

  it('drops the event instead of sending it unmasked when masking fails', () => {
    const throwing = {
      get exception(): never {
        throw new Error('unserializable');
      },
    } as unknown as Event;

    expect(maskEvent(throwing)).toBeNull();
  });
});

import { lookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { WritingFeedbackError } from '../../domain/writing-feedback/WritingFeedbackError.js';

export function isPrivateOllamaAddress(address) {
  if (address === '::1') return true;
  if (isIP(address) !== 4) return false;
  const [first, second] = address.split('.').map(Number);
  return first === 127 || first === 10 || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

export function privateOllamaUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new WritingFeedbackError('WRITING_FEEDBACK_CONFIGURATION'); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
      || url.pathname !== '/' || !(isPrivateOllamaAddress(hostname) || ['localhost', 'ollama'].includes(hostname))) {
    throw new WritingFeedbackError('WRITING_FEEDBACK_CONFIGURATION');
  }
  return url;
}

function privateLookup(hostname, options, callback) {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error || !addresses?.length || addresses.some(item => !isPrivateOllamaAddress(item.address))) {
      callback(new WritingFeedbackError('WRITING_FEEDBACK_PROVIDER_UNAVAILABLE')); return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

/** A no-redirect transport which validates the addresses used by the socket. */
export function privateOllamaFetch(url, { method = 'GET', body, headers, signal } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      method, headers, signal, lookup: privateLookup, agent: false,
    }, response => {
      try {
        const safeHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (value !== undefined) safeHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        const noBody = [204, 205, 304].includes(response.statusCode);
        if (noBody) response.resume();
        resolve(new Response(noBody ? null : Readable.toWeb(response), { status: response.statusCode, headers: safeHeaders }));
      } catch (error) {
        response.destroy(); reject(error);
      }
    });
    request.once('error', reject);
    request.end(body);
  });
}

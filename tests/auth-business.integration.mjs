import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sqliteD1 } from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output', { recursive: true });
const database = sqliteD1();
const fixture = globalThis.__authBusinessTest = { env: { DB: database.db }, context: new AsyncLocalStorage() };
await build({
  stdin: { contents: `export {POST as authPost,GET as authGet} from './app/api/auth/route';
    export {POST as clubPost,GET as clubGet} from './app/api/club/route';
    export {load,save} from './lib/store';export {emptyState} from './lib/domain/types';
    export {makePassword,checkPassword} from './lib/password';export {hashToken} from './lib/auth';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: '.test-output/auth-business.mjs',
  plugins: [{ name: 'isolated-auth-environment', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'auth-business' }));
    builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'cookies', namespace: 'auth-business' }));
    builder.onResolve({ filter: /(?:^|\/)chatgpt-auth$/ }, () => ({ path: 'chatgpt', namespace: 'auth-business' }));
    builder.onLoad({ filter: /.*/, namespace: 'auth-business' }, ({ path }) => ({ loader: 'js', contents:
      path === 'env' ? 'export const env=globalThis.__authBusinessTest.env;' :
      path === 'cookies' ? 'export async function cookies(){const header=globalThis.__authBusinessTest.context.getStore()??"";const snapshot=new Map(header.split(";").filter(Boolean).map(pair=>{const i=pair.indexOf("=");return [pair.slice(0,i).trim(),pair.slice(i+1)]}));return {get:key=>snapshot.has(key)?{value:snapshot.get(key)}:undefined}}' :
      'export const getChatGPTUser=async()=>null;' }));
  } }],
});
const api = await import(pathToFileURL(resolve('.test-output/auth-business.mjs')).href);
const origin = 'https://club.example';
const credentials = { owner: 'fixture-owner-password-123', a: 'fixture-member-a-password-123', b: 'fixture-member-b-password-123' };
function request(route, body, cookie = '', requestOrigin = origin) {
  return new Request(origin + route, { method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json', cookie, 'cf-connecting-ip': '203.0.113.42' }, body: JSON.stringify(body) });
}
const auth = (body, cookie = '', requestOrigin) => fixture.context.run(cookie, () => api.authPost(request('/api/auth', body, cookie, requestOrigin)));
const command = (action, payload, cookie = '', revision, requestId = crypto.randomUUID()) => fixture.context.run(cookie, () => api.clubPost(request('/api/club', { action, payload, revision, requestId }, cookie)));
const count = table => Number(database.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
async function login(id) {
  const response = await auth({ action: 'login', username: id, password: credentials[id] });
  assert.equal(response.status, 200, await response.clone().text());
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('yulin_session='));
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Secure/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return cookie.split(';')[0];
}
try {
  const state = api.emptyState();
  const previous = structuredClone(state);
  state.settings = { ...state.settings, initialized: true, ownerAccountId: 'owner', progressionVersion: 'weekly-v2', realmVersion: 'elo-v1', rankingVersion: 'signed-v1', scoringPolicy: 'all-ranked-v1' };
  for (const id of ['owner', 'a', 'b']) {
    state.accounts.push({ id, email: '', playerId: `player-${id}`, role: id === 'owner' ? 'admin' : 'member' });
    state.players.push({ id: `player-${id}`, ownerId: id, name: id, initialRating: 1000, rating: 1000, ratedGames: 0, enabled: true, ratingReason: '' });
  }
  const extra = Object.entries(credentials).map(([id, password]) => {
    const credential = api.makePassword(password);
    return database.db.prepare('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)').bind(id, id, credential.salt, credential.hash, Date.now());
  });
  await api.save(state, 'fixture-seed', previous, extra);

  for (const input of [null, [], 'invalid', { action: 'unknown' }]) assert.equal((await auth(input)).status, 400);
  assert.equal((await auth({ action: 'login', username: 'a', password: credentials.a }, '', 'https://attacker.example')).status, 403);
  assert.equal((await auth({ action: 'login', username: 'a', password: 'incorrect' })).status, 401);
  assert.equal(count('auth_sessions'), 0);
  const ownerCookie = await login('owner'), aCookie = await login('a'), bCookie = await login('b');
  const authResponse = await fixture.context.run(aCookie, () => api.authGet());
  assert.equal(authResponse.status, 200);
  const signedIn = await authResponse.json(); assert.equal(signedIn.signedIn, true); assert.equal(signedIn.username, 'a');
  assert.equal((await auth({ action: 'createAccount', username: 'intruder', password: credentials.a, name: 'intruder', requestId: crypto.randomUUID() }, aCookie)).status, 403);
  const start = Date.now() + 3_600_000, end = start + 3_600_000;
  let snapshot = await api.load();
  assert.equal((await command('event', { title: 'Fictional concurrency test', start, end, venue: 'fixture', address: '', capacity: 1, cancelDeadline: start, note: '', status: 'open', bookings: [{ name: 'one', start, end, pricing: 'total', cents: 1200 }] }, ownerCookie, snapshot.revision)).status, 200);
  snapshot = await api.load(); const event = snapshot.events[0];
  const payload = playerId => ({ eventId: event.id, playerId, arrival: start, departure: end, note: '' });
  const race = await Promise.all([command('register', payload('player-a'), aCookie), command('register', payload('player-b'), bCookie)]);
  assert.deepEqual(race.map(response => response.status), [200, 200]);
  snapshot = await api.load();
  assert.equal(snapshot.registrations.filter(row => row.status === 'confirmed').length, 1);
  assert.equal(snapshot.registrations.filter(row => row.status === 'waitlist').length, 1);
  const confirmed = snapshot.registrations.find(row => row.status === 'confirmed');
  const key = crypto.randomUUID(), cancellingCookie = confirmed.playerId === 'player-a' ? aCookie : bCookie;
  assert.equal((await command('cancel', { eventId: event.id, playerId: confirmed.playerId, reason: 'fixture' }, cancellingCookie, undefined, key)).status, 200);
  const revision = (await api.load()).revision;
  assert.equal((await command('cancel', { eventId: event.id, playerId: confirmed.playerId, reason: 'duplicate' }, cancellingCookie, undefined, key)).status, 200);
  assert.equal((await api.load()).revision, revision);
  assert.equal((await api.load()).registrations.filter(row => row.status === 'confirmed').length, 1);
  assert.equal((await command('register', payload('player-owner'), aCookie)).status, 403);
  assert.equal((await command('eventStatus', { eventId: event.id, status: 'ended' }, ownerCookie, 0)).status, 409);

  database.injectFailure(query => query.startsWith('INSERT INTO audits'));
  const beforeFailure = await api.load();
  assert.equal((await command('eventStatus', { eventId: event.id, status: 'locked' }, ownerCookie, beforeFailure.revision)).status, 503);
  database.injectFailure(null);
  assert.deepEqual(await api.load(), beforeFailure);

  const originalPlayer = database.sql.prepare('SELECT payload FROM players WHERE id=?').get('player-a').payload;
  database.sql.prepare('UPDATE players SET payload=? WHERE id=?').run('{"secret":"private-corrupt-json"', 'player-a');
  const corruptResponse = await fixture.context.run(ownerCookie, () => api.clubGet(new Request(origin + '/api/club')));
  assert.equal(corruptResponse.status, 503);
  assert.ok(corruptResponse.headers.get('X-Request-ID'));
  assert.ok(!(await corruptResponse.text()).includes('private-corrupt-json'));
  database.sql.prepare('UPDATE players SET payload=? WHERE id=?').run(originalPlayer, 'player-a');

  const oldSessionHash = await api.hashToken(aCookie.split('=')[1]);
  assert.equal((await auth({ action: 'resetPassword', accountId: 'a', password: 'fixture-replacement-password-123', requestId: crypto.randomUUID() }, ownerCookie)).status, 200);
  assert.equal(database.sql.prepare('SELECT id FROM auth_sessions WHERE id=?').get(oldSessionHash), undefined);
  assert.equal((await command('register', payload('player-a'), aCookie)).status, 401);
  credentials.a = 'fixture-replacement-password-123';
  const renewedCookie = await login('a');
  assert.equal((await auth({ action: 'logout' }, renewedCookie)).status, 200);
  assert.equal((await command('register', payload('player-a'), renewedCookie)).status, 401);
  const wrongPasswords = [];
  for (let attempt = 0; attempt < 9; attempt++) wrongPasswords.push((await auth({ action: 'login', username: 'b', password: 'incorrect' })).status);
  assert.deepEqual(wrongPasswords.slice(0, 8), Array(8).fill(401)); assert.equal(wrongPasswords[8], 429);
  console.log('PASS auth/business: input validation, CSRF, real passwords/cookies, member permissions, last-place concurrency, idempotence/promotion, stale revision, atomic rollback, reset revocation, logout and login throttling');
} finally {
  database.close(); delete globalThis.__authBusinessTest;
}

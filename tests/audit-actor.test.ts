import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditActorName } from '../lib/client/audit-actor';

test('the audit log names who acted: the player, the login name, the club itself or a removed account', () => {
  const data = {
    accounts: [{ id: 'a1', playerId: 'p1', email: 'host' }, { id: 'a2', playerId: 'gone', email: 'nameless' }, { id: 'a3', playerId: 'gone' }],
    players: [{ id: 'p1', name: 'Fictional organiser' }],
  };
  assert.equal(auditActorName('a1', data), 'Fictional organiser');
  assert.equal(auditActorName('a2', data), 'nameless', 'a missing profile falls back to the login name');
  assert.equal(auditActorName('a3', data), '未命名账号');
  assert.equal(auditActorName('system:points-clock', data), '系统自动');
  assert.equal(auditActorName('system', data), '系统自动');
  assert.equal(auditActorName('removed-account', data), '已删除的账号');
});

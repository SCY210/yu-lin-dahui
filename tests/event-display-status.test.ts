import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventDisplayStatus,eventDisplayLabels} from '../lib/client/event-display-status';
import type {Event} from '../lib/domain/types';

const hour=3600000,start=Date.parse('2027-10-12T13:00:00Z'),end=start+4*hour;
const e=(extra:Partial<Event>={}):Pick<Event,'status'|'start'|'end'|'signupDeadline'|'deletedAt'>=>({status:'open',start,end,signupDeadline:start-2*hour,...extra});

test('a stored open activity says closed once the two-hour sign-up deadline has passed',()=>{
 assert.equal(eventDisplayStatus(e(),start-3*hour),'open');
 assert.equal(eventDisplayStatus(e(),start-2*hour),'closed','the screenshot case: 13:17 for a 15:00 start');
 assert.equal(eventDisplayStatus(e({signupDeadline:end}),start-hour),'closed','older activities stored their end time');
});

test('every state has its own label: full, locked, live, ended, cancelled and draft',()=>{
 assert.equal(eventDisplayStatus(e(),start-3*hour,{occupied:14,capacity:14}),'full');
 assert.equal(eventDisplayStatus(e(),start-hour,{occupied:14,capacity:14}),'closed','closed wins over full');
 assert.equal(eventDisplayStatus(e({status:'locked'}),start-3*hour),'locked');
 assert.equal(eventDisplayStatus(e(),start+hour),'live');
 assert.equal(eventDisplayStatus(e({status:'live'}),start-hour),'live','an organiser can start early');
 assert.equal(eventDisplayStatus(e(),end),'ended');
 assert.equal(eventDisplayStatus(e({status:'ended'}),start+hour),'ended','an organiser can end early');
 assert.equal(eventDisplayStatus(e({status:'cancelled'}),start-3*hour),'cancelled');
 assert.equal(eventDisplayStatus(e({status:'draft'}),start-3*hour),'draft');
 assert.equal(new Set(Object.values(eventDisplayLabels)).size,8);
});

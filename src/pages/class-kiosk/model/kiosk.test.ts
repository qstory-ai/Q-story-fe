/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClassStudentResponse } from '@/entities/auth';
import type { StoryCatalogEntry } from '@/entities/story';

import { duplicateNames, kioskDoneView, pickKioskStory, sortKioskStudents } from './kiosk';

function story(slug: string, requiresEntitlement: boolean): StoryCatalogEntry {
  return {
    storyId: slug,
    slug,
    title: slug,
    availability: 'AVAILABLE',
    contentVersion: '1',
    castVersion: '1',
    coverImageUrl: null,
    description: null,
    category: null,
    requiresEntitlement,
  };
}

function student(name: string, extra: Partial<ClassStudentResponse> = {}): ClassStudentResponse {
  return {
    id: name,
    name,
    ageBand: '나이 미입력',
    status: 'PENDING_PARENT',
    parentDisplayName: null,
    parentEmail: null,
    createdAt: '2026-11-27T00:00:00Z',
    ...extra,
  };
}

test('체험 모드 이야기는 무료 이야기 중 헨젤과 그레텔을 먼저', () => {
  assert.equal(pickKioskStory([story('paid', true), story('other', false), story('hansel-gretel', false)])?.slug, 'hansel-gretel');
  assert.equal(pickKioskStory([story('paid', true), story('other', false)])?.slug, 'other');
  assert.equal(pickKioskStory([]), null);
});

test('이름은 가나다순, 떠난 학생은 빼고 같은 이름은 구분', () => {
  const list = sortKioskStudents([student('하늘'), student('가온'), student('나래', { endedAt: '2026-11-01T00:00:00Z' })]);
  assert.deepEqual(list.map((s) => s.name), ['가온', '하늘']);
  assert.deepEqual([...duplicateNames([student('민서'), student('민서'), student('가온')])], ['민서']);
});

test('다 읽은 뒤 화면 - 보호자 있으면 보냈다, 현장 학생이면 QR, 아니면 선생님께', () => {
  assert.deepEqual(kioskDoneView(student('a', { status: 'CONFIRMED', parentDisplayName: '엄마' }), 'https://x/join?code=AB'), {
    kind: 'linked',
    parentName: '엄마',
  });
  assert.deepEqual(kioskDoneView(student('a', { parentClaimCode: 'K7QX2M' }), 'https://x/join?code=AB'), {
    kind: 'claim',
    link: 'https://x/join?code=AB&claim=K7QX2M',
  });
  assert.deepEqual(kioskDoneView(student('a', { parentClaimCode: 'K7QX2M' }), null), { kind: 'teacher' });
  assert.deepEqual(kioskDoneView(student('a'), 'https://x/join?code=AB'), { kind: 'teacher' });
});

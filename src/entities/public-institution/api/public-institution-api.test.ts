/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createJoinRequest,
  institutionSearchQuery,
  isSearchableInstitutionQuery,
  searchPublicInstitutions,
} from './public-institution-api';

test('검색어는 공백을 뺀 두 글자부터 부른다(서버와 같은 규칙)', () => {
  assert.equal(isSearchableInstitutionQuery(''), false);
  assert.equal(isSearchableInstitutionQuery(' 가 '), false);
  assert.equal(isSearchableInstitutionQuery('가 온'), true);
  assert.equal(isSearchableInstitutionQuery('가온'), true);
});

test('검색 쿼리 문자열 - 종류는 고른 때만, 한글은 인코딩', () => {
  assert.equal(institutionSearchQuery(' 강릉 가온 '), `?q=${encodeURIComponent('강릉 가온').replace(/%20/g, '+')}`);
  assert.equal(institutionSearchQuery('가온', 'DAYCARE', 10), '?q=%EA%B0%80%EC%98%A8&kind=DAYCARE&limit=10');
});

test('로그인 전 검색은 토큰 없이, 소속 신청은 토큰과 기관 id를 보낸다', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ items: [], hasMore: false, attribution: 'x' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  await searchPublicInstitutions(null, '가온', null, { baseUrl: 'https://api.test', fetchImpl });
  assert.equal(calls[0].url, 'https://api.test/v1/public-institutions?q=%EA%B0%80%EC%98%A8&limit=10');
  assert.equal(new Headers(calls[0].init.headers).get('Authorization'), null);

  await createJoinRequest('tok', 'org-1', { baseUrl: 'https://api.test', fetchImpl });
  assert.equal(calls[1].url, 'https://api.test/v1/organization-join-requests');
  assert.equal(calls[1].init.method, 'POST');
  assert.equal(new Headers(calls[1].init.headers).get('Authorization'), 'Bearer tok');
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { organizationId: 'org-1' });
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BLOCKED_CSS_URL,
  defaultReplayUrlPolicy,
  isAllowedReplayUrl,
  sanitizeReplayCss,
  sanitizeReplayEvents,
} from './replay-sanitize';

const policy = defaultReplayUrlPolicy('https://demo.qstory.ai.kr');
const asset = 'https://kbghxgejrkebdhjwizbr.supabase.co/storage/v1/object/public/qstory-story-images/a.webp';

test('주소: 허용 출처·상대·data/blob만 남기고 나머지는 막는다', () => {
  for (const allowed of [
    asset,
    'https://demo.qstory.ai.kr/assets/x.js',
    'https://play.qstory.ai.kr/a.png',
    '/assets/a.png',
    'data:image/png;base64,AAAA',
    'blob:https://demo.qstory.ai.kr/1',
    '#top',
  ]) {
    assert.equal(isAllowedReplayUrl(allowed, policy), true, allowed);
  }
  for (const blocked of [
    'https://evil.example/beacon.gif',
    'http://demo.qstory.ai.kr/a.png',
    'https://qstory.ai.kr.evil.example/a',
    '//evil.example/a',
    '\\\\evil.example/a',
    ' \n https://evil.example/a',
    'java\tscript:alert(1)',
    'ftp://evil.example/a',
  ]) {
    assert.equal(isAllowedReplayUrl(blocked, policy), false, blocked);
  }
});

test('CSS: url()·@import·image-set의 바깥 주소를 막는다', () => {
  assert.equal(
    sanitizeReplayCss('a{background:url(https://evil.example/x.png)} b{background:url("/ok.png")}', policy),
    `a{background:url("${BLOCKED_CSS_URL}")} b{background:url("/ok.png")}`,
  );
  assert.equal(sanitizeReplayCss(`a{background:url('${asset}')}`, policy), `a{background:url('${asset}')}`);
  assert.equal(sanitizeReplayCss('@import "https://evil.example/a.css";', policy), '@blocked-import "https://evil.example/a.css";');
  assert.equal(
    sanitizeReplayCss('@import url(https://evil.example/a.css) screen; a{color:red}', policy),
    `@blocked-import url("${BLOCKED_CSS_URL}") screen; a{color:red}`,
  );
  assert.equal(sanitizeReplayCss('@import "/ok.css";', policy), '@import "/ok.css";');
  assert.equal(
    sanitizeReplayCss('a{background:url(\\68 ttps://evil.example/x)}', policy),
    `a{background:url("${BLOCKED_CSS_URL}")}`,
    'CSS 이스케이프로 감춘 주소',
  );
  assert.equal(
    sanitizeReplayCss('a{background:image-set("https://evil.example/1.png" 1x, "/ok.png" 2x)}', policy),
    `a{background:image-set("${BLOCKED_CSS_URL}" 1x, "/ok.png" 2x)}`,
  );
  assert.equal(sanitizeReplayCss('plain text', policy), 'plain text');
});

test('rrweb 이벤트: 스냅숏 요소 속성·스타일 텍스트·변경 이벤트를 모두 고친다', () => {
  const events = [
    { type: 4, timestamp: 1, data: { href: 'https://demo.qstory.ai.kr/play', width: 800, height: 600 } },
    {
      type: 2,
      timestamp: 2,
      data: {
        node: {
          type: 0,
          childNodes: [
            { type: 2, tagName: 'img', attributes: { src: 'https://evil.example/a.gif', alt: '그림' }, childNodes: [] },
            { type: 2, tagName: 'img', attributes: { src: asset, srcset: `https://evil.example/2x.png 2x, ${asset} 1x` }, childNodes: [] },
            { type: 2, tagName: 'link', attributes: { rel: 'stylesheet', href: 'https://evil.example/a.css' }, childNodes: [] },
            { type: 2, tagName: 'meta', attributes: { 'http-equiv': 'refresh', content: '0;url=https://evil.example' }, childNodes: [] },
            { type: 2, tagName: 'iframe', attributes: { srcdoc: '<img src=https://evil.example>' }, childNodes: [] },
            { type: 2, tagName: 'div', attributes: { style: 'background:url(https://evil.example/bg.png)' }, childNodes: [] },
            {
              type: 2,
              tagName: 'style',
              attributes: { _cssText: '.x{background:url(https://evil.example/c.png)}' },
              childNodes: [{ type: 3, textContent: '.y{background:url(//evil.example/d.png)}', isStyle: true }],
            },
          ],
        },
      },
    },
    {
      type: 3,
      timestamp: 3,
      data: {
        source: 0,
        adds: [{ parentId: 1, node: { type: 2, tagName: 'img', attributes: { src: 'https://evil.example/m.gif' }, childNodes: [] } }],
        attributes: [
          { id: 5, attributes: { src: 'https://evil.example/n.gif', style: { background: 'url(https://evil.example/s.png)' } } },
        ],
        texts: [{ id: 6, value: '.z{background:url(https://evil.example/t.png)}' }],
        removes: [],
      },
    },
    { type: 3, timestamp: 4, data: { source: 8, id: 7, adds: [{ rule: '.r{background:url(https://evil.example/r.png)}', index: 0 }] } },
    { type: 3, timestamp: 5, data: { source: 13, id: 7, set: { property: 'background', value: 'url(https://evil.example/v.png)' }, index: [0] } },
  ];
  const result = sanitizeReplayEvents(events, policy);
  const json = JSON.stringify(result);
  assert.ok(!json.includes('evil.example'), json);
  assert.ok(json.includes(asset), '허용 자산은 그대로');
  assert.ok(json.includes('"alt":"그림"'));
  assert.ok(json.includes('https://demo.qstory.ai.kr/play'), 'Meta href는 그대로');
  const snapshot = result[1] as unknown as { data: { node: { childNodes: { attributes: Record<string, string> }[] } } };
  assert.equal(snapshot.data.node.childNodes[1].attributes.srcset, `${asset} 1x`);
  assert.ok(!('srcdoc' in snapshot.data.node.childNodes[4].attributes));
  assert.ok(!('src' in snapshot.data.node.childNodes[0].attributes), '막힌 주소 속성은 뺀다');
  assert.ok(!('href' in snapshot.data.node.childNodes[2].attributes));
});

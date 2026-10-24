// @ts-nocheck -- Node 테스트 러너 타입은 Expo 번들에서 의도적으로 제외한다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { ILLUSTRATION_ASPECT, MAX_SIDE_CROP, illustrationFrame } from './illustration-frame';

test('wider screens fit the width and crop only the bottom', () => {
  // 휴대폰 가로 844x390 - 위는 붙이고 아래만 넘친다.
  const phone = illustrationFrame(844, 390);
  assert.equal(phone.left, 0);
  assert.equal(phone.top, 0);
  assert.equal(phone.width, 844);
  assert.ok(phone.height > 390);
  assert.equal(illustrationFrame(1920, 1080).height, 1080);
});

test('narrower screens crop at most MAX_SIDE_CROP per side and keep the top', () => {
  // 아이패드 가로 1024x768 - cover면 한쪽 12.5%가 잘린다.
  const ipad = illustrationFrame(1024, 768);
  const cropPerSide = -ipad.left / ipad.width;
  assert.ok(Math.abs(cropPerSide - MAX_SIDE_CROP) < 1e-9);
  assert.equal(ipad.top, 0);
  assert.ok(ipad.height < 768, 'the rest of the height shows the blurred backdrop');
  assert.ok(Math.abs(ipad.width / ipad.height - ILLUSTRATION_ASPECT) < 1e-9);
});

test('slightly narrow screens still fill the height (cover) when the side crop is small', () => {
  // 16:10 노트북 1440x900 - cover로 한쪽 약 5%만 잘린다.
  const laptop = illustrationFrame(1440, 900);
  assert.equal(laptop.height, 900);
  assert.ok(-laptop.left / laptop.width <= MAX_SIDE_CROP);
});

test('no frame before the screen is measured', () => {
  assert.equal(illustrationFrame(0, 0), null);
});

// 기기별 미리보기 공통 - 화면 비율, 그림 위를 덮는 화면 요소 자리, 플레이어와 같은 그림 자르기.
// device-preview.mjs(시트)와 script-device-review.mjs(대본과 함께 보는 HTML)가 같이 쓴다.
import sharp from 'sharp';

// 덮는 자리(데모에서 잰 값, 화면 높이 대비 %): 상단 버튼 줄, 내레이션 자막.
export const DEVICES = [
  { name: '휴대폰 가로 19.5:9', aspect: 19.5 / 9, top: 22, caption: [74, 95] },
  { name: '노트북 1.9:1', aspect: 1.9, top: 11, caption: [87, 98] },
  { name: '아이패드 가로 4:3', aspect: 4 / 3, top: 11, caption: [87, 98] },
];

// 플레이어와 같은 자리(src/pages/one-story/lib/illustration-frame.ts): 넓은 화면은 너비에 맞추고 아래만 자르고, 좁은 화면은
// 양옆을 한쪽 MAX_SIDE_CROP까지만 자른 뒤 남는 아래는 흐린 그림이 채운다.
const ILLUSTRATION_ASPECT = 16 / 9;
const MAX_SIDE_CROP = 0.06;

async function placed(file, width, height) {
  if (width / height >= ILLUSTRATION_ASPECT) {
    return sharp(file)
      .resize(width, Math.round(width / ILLUSTRATION_ASPECT))
      .extract({ left: 0, top: 0, width, height })
      .toBuffer();
  }
  const fitWidth = Math.round(Math.min(height * ILLUSTRATION_ASPECT, width / (1 - 2 * MAX_SIDE_CROP)));
  const fitHeight = Math.round(fitWidth / ILLUSTRATION_ASPECT);
  const image = await sharp(file)
    .resize(fitWidth, fitHeight)
    .extract({ left: Math.round((fitWidth - width) / 2), top: 0, width, height: Math.min(fitHeight, height) })
    .toBuffer();
  if (fitHeight >= height) return image;
  const blurred = await sharp(file).resize(width, height, { fit: 'cover' }).blur(18).modulate({ brightness: 0.55 }).toBuffer();
  return sharp(blurred).composite([{ input: image, left: 0, top: 0 }]).toBuffer();
}

function overlay(width, height, device) {
  const y = (pct) => (height * pct) / 100;
  const x = (pct) => (width * pct) / 100;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${width}" height="${y(device.top)}" fill="rgba(220,30,30,0.35)"/>
  <rect x="${x(4)}" y="${y(device.caption[0])}" width="${x(92)}" height="${y(device.caption[1] - device.caption[0])}" fill="rgba(220,30,30,0.35)"/>
  <rect x="${x(28)}" y="${y(36)}" width="${x(44)}" height="${y(38)}" fill="none" stroke="orange" stroke-width="2" stroke-dasharray="6 4"/>
  <line x1="0" y1="${y(60)}" x2="${width}" y2="${y(60)}" stroke="#2a7fff" stroke-width="2" stroke-dasharray="6 4"/>
</svg>`);
}

/** 한 기기 화면으로 자르고 덮는 자리를 겹친 그림(높이 frameHeight). */
export async function deviceFrame(file, device, frameHeight, format = 'png') {
  const width = Math.round(frameHeight * device.aspect);
  const image = await placed(file, width, frameHeight);
  const composed = sharp(image).composite([{ input: overlay(width, frameHeight, device) }]);
  return format === 'jpeg' ? composed.jpeg({ quality: 72 }).toBuffer() : composed.png().toBuffer();
}

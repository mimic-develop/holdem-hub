import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'apps/heads-up/src/assets/ai-profiles/source.png');
const OUT = path.join(ROOT, 'apps/heads-up/src/assets/ai-profiles');
const OUT_SIZE = 256;

// 1024×1024 source.
// 각 crop은 캐릭터 뒤의 빨간 원 중심을 정사각형의 중앙에 두어,
// 라운드 아바타(object-cover + rounded-full) 안에서 빨간 원이 정중앙에 보이게 한다.
// 원 중심은 red-pixel 검출로 측정 (cx, cy):
//   standard=(186,311), nit=(510,312), maniac=(837,310),
//   calling-station=(318,679), loose-aggro=(701,679)
const CROPS = {
  'standard':        { left:  26, top: 151, width: 320, height: 320 },
  'nit':             { left: 350, top: 152, width: 320, height: 320 },
  'maniac':          { left: 677, top: 150, width: 320, height: 320 },
  'calling-station': { left: 158, top: 519, width: 320, height: 320 },
  'loose-aggro':     { left: 541, top: 519, width: 320, height: 320 },
};

for (const [name, region] of Object.entries(CROPS)) {
  await sharp(SRC)
    .extract(region)
    .resize(OUT_SIZE, OUT_SIZE)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, `${name}.png`));
  console.log(`✓ ${name}.png`);
}

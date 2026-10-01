import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = `${root}public/icons/qcet-generated/glyphs`;
await mkdir(out, { recursive: true });
// Coordinates in the approved 1024px sheet. Extra generated glyphs are not used.
const rows = [110, 272, 433, 593, 754, 917];
const cols = [106, 269, 431, 593, 756, 918];
const names = [
  ['dashboard','inbox','tasks','calendar','documents','incoming'],
  ['outgoing','proposal','folder','unit-tasks','reports','analytics'],
  ['upload','assignment','edit',null,null,'comment'],
  ['organization','delegation','admin','settings','help','search'],
  ['notification','person','filter','add','more','approve'],
  ['return','signature','attachment','download','print','logout'],
];
for (let row = 0; row < names.length; row++) {
  for (let col = 0; col < names[row].length; col++) {
    const name = names[row][col];
    if (!name) continue;
    const { data, info } = await sharp(`${root}public/icons/qcet-generated/icon-family-v1.png`)
      .extract({left: cols[col] - 72, top: rows[row] - 72, width: 144, height: 144})
      .removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0; i < info.width * info.height; i++) {
      // Convert white paper to transparency, preserving antialiasing of the original ink.
      rgba[i * 4 + 3] = 255 - Math.round((data[i * info.channels] + data[i * info.channels + 1] + data[i * info.channels + 2]) / 3);
    }
    await sharp(rgba, {raw:{width:info.width,height:info.height,channels:4}})
      .png().toFile(`${out}/${name}.png`);
  }
}
console.log('Extracted 34 original glyphs with transparent backgrounds.');

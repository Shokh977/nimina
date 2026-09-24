/**
 * Two procedurally-drawn, visually distinct "app" screenshots — demo
 * content for /dev/recipes only. Proves Prompt 6's core claim (two
 * different apps through the same recipe look clearly different) without
 * needing a real upload pipeline wired into this gallery. Pure engine2
 * canvas drawing, no dependency on the classic engine's dev helpers.
 */
import { makeCanvas } from './texture';
import type { RecipeScreenshot } from './recipes';

function fitnessApp(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(524, 1144);
  ctx.fillStyle = '#0B3A33';
  ctx.fillRect(0, 0, 524, 1144);
  ctx.fillStyle = '#F2FFFA';
  ctx.font = '800 42px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText('Today', 32, 130);
  ctx.fillStyle = '#7FE8C8';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.fillText('Tuesday, June 3', 32, 164);

  // Ring stat.
  const cx = 262,
    cy = 340,
    r = 120;
  ctx.lineWidth = 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#2DD4BF';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 0.78 * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '800 56px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('8,432', cx, cy - 4);
  ctx.font = '500 20px Figtree, sans-serif';
  ctx.fillStyle = '#7FE8C8';
  ctx.fillText('steps', cx, cy + 28);
  ctx.textAlign = 'left';

  const rows = [
    ['Morning walk', '12-day streak'],
    ['Read 20 pages', '5-day streak'],
    ['Drink water', '6 of 8 glasses'],
    ['Stretch', '9-day streak'],
  ];
  let y = 540;
  rows.forEach(([a, b]) => {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.roundRect(32, y, 460, 94, 22);
    ctx.fill();
    ctx.fillStyle = '#F2FFFA';
    ctx.font = '700 26px Figtree, sans-serif';
    ctx.fillText(a, 60, y + 42);
    ctx.fillStyle = '#7FE8C8';
    ctx.font = '500 19px Figtree, sans-serif';
    ctx.fillText(b, 60, y + 70);
    y += 110;
  });
  return canvas;
}

function shoppingApp(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(524, 1144);
  ctx.fillStyle = '#FFF8F2';
  ctx.fillRect(0, 0, 524, 1144);
  ctx.fillStyle = '#1F1B16';
  ctx.font = '800 40px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText('Weekend Sale', 32, 120);
  ctx.fillStyle = '#C8702F';
  ctx.font = '600 22px Figtree, sans-serif';
  ctx.fillText('Up to 40% off selected styles', 32, 154);

  // Hero product card.
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.roundRect(32, 200, 460, 420, 28);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const grad = ctx.createLinearGradient(32, 200, 492, 500);
  grad.addColorStop(0, '#FAD06A');
  grad.addColorStop(1, '#EF6A45');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(32, 200, 460, 260, [28, 28, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#1F1B16';
  ctx.font = '700 30px Figtree, sans-serif';
  ctx.fillText('Trail Runner Jacket', 56, 500);
  ctx.fillStyle = '#C8702F';
  ctx.font = '800 28px Figtree, sans-serif';
  ctx.fillText('$89', 56, 540);
  ctx.fillStyle = '#9A9488';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.save();
  ctx.font = '500 22px Figtree, sans-serif';
  const oldPrice = '$149';
  ctx.fillText(oldPrice, 110, 540);
  ctx.strokeStyle = '#9A9488';
  ctx.lineWidth = 2;
  const w = ctx.measureText(oldPrice).width;
  ctx.beginPath();
  ctx.moveTo(108, 532);
  ctx.lineTo(108 + w + 4, 532);
  ctx.stroke();
  ctx.restore();

  const grid = [
    ['👟', 'Sneakers'],
    ['🎒', 'Backpacks'],
    ['🧢', 'Hats'],
  ];
  let x = 32;
  grid.forEach(([emoji, label]) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(x, 660, 140, 140, 22);
    ctx.fill();
    ctx.font = '44px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, x + 70, 720);
    ctx.fillStyle = '#1F1B16';
    ctx.font = '600 17px Figtree, sans-serif';
    ctx.fillText(label, x + 70, 770);
    ctx.textAlign = 'left';
    x += 156;
  });

  ctx.fillStyle = '#1F1B16';
  ctx.beginPath();
  ctx.roundRect(32, 970, 460, 88, 44);
  ctx.fill();
  ctx.fillStyle = '#FFF8F2';
  ctx.font = '700 26px Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Add to bag', 262, 1020);
  ctx.textAlign = 'left';
  return canvas;
}

export function buildSampleScreenshots(): { fitness: RecipeScreenshot; shopping: RecipeScreenshot } {
  return {
    fitness: {
      id: 'sample-fitness',
      image: fitnessApp(),
      cutouts: [
        { id: 'ring', rect: [0.27, 0.19, 0.46, 0.24] },
        { id: 'row1', rect: [0.06, 0.472, 0.878, 0.082] },
        { id: 'row2', rect: [0.06, 0.568, 0.878, 0.082] },
      ],
    },
    shopping: {
      id: 'sample-shopping',
      image: shoppingApp(),
      cutouts: [
        { id: 'hero', rect: [0.06, 0.175, 0.878, 0.367] },
        { id: 'sneakers', rect: [0.06, 0.577, 0.267, 0.122] },
      ],
    },
  };
}

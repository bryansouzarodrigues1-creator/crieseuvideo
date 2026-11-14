import { storyFrame, type StoryActor, type StoryActorFrame, type StoryScene, type StoryProp } from './storyAction';

/**
 * Code-drawn 2D story stage. The 3D studio also renders these actions on its
 * scene board using drawBoardArt; it does not pretend they are 3D rigged actors.
 * Positions and ownership come exclusively from the pure timeline evaluator.
 */
const INK = '#172236';
const skin = '#F0C5A4';
const round = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath(); c.roundRect(x, y, w, h, r);
};
const strokeFill = (c: CanvasRenderingContext2D, fill: string, width = 5) => {
  c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = width; c.lineJoin = 'round'; c.stroke();
};
const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  c.beginPath(); c.ellipse(x, y, w, h, 0, 0, Math.PI * 2); strokeFill(c, color, 5);
};
const limb = (c: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string) => {
  const midX = fromX + (toX - fromX) * 0.45, midY = Math.max(fromY + 26, (fromY + toY) / 2);
  c.beginPath(); c.moveTo(fromX, fromY); c.quadraticCurveTo(midX, midY, toX, toY);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = 25; c.stroke();
  c.strokeStyle = color; c.lineWidth = 17; c.stroke();
  ellipse(c, toX, toY, 11, 11, skin);
};

function drawActor(c: CanvasRenderingContext2D, actor: StoryActor, frame: StoryActorFrame, t: number, index: number) {
  c.save(); c.translate(frame.x, 0);
  const step = frame.moving ? Math.sin(t * 11 + index) : Math.sin(t * 1.4 + index) * 0.1;
  const bob = frame.moving ? Math.abs(Math.sin(t * 11 + index)) * 7 : Math.sin(t * 2 + index) * 2;
  c.translate(0, -bob);
  c.beginPath(); c.ellipse(0, 231 + bob, 65, 14, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(17,30,49,.18)'; c.fill();
  // Shoes and separated legs have real walk cycles instead of translating a static bust.
  for (const side of [-1, 1]) {
    const swing = side * step * 30;
    limb(c, side * 27, 103, side * 28 + swing, 208, '#354665');
    c.save(); c.translate(side * 28 + swing, 212); c.rotate(-step * side * .12);
    round(c, -23, -6, 48, 23, 10); strokeFill(c, '#F5F4EF', 4); c.restore();
  }
  // Jacket and shirt.
  round(c, -58, -22, 116, 139, 30); strokeFill(c, actor.color, 6);
  round(c, -13, -14, 26, 92, 9); c.fillStyle = 'rgba(255,255,255,.65)'; c.fill();
  c.beginPath(); c.moveTo(-30, -21); c.lineTo(0, 15); c.lineTo(30, -21); c.closePath(); strokeFill(c, '#F1F5F9', 3);

  // Arms. The actor-side hand touches the actual timeline prop location.
  for (const side of [-1, 1]) {
    const isReaching = (side === -1 ? 'left' : 'right') === frame.reach?.side;
    const x = isReaching ? frame.reach!.x - frame.x : side * 80 + Math.sin(t * 2 + index) * 4;
    const y = isReaching ? frame.reach!.y : 91;
    limb(c, side * 52, -4, x, y, actor.color);
  }
  // Distinct hair per actor, readable reactions and blinking.
  ellipse(c, 0, -116, 65, 70, skin);
  c.beginPath();
  c.arc(0, -128, 66, Math.PI * 1.02, Math.PI * 1.97);
  c.lineTo(56, -158); c.quadraticCurveTo(21, -175, -11, -169);
  c.quadraticCurveTo(-44, -170, -56, -135);
  strokeFill(c, index === 0 ? '#6A423A' : '#262B41', 4);
  const blinking = (t + index * 1.5) % 3.4 > 3.24;
  for (const side of [-1, 1]) {
    const eyeX = side * 23;
    c.beginPath();
    if (blinking) { c.moveTo(eyeX - 11, -121); c.lineTo(eyeX + 11, -121); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); }
    else {
      c.ellipse(eyeX, -121, 10, 13, 0, 0, Math.PI * 2); c.fillStyle = '#FFFFFF'; c.fill();
      c.beginPath(); c.arc(eyeX + 2, -120, 5, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
    }
  }
  c.beginPath(); c.arc(0, -90, 14, 0.15, Math.PI - 0.15);
  c.strokeStyle = '#8D4D50'; c.lineWidth = 4; c.stroke();
  // Name tags identify who is giving/receiving without changing spoken captions.
  c.font = "bold 21px 'DM Sans', sans-serif";
  const textWidth = Math.min(166, Math.max(74, c.measureText(actor.name).width + 24));
  round(c, -textWidth / 2, 236, textWidth, 34, 15); strokeFill(c, '#152437', 2);
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(actor.name, 0, 253, textWidth - 12);
  c.restore();
}

function drawProp(c: CanvasRenderingContext2D, prop: StoryProp, x: number, y: number, angle: number, t: number) {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.shadowOffsetY = 7; c.shadowColor = 'rgba(16,26,43,.22)'; c.shadowBlur = 12;
  switch (prop) {
    case 'lantern': {
      c.shadowBlur = 0;
      const glow = c.createRadialGradient(0, -10, 8, 0, -10, 100);
      glow.addColorStop(0, 'rgba(255,233,115,.55)'); glow.addColorStop(1, 'rgba(255,233,115,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(0, -10, 100, 0, Math.PI * 2); c.fill();
      round(c, -23, -33, 46, 71, 10); strokeFill(c, '#FFB627', 6);
      round(c, -18, -27, 36, 46, 7); strokeFill(c, '#FFF0A8', 3);
      c.fillStyle = '#FFFFFF'; c.fillRect(-10, -19, 6, 29);
      round(c, -28, -42, 56, 15, 5); strokeFill(c, '#354665', 4);
      c.beginPath(); c.arc(0, -45, 13, Math.PI, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 6; c.stroke();
      break;
    }
    case 'hat': {
      c.beginPath(); c.ellipse(0, 25, 75, 14, 0, 0, Math.PI * 2); strokeFill(c, '#5C6FD7', 5);
      round(c, -43, -45, 86, 65, 26); strokeFill(c, '#718AF3', 6);
      c.fillStyle = '#F4CB6A'; c.fillRect(-40, 2, 80, 14);
      break;
    }
    case 'ball':
      ellipse(c, 0, 0, 42, 42, '#F56B70');
      c.beginPath(); c.arc(-13, -14, 13, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill();
      break;
    case 'box':
      round(c, -45, -38, 90, 76, 10); strokeFill(c, '#D8A368', 6);
      round(c, -48, -43, 96, 17, 4); strokeFill(c, '#F6D19A', 4);
      break;
    case 'key':
      c.beginPath(); c.arc(-21, -12, 22, 0, Math.PI * 2);
      c.lineWidth = 12; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 7; c.strokeStyle = '#FBD56D'; c.stroke();
      c.beginPath(); c.moveTo(-3, 1); c.lineTo(48, 48); c.lineTo(48, 30);
      c.lineWidth = 15; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 9; c.strokeStyle = '#FBD56D'; c.stroke();
      break;
  }
  c.restore();
}

/** Render full story composition inside [-420,420] × [-290,430] drawing units. */
export function drawStory(c: CanvasRenderingContext2D, story: StoryScene, u: number, local: number, duration: number) {
  const state = storyFrame(story, local, duration);
  c.save(); c.scale(u, u);
  c.beginPath(); c.moveTo(-400, 227); c.lineTo(400, 227);
  c.strokeStyle = 'rgba(27,41,61,.20)'; c.lineWidth = 4; c.stroke();
  state.actors.forEach((actor, index) => drawActor(c, story.actors[index]!, actor, local, index));
  drawProp(c, story.prop, state.prop.x, state.prop.y, state.prop.rotation, local);
  c.restore();
}

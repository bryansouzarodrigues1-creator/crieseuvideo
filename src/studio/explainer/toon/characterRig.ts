
import * as THREE from "three";

import type {
  ToonCharacter,
  ToonProp,
  ToonRigOptions,
  ToonAnimationOptions,
  CharacterPose,
  FacialExpression,
} from "./types";

/* -------------------------------------------------------
   CONFIGURAÇÕES
------------------------------------------------------- */

const DEFAULT_OPTIONS: Required<ToonRigOptions> = {
  bodyColor: 0xf2c94c,
  outlineColor: 0x171717,
  scale: 1,
};

const DEFAULT_ANIMATION: Required<ToonAnimationOptions> = {
  talkingFrequency: 7,
  breathingAmplitude: 0.018,
  gestureIntensity: 1,
};

const UP = new THREE.Vector3(0, 1, 0);

/* -------------------------------------------------------
   MATERIAL TOON
------------------------------------------------------- */

function createGradientTexture(): THREE.DataTexture {
  const data = new Uint8Array([
    65, 65, 65, 255,
    130, 130, 130, 255,
    205, 205, 205, 255,
    255, 255, 255, 255,
  ]);

  const texture = new THREE.DataTexture(
    data,
    4,
    1,
    THREE.RGBAFormat
  );

  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}

const gradientMap = createGradientTexture();

function createToonMaterial(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap,
  });
}

function createOutlineMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    depthWrite: true,
  });
}

/* -------------------------------------------------------
   MESH COM OUTLINE
------------------------------------------------------- */

function createOutlinedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  outlineColor: number
): THREE.Group {
  const container = new THREE.Group();

  const outline = new THREE.Mesh(
    geometry,
    createOutlineMaterial(outlineColor)
  );

  outline.scale.setScalar(1.055);
  outline.renderOrder = 0;

  const surface = new THREE.Mesh(geometry, material);
  surface.renderOrder = 1;

  container.add(outline);
  container.add(surface);

  return container;
}

function addPart(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  outlineColor: number
): THREE.Group {
  const part = createOutlinedMesh(
    geometry,
    material,
    outlineColor
  );

  part.position.copy(position);
  parent.add(part);

  return part;
}

function sphere(
  radius: number,
  material: THREE.Material,
  position: THREE.Vector3,
  outlineColor: number,
  segments = 12
): THREE.Group {
  const part = createOutlinedMesh(
    new THREE.SphereGeometry(radius, segments, segments),
    material,
    outlineColor
  );
  part.position.copy(position);
  return part;
}

/* -------------------------------------------------------
   MEMBROS ARTICULADOS
------------------------------------------------------- */

interface Limb {
  root: THREE.Group;
  elbow?: THREE.Group;
  hand?: THREE.Group;
}

function createSegment(
  parent: THREE.Group,
  length: number,
  radius: number,
  material: THREE.Material,
  outlineColor: number
): THREE.Group {
  const geometry = new THREE.CylinderGeometry(
    radius * 0.8,
    radius,
    length,
    8
  );

  const segment = addPart(
    parent,
    geometry,
    material,
    new THREE.Vector3(0, -length / 2, 0),
    outlineColor
  );

  return segment;
}

function createArm(
  parent: THREE.Group,
  side: -1 | 1,
  material: THREE.Material,
  outlineColor: number
): Limb {
  const shoulder = new THREE.Group();

  shoulder.position.set(side * 0.48, 0.48, 0);
  parent.add(shoulder);

  createSegment(
    shoulder,
    0.42,
    0.105,
    material,
    outlineColor
  );

  const elbow = new THREE.Group();
  elbow.position.y = -0.42;
  shoulder.add(elbow);

  createSegment(
    elbow,
    0.39,
    0.085,
    material,
    outlineColor
  );

  const hand = sphere(
    0.105,
    material,
    new THREE.Vector3(0, -0.43, 0),
    outlineColor,
    10
  );

  elbow.add(hand);

  return {
    root: shoulder,
    elbow,
    hand,
  };
}

function createLeg(
  parent: THREE.Group,
  side: -1 | 1,
  material: THREE.Material,
  outlineColor: number
): Limb {
  const hip = new THREE.Group();

  hip.position.set(side * 0.19, -0.45, 0);
  parent.add(hip);

  createSegment(
    hip,
    0.47,
    0.12,
    material,
    outlineColor
  );

  const knee = new THREE.Group();
  knee.position.y = -0.47;
  hip.add(knee);

  createSegment(
    knee,
    0.45,
    0.095,
    material,
    outlineColor
  );

  const foot = addPart(
    knee,
    new THREE.BoxGeometry(0.22, 0.12, 0.34),
    material,
    new THREE.Vector3(0, -0.47, 0.1),
    outlineColor
  );

  return {
    root: hip,
    elbow: knee,
    hand: foot,
  };
}

/* -------------------------------------------------------
   ROSTO E EXPRESSÕES
------------------------------------------------------- */

interface FaceRig {
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftBrow: THREE.Group;
  rightBrow: THREE.Group;
  mouth: THREE.Group;
}

function createFace(
  head: THREE.Group,
  outlineColor: number
): FaceRig {
  const white = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap,
  });

  const black = new THREE.MeshToonMaterial({
    color: 0x151515,
    gradientMap,
  });

  const mouthMaterial = new THREE.MeshToonMaterial({
    color: 0x381515,
    gradientMap,
  });

  const leftEye = sphere(
    0.075,
    white,
    new THREE.Vector3(-0.13, 0.03, 0.29),
    outlineColor,
    10
  );

  const rightEye = sphere(
    0.075,
    white,
    new THREE.Vector3(0.13, 0.03, 0.29),
    outlineColor,
    10
  );

  head.add(leftEye, rightEye);

  const leftPupil = sphere(
    0.035,
    black,
    new THREE.Vector3(0, 0, 0.065),
    outlineColor,
    8
  );

  const rightPupil = sphere(
    0.035,
    black,
    new THREE.Vector3(0, 0, 0.065),
    outlineColor,
    8
  );

  leftEye.add(leftPupil);
  rightEye.add(rightPupil);

  const leftBrow = new THREE.Group();
  const rightBrow = new THREE.Group();

  const browGeometry = new THREE.BoxGeometry(
    0.17,
    0.035,
    0.04
  );

  addPart(
    leftBrow,
    browGeometry,
    black,
    new THREE.Vector3(0, 0, 0),
    outlineColor
  );

  addPart(
    rightBrow,
    browGeometry,
    black,
    new THREE.Vector3(0, 0, 0),
    outlineColor
  );

  leftBrow.position.set(-0.13, 0.14, 0.31);
  rightBrow.position.set(0.13, 0.14, 0.31);

  head.add(leftBrow, rightBrow);

  const mouth = new THREE.Group();

  const mouthShape = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    mouthMaterial
  );

  mouthShape.scale.set(1.15, 0.35, 0.25);
  mouthShape.position.set(0, -0.13, 0.31);

  mouth.add(mouthShape);
  head.add(mouth);

  return {
    leftEye,
    rightEye,
    leftBrow,
    rightBrow,
    mouth,
  };
}

function applyExpression(
  face: FaceRig,
  expression: FacialExpression
): void {
  const {
    leftBrow,
    rightBrow,
    mouth,
    leftEye,
    rightEye,
  } = face;

  leftBrow.rotation.z = 0;
  rightBrow.rotation.z = 0;

  mouth.scale.set(1, 1, 1);
  mouth.position.y = 0;

  leftEye.scale.set(1, 1, 1);
  rightEye.scale.set(1, 1, 1);

  switch (expression) {
    case "happy":
      mouth.scale.y = 1.5;
      leftEye.scale.y = 0.85;
      rightEye.scale.y = 0.85;
      break;

    case "angry":
      leftBrow.rotation.z = -0.35;
      rightBrow.rotation.z = 0.35;
      mouth.scale.y = 0.45;
      break;

    case "confused":
      leftBrow.rotation.z = 0.25;
      rightBrow.rotation.z = -0.1;
      mouth.rotation.z = -0.15;
      break;

    case "smirk_patrick":
      mouth.scale.set(1.5, 0.45, 1);
      mouth.rotation.z = -0.15;
      leftBrow.rotation.z = 0.1;
      break;

    case "neutral":
    default:
      break;
  }
}

/* -------------------------------------------------------
   PROPS PROCEDURAIS
------------------------------------------------------- */

function createProp(
  type: ToonProp,
  outlineColor: number
): THREE.Group {
  const prop = new THREE.Group();

  const gold = createToonMaterial(0xf2c94c);
  const metal = createToonMaterial(0x89939c);
  const wood = createToonMaterial(0x754526);
  const blue = createToonMaterial(0x2677b9);
  const white = createToonMaterial(0xf4eee0);
  const dark = createToonMaterial(0x242424);

  switch (type) {
    case "lance": {
      createSegment(
        prop,
        1.05,
        0.035,
        wood,
        outlineColor
      );

      const tip = addPart(
        prop,
        new THREE.ConeGeometry(0.095, 0.25, 6),
        metal,
        new THREE.Vector3(0, 0.62, 0),
        outlineColor
      );

      tip.rotation.z = Math.PI;
      break;
    }

    case "shield": {
      addPart(
        prop,
        new THREE.CylinderGeometry(0.32, 0.32, 0.09, 8),
        metal,
        new THREE.Vector3(0, 0, 0),
        outlineColor
      );

      addPart(
        prop,
        new THREE.CircleGeometry(0.25, 8),
        blue,
        new THREE.Vector3(0, 0, 0.055),
        outlineColor
      );
      break;
    }

    case "coin_stack": {
      for (let i = 0; i < 5; i++) {
        addPart(
          prop,
          new THREE.CylinderGeometry(0.12, 0.12, 0.045, 12),
          gold,
          new THREE.Vector3(0, i * 0.045, 0),
          outlineColor
        );
      }
      break;
    }

    case "phone": {
      addPart(
        prop,
        new THREE.BoxGeometry(0.19, 0.34, 0.035),
        dark,
        new THREE.Vector3(0, 0, 0),
        outlineColor
      );

      addPart(
        prop,
        new THREE.PlaneGeometry(0.15, 0.27),
        blue,
        new THREE.Vector3(0, 0, 0.02),
        outlineColor
      );
      break;
    }

    case "coffee": {
      addPart(
        prop,
        new THREE.CylinderGeometry(0.11, 0.085, 0.22, 10),
        white,
        new THREE.Vector3(0, 0, 0),
        outlineColor
      );

      addPart(
        prop,
        new THREE.TorusGeometry(0.09, 0.025, 6, 10),
        white,
        new THREE.Vector3(0.13, 0, 0),
        outlineColor
      );
      break;
    }

    case "clipboard": {
      addPart(
        prop,
        new THREE.BoxGeometry(0.28, 0.4, 0.035),
        wood,
        new THREE.Vector3(0, 0, 0),
        outlineColor
      );

      addPart(
        prop,
        new THREE.BoxGeometry(0.2, 0.29, 0.01),
        white,
        new THREE.Vector3(0, -0.015, 0.025),
        outlineColor
      );
      break;
    }

    case "none":
    default:
      break;
  }

  return prop;
}

/* -------------------------------------------------------
   RIG PRINCIPAL
------------------------------------------------------- */

export interface ToonCharacterRig {
  root: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;

  leftArm: Limb;
  rightArm: Limb;

  leftLeg: Limb;
  rightLeg: Limb;

  face: FaceRig;
  prop: THREE.Group;

  dispose: () => void;
}

export function createCharacterRig(
  options: ToonRigOptions = {},
  propType: ToonProp = "none"
): ToonCharacterRig {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const root = new THREE.Group();
  root.scale.setScalar(config.scale);

  const bodyMaterial = createToonMaterial(config.bodyColor);
  const outlineColor = config.outlineColor;

  // Tronco
  const torso = new THREE.Group();
  root.add(torso);

  addPart(
    torso,
    new THREE.CylinderGeometry(0.27, 0.35, 0.78, 8),
    bodyMaterial,
    new THREE.Vector3(0, 0, 0),
    outlineColor
  );

  // Cabeça
  const head = new THREE.Group();
  head.position.set(0, 0.65, 0);
  torso.add(head);

  // Camisa azul-clara (gola) e colete por cima do terno
  addPart(torso, new THREE.BoxGeometry(0.2, 0.42, 0.06), createToonMaterial(0x9cc7ee), new THREE.Vector3(0, 0.15, 0.31), outlineColor);
  addPart(torso, new THREE.BoxGeometry(0.06, 0.3, 0.04), createToonMaterial(0x1b2440), new THREE.Vector3(0, 0.12, 0.345), outlineColor);
  addPart(torso, new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), createToonMaterial(0xf2c9a0), new THREE.Vector3(0, 0.42, 0), outlineColor);

  // Cabelo dourado ondulado (Patrick)
  const hairMat = createToonMaterial(0xc99a45);
  const hairPuffs: [number, number, number, number][] = [
    [0, 0.2, -0.04, 0.3], [-0.2, 0.16, 0.06, 0.17], [0.2, 0.16, 0.06, 0.17], [-0.08, 0.26, 0.14, 0.15],
    [0.1, 0.25, 0.16, 0.14], [-0.27, 0.0, -0.06, 0.13], [0.27, 0.0, -0.06, 0.13], [0, 0.05, -0.24, 0.24],
  ];
  hairPuffs.forEach(([x, y, z, r]) => addPart(head, new THREE.SphereGeometry(r, 10, 8), hairMat, new THREE.Vector3(x, y, z), outlineColor));

  addPart(
    head,
    new THREE.SphereGeometry(0.34, 16, 12),
    createToonMaterial(0xf2c9a0),
    new THREE.Vector3(0, 0, 0),
    outlineColor
  );

  const face = createFace(head, outlineColor);

  // Braços
  const leftArm = createArm(
    torso,
    -1,
    bodyMaterial,
    outlineColor
  );

  const rightArm = createArm(
    torso,
    1,
    bodyMaterial,
    outlineColor
  );

  // Pernas
  const leftLeg = createLeg(
    root,
    -1,
    bodyMaterial,
    outlineColor
  );

  const rightLeg = createLeg(
    root,
    1,
    bodyMaterial,
    outlineColor
  );

  // Objeto acoplado à mão direita
  const prop = createProp(propType, outlineColor);

  prop.position.set(0, -0.43, 0.13);
  rightArm.elbow?.add(prop);

  return {
    root,
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    face,
    prop,

    dispose() {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => {
            if (material !== bodyMaterial) {
              material.dispose();
            }
          });
        }
      });
    },
  };
}

/* -------------------------------------------------------
   ANIMAÇÃO DETERMINÍSTICA
------------------------------------------------------- */

function smoothstep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function dampedSpring(
  time: number,
  frequency = 5,
  damping = 4
): number {
  return Math.exp(-damping * time) *
    Math.sin(frequency * time);
}

function animatePose(
  rig: ToonCharacterRig,
  pose: CharacterPose,
  t: number,
  options: Required<ToonAnimationOptions>
): void {
  const { leftArm, rightArm, leftLeg, rightLeg, head, torso } = rig;
  torso.position.y = Math.sin(t * 2.2) * options.breathingAmplitude;
  torso.rotation.set(0, 0, 0);
  head.rotation.set(Math.sin(t * 1.5) * 0.018, 0, Math.sin(t * 1.1) * 0.018);
  // Os braços seguem o eixo local -Y. Rotação X negativa leva o antebraço para +Z (frente).
  const gesture = Math.sin(t * options.talkingFrequency) * 0.07 * options.gestureIntensity;
  const target = {
    leftShoulderX: -0.08, rightShoulderX: -0.08,
    leftShoulderZ: 0.04, rightShoulderZ: -0.04,
    leftElbowX: -0.04, rightElbowX: -0.04,
    leftLegX: 0, rightLegX: 0, headX: 0, headZ: 0,
  };
  switch (pose) {
    case "talking":
      target.rightShoulderX = -0.34 - gesture;
      target.leftShoulderX = -0.24 + gesture * 0.4;
      target.rightShoulderZ = -0.12; target.leftShoulderZ = 0.10;
      target.rightElbowX = -0.48; target.leftElbowX = -0.34;
      target.headZ = Math.sin(t * 3.5) * 0.035;
      target.headX = Math.sin(t * 2.4) * 0.025;
      break;
    case "pointing":
      target.rightShoulderX = -0.48; target.rightShoulderZ = -0.10;
      target.rightElbowX = -0.28; target.leftShoulderX = -0.12;
      break;
    case "holding_prop":
      target.rightShoulderX = -0.62; target.rightShoulderZ = -0.08;
      target.rightElbowX = -0.82; target.leftShoulderX = -0.16;
      target.leftElbowX = -0.12;
      break;
    case "running": {
      const run = Math.sin(t * 9);
      target.rightShoulderX = -0.25 - run * 0.35;
      target.leftShoulderX = -0.25 + run * 0.35;
      target.rightElbowX = -0.55; target.leftElbowX = -0.55;
      target.rightLegX = run * 0.8; target.leftLegX = -run * 0.8;
      target.headX = -0.05;
      torso.position.y += Math.abs(Math.sin(t * 9)) * 0.045;
      break;
    }
    case "shocked":
      target.rightShoulderX = -0.38; target.leftShoulderX = -0.38;
      target.rightShoulderZ = -0.28; target.leftShoulderZ = 0.28;
      target.rightElbowX = -0.72; target.leftElbowX = -0.72;
      target.headX = -0.12;
      break;
    case "idle":
    default:
      break;
  }
  const blend = smoothstep(Math.min(1, t * 4));
  leftArm.root.rotation.set(THREE.MathUtils.lerp(-0.08, target.leftShoulderX, blend), 0, THREE.MathUtils.lerp(0.04, target.leftShoulderZ, blend));
  rightArm.root.rotation.set(THREE.MathUtils.lerp(-0.08, target.rightShoulderX, blend), 0, THREE.MathUtils.lerp(-0.04, target.rightShoulderZ, blend));
  leftArm.elbow!.rotation.set(THREE.MathUtils.lerp(-0.04, target.leftElbowX, blend), 0, 0);
  rightArm.elbow!.rotation.set(THREE.MathUtils.lerp(-0.04, target.rightElbowX, blend), 0, 0);
  leftLeg.root.rotation.x = target.leftLegX;
  rightLeg.root.rotation.x = target.rightLegX;
  head.rotation.x += target.headX * blend;
  head.rotation.z += target.headZ * blend;
  torso.rotation.z = dampedSpring(t, 7, 5) * 0.012 * options.gestureIntensity;
}

/* -------------------------------------------------------
   ATUALIZAÇÃO PÚBLICA
------------------------------------------------------- */

export function updateCharacterRig(
  rig: ToonCharacterRig,
  character: ToonCharacter,
  t: number,
  options: ToonAnimationOptions = {}
): void {
  const config = {
    ...DEFAULT_ANIMATION,
    ...options,
  };

  const time = Math.max(0, t);

  rig.root.position.set(
    character.position.x,
    character.position.y,
    character.position.z
  );

  rig.root.rotation.y = character.rotationY;

  animatePose(
    rig,
    character.pose,
    time,
    config
  );

  applyExpression(
    rig.face,
    character.expression
  );

  // Orienta discretamente o rosto para o item na mão.
  rig.head.rotation.y = character.gaze === "lookAtProp" && character.prop !== "none" ? 0.18 : 0;

  // Visibilidade do objeto
  rig.prop.visible = character.prop !== "none";
}

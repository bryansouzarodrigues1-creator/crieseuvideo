
export type CharacterPose =
  | "idle"
  | "talking"
  | "pointing"
  | "holding_prop"
  | "running"
  | "shocked";

export type FacialExpression =
  | "neutral"
  | "happy"
  | "angry"
  | "confused"
  | "smirk_patrick";

export type GazeDirection =
  | "lookAtCamera"
  | "lookAtProp";

export type ToonProp =
  | "lance"
  | "shield"
  | "coin_stack"
  | "phone"
  | "coffee"
  | "clipboard"
  | "none";

export type ToonEnvironment =
  | "office_desk"
  | "blacksmith_medieval"
  | "dark_tunnel"
  | "void_spotlight"
  | "court_room";

export type CinematicCamera =
  | "close_up"
  | "medium_shot"
  | "wide_shot"
  | "low_angle_dramatic"
  | "camera_shake";

export type ToonLighting =
  | "daylight"
  | "dramatic_rim"
  | "warm_torch"
  | "neon_cyber";

export interface ToonVector3 {
  x: number;
  y: number;
  z: number;
}

export interface ToonCharacter {
  id: string;
  pose: CharacterPose;
  expression: FacialExpression;
  gaze: GazeDirection;
  prop: ToonProp;
  position: ToonVector3;
  rotationY: number;
  scale: number;
}

export interface ToonEnvironmentConfig {
  type: ToonEnvironment;
  backgroundColor?: string;
  groundColor?: string;
}

export interface ToonCameraConfig {
  type: CinematicCamera;
  target?: ToonVector3;
  shakeIntensity?: number;
}

export interface ToonLightingConfig {
  type: ToonLighting;
  intensity?: number;
}

export interface PunchWord {
  text: string;
  start: number;
  end: number;
  color?: string;
}

export interface ToonSubtitles {
  text: string;
  start: number;
  end: number;
  punchWords?: PunchWord[];
}

export interface Toon3DScene {
  id: string;
  duration: number;
  character: ToonCharacter;
  environment: ToonEnvironmentConfig;
  camera: ToonCameraConfig;
  lighting: ToonLightingConfig;
  subtitles?: ToonSubtitles[];
}

export interface ToonRigOptions {
  bodyColor?: number;
  outlineColor?: number;
  scale?: number;
}

export interface ToonAnimationOptions {
  talkingFrequency?: number;
  breathingAmplitude?: number;
  gestureIntensity?: number;
}

/** Clamp de valores para impedir planos inválidos gerados pela IA. */
export function validateToonScene(
  scene: Toon3DScene
): Toon3DScene {
  if (!scene.id) {
    throw new Error("Toon3DScene precisa de um id.");
  }

  if (!Number.isFinite(scene.duration) || scene.duration <= 0) {
    throw new Error("A duração da cena precisa ser maior que zero.");
  }

  if (!Number.isFinite(scene.character.scale) ||
      scene.character.scale <= 0) {
    throw new Error("Escala do personagem inválida.");
  }

  const duration = scene.duration;

  const subtitles = scene.subtitles?.map((subtitle) => {
    const start = Math.max(0, Math.min(duration, subtitle.start));
    const end = Math.max(start, Math.min(duration, subtitle.end));

    return {
      ...subtitle,
      start,
      end,
      punchWords: subtitle.punchWords?.map((word) => ({
        ...word,
        start: Math.max(start, Math.min(end, word.start)),
        end: Math.max(start, Math.min(end, word.end)),
      })),
    };
  });

  return {
    ...scene,
    subtitles,
  };
}

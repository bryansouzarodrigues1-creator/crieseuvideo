// Catálogo de capacidades do motor 3D Toon: tudo o que a IA pode pedir e o motor sabe executar.
// Uma única fonte de verdade: o prompt do Gemini, o schema de saída, o validador e o renderer leem daqui.
// Para ensinar algo novo ao motor: implemente no renderer, depois acrescente aqui (e só então a IA passa a poder pedir).

export const ENVIRONMENTS = {
  summit: 'topo nevado de montanha com bandeira (escalada, Everest, cume, conquista)',
  sky_day: 'céu azul aberto com colinas (cenas leves, ao ar livre)',
  sunset: 'pôr do sol (final de dia, nostalgia, despedida)',
  night: 'noite com estrelas (mistério, tristeza, sonho)',
  city_day: 'rua e prédios de dia (cidade, trânsito, comércio)',
  beach: 'praia com mar (férias, descanso)',
  forest: 'floresta (natureza, aventura)',
  road: 'estrada (viagem, carro, caminhada longa)',
  room: 'quarto/casa (vida pessoal, família)',
  office: 'escritório com mesa e monitor (trabalho, empresa, dinheiro)',
  space: 'espaço sideral (ficção, universo)',
  rain: 'cidade sob chuva (drama, problema)',
} as const;
export type Environment = keyof typeof ENVIRONMENTS;
export const ENVIRONMENT_IDS = Object.keys(ENVIRONMENTS) as Environment[];

export const ACTIONS = {
  talk: 'fala olhando para a câmera, gesticulando (padrão)',
  idle: 'parado, respirando e piscando (momentos de silêncio ou suspense)',
  point_at_board: 'aponta para o quadro de ilustração (só quando board=true)',
  hold_phone: 'segura um celular e olha para ele',
  hold_coins: 'segura uma pilha de moedas',
  run: 'corre',
  shocked: 'reação de susto/choque',
} as const;
export type Action = keyof typeof ACTIONS;
export const ACTION_IDS = Object.keys(ACTIONS) as Action[];

export const ENTRANCES = {
  none: 'já está em cena',
  rise_from_below: 'sobe de baixo para o topo (escalada, chegada ao cume)',
  slide_in_left: 'entra deslizando pela esquerda',
  slide_in_right: 'entra deslizando pela direita',
  drop_in: 'cai de cima e aterrissa',
} as const;
export type Entrance = keyof typeof ENTRANCES;
export const ENTRANCE_IDS = Object.keys(ENTRANCES) as Entrance[];

export const EXPRESSIONS = {
  neutral: 'neutro',
  happy: 'feliz/confiante',
  angry: 'bravo',
  confused: 'preocupado/confuso/triste',
} as const;
export type Expression = keyof typeof EXPRESSIONS;
export const EXPRESSION_IDS = Object.keys(EXPRESSIONS) as Expression[];

/** Cor principal da roupa do personagem (o motor pinta o tronco com ela). */
export const OUTFITS = {
  default: { label: 'terno azul (padrão)', color: 0x22325a },
  yellow_jacket: { label: 'jaqueta amarela (alpinista, aventura)', color: 0xf2b632 },
  red_jacket: { label: 'jaqueta vermelha', color: 0xd64545 },
  green_jacket: { label: 'jaqueta verde (natureza)', color: 0x3aa35b },
  purple_hoodie: { label: 'moletom roxo (casual)', color: 0x7b5cd6 },
} as const;
export type Outfit = keyof typeof OUTFITS;
export const OUTFIT_IDS = Object.keys(OUTFITS) as Outfit[];

export const PLACEMENTS = ['left', 'center', 'right'] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PROPS = {
  flag: 'bandeira vermelha no cenário (conquista, meta alcançada)',
  tent: 'barraca de acampamento no cenário',
} as const;
export type Prop = keyof typeof PROPS;
export const PROP_IDS = Object.keys(PROPS) as Prop[];

export const CAMERA_MOVES = {
  static: 'câmera parada',
  push_in: 'aproxima devagar (tensão, foco no personagem)',
  pull_out: 'afasta devagar (revelar o cenário, solidão, escala)',
  orbit_left: 'gira em torno do personagem para a esquerda',
  orbit_right: 'gira em torno do personagem para a direita',
  crane_up: 'sobe revelando o cenário de cima',
  crane_down: 'desce até o nível do personagem',
  pan_left: 'desliza para a esquerda',
  pan_right: 'desliza para a direita',
} as const;
export type CameraMove = keyof typeof CAMERA_MOVES;
export const CAMERA_MOVE_IDS = Object.keys(CAMERA_MOVES) as CameraMove[];

export const SHOTS = { wide: 'plano aberto (mostra cenário)', medium: 'plano médio (corpo inteiro)', close: 'plano fechado (rosto e ombros)' } as const;
export type Shot = keyof typeof SHOTS;
export const SHOT_IDS = Object.keys(SHOTS) as Shot[];

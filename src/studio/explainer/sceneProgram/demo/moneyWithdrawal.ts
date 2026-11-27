/**
 * "E se o Elon Musk sacasse todo o dinheiro dele?" — 7 scenes in ONE persistent scene graph.
 *
 * Uses the five reviewed GLBs from /models (safe, bag, pallet, coin, armored truck), a code-built
 * generic actor (no likeness of any real person) and plain meshes (stock chart, rocket, certificates).
 * The animation itself lives in moneyWithdrawalDirection.ts (cast + verbs) and is compiled by direction/direction.ts.
 * Offline fixture: not an AI response and never sends a request.
 */
import { compileSceneProgram, type ProgramSource } from '../score';
import { compileDirection } from '../direction/direction';
import { MONEY_DIRECTION } from './moneyWithdrawalDirection';
import type { ComplexWorldClip } from '../planner/complexWorldBatch';

export const MONEY_WITHDRAWAL_SOURCES: ProgramSource[] = [
  { sourceId: 's1', text: 'E se o Elon Musk sacasse todo o dinheiro dele?', duration: 5 },
  { sourceId: 's2', text: 'Primeiro: ele não tem esse dinheiro na mão. A fortuna é quase toda ação.', duration: 8 },
  { sourceId: 's3', text: 'Se ele vendesse tudo da Tesla de uma vez, o preço despencaria.', duration: 8 },
  { sourceId: 's4', text: 'E a SpaceX nem tem ação na bolsa. Quem tem centenas de bilhões para comprar?', duration: 9 },
  { sourceId: 's5', text: 'Ainda sobra o imposto: dezenas de bilhões.', duration: 6 },
  { sourceId: 's6', text: 'Se fossem 800 bilhões em notas de cem, seriam mais de oito mil toneladas: uma fila de caminhões.', duration: 10 },
  { sourceId: 's7', text: 'Moral: sacar tudo faria ele ficar bem mais pobre.', duration: 6 },
];
export const MONEY_WITHDRAWAL_SCRIPT = MONEY_WITHDRAWAL_SOURCES.map((s) => s.text).join(' ');

export function buildMoneyWithdrawalDemo(): ComplexWorldClip {
  const program = compileDirection(MONEY_DIRECTION, MONEY_WITHDRAWAL_SOURCES);
  compileSceneProgram(program, MONEY_WITHDRAWAL_SOURCES);

  const duration = MONEY_WITHDRAWAL_SOURCES.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  return {
    id: 'musk-saque-demo', sources: MONEY_WITHDRAWAL_SOURCES, duration, program,
    presentation: {
      title: 'E se ele sacasse tudo?',
      narration: MONEY_WITHDRAWAL_SCRIPT,
      beats: [
        { start: 0, end: 5, subject: 'A pergunta', problem: 'E se ele sacasse tudo?', solution: 'Vamos abrir o cofre.' },
        { start: 5, end: 13, subject: 'Ação, não dinheiro', problem: 'O cofre quase vazio.', solution: 'A fortuna é quase toda ação.' },
        { start: 13, end: 21, subject: 'Vender derruba o preço', problem: 'Vender tudo de uma vez...', solution: '...faz o preço despencar.' },
        { start: 21, end: 30, subject: 'Sem comprador', problem: 'SpaceX não tem ação na bolsa.', solution: 'Quem compra centenas de bilhões?' },
        { start: 30, end: 36, subject: 'Imposto', problem: 'Ainda tem o imposto.', solution: 'Dezenas de bilhões a menos.' },
        { start: 36, end: 46, subject: 'Dinheiro físico', problem: '800 bi em notas de cem.', solution: 'Mais de 8 mil toneladas.' },
        { start: 46, end: 52, subject: 'Moral', problem: 'Sacar tudo?', solution: 'Ele ficaria bem mais pobre.' },
      ],
    },
    audit: { objectCount: 8, objectParts: program.nodes.filter((n) => n.kind === 'mesh').length, sceneryRegions: 1, sceneNodes: program.nodes.length, shotCount: program.shots.length, estimatedVertexLimit: 250000 },
  };
}

/** Versioned direction data. Parsing this module never executes model code. */
import { z } from 'zod';

export const DIRECTOR_LESSON_VERSION = 'spoken-actions-v1';
export const DIRECTION_MARKER = 'CRIESEUVIDEO_DIRECTION_V1';
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/);
const time = z.number().finite().min(0).max(20);
export const narrationTimingSchema = z.object({
  duration: z.number().finite().min(8).max(20),
  words: z.array(z.object({ text: z.string().trim().min(1).max(100), start: time, end: time }).strict()).min(1).max(120),
}).strict().superRefine((value, ctx) => {
  for (let i = 0; i < value.words.length; i++) {
    const word = value.words[i];
    if (word.end <= word.start || word.end > value.duration || i > 0 && word.start < value.words[i - 1].end - .02)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tempos de fala fora de ordem ou da duração do áudio.' });
  }
});
export type NarrationTiming = z.infer<typeof narrationTimingSchema>;

const rawDirection = z.object({
  version: z.literal(1),
  duration: z.number().finite().min(8).max(20),
  timing: z.enum(['planned', 'provided']),
  objects: z.array(z.object({
    id, description: z.string().trim().min(3).max(160),
    parts: z.array(id).min(1).max(20),
  }).strict()).min(1).max(16),
  shots: z.array(z.object({
    id, quote: z.string().trim().min(2).max(300),
    start: time.optional(), end: time.optional(), firstWord: z.number().int().min(0).max(119).optional(),
    subjects: z.array(id).min(1).max(4), focus: id,
    camera: z.enum(['wide', 'medium', 'detail', 'result']),
    action: z.string().trim().min(8).max(220),
    before: z.string().trim().min(3).max(200), after: z.string().trim().min(3).max(200),
  }).strict()).min(1).max(6),
}).strict();
type RawDirection = z.infer<typeof rawDirection>;
export type DirectionScore = Omit<RawDirection, 'shots'> & {
  lessonVersion: typeof DIRECTOR_LESSON_VERSION;
  shots: (RawDirection['shots'][number] & { start: number; end: number })[];
};
const normalized = (s: string) => s.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function reject(message: string): never { throw new Error(message); }

export function normalizeDirection(value: unknown, script: string, inputTiming?: NarrationTiming): DirectionScore {
  const plan = rawDirection.parse(value);
  const timing = inputTiming === undefined ? undefined : narrationTimingSchema.parse(inputTiming);
  if (plan.timing !== (timing ? 'provided' : 'planned')) reject('A direção declarou uma origem de tempos que não foi fornecida.');
  if (timing && Math.abs(plan.duration - timing.duration) > .001) reject('A direção alterou a duração do áudio.');
  const objectIds = new Set(plan.objects.map(o => o.id));
  if (objectIds.size !== plan.objects.length || plan.objects.some(o => new Set(o.parts).size !== o.parts.length))
    reject('Objetos ou peças com identificadores repetidos.');
  if (new Set(plan.shots.map(s => s.id)).size !== plan.shots.length) reject('Planos com identificadores repetidos.');
  const source = normalized(timing ? timing.words.map(w => w.text).join(' ') : script);
  let sourceOffset = 0;
  const shots: DirectionScore['shots'] = plan.shots.map((shot, index) => {
    if (new Set(shot.subjects).size !== shot.subjects.length || shot.subjects.some(s => !objectIds.has(s)) || !shot.subjects.includes(shot.focus))
      reject('O plano enquadra um objeto que não existe entre seus protagonistas.');
    const quote = normalized(shot.quote);
    if (!quote || !(` ${source} `).includes(` ${quote} `)) reject('A fala citada não pertence ao texto original.');
    if (!timing) {
      const at = (` ${source} `).indexOf(` ${quote} `, sourceOffset);
      if (at < 0) reject('Os planos inverteram ou repetiram uma fala do roteiro.');
      sourceOffset = at + quote.length + 1;
    }
    let start = shot.start, end = shot.end;
    if (timing) {
      const first = shot.firstWord;
      const next = plan.shots[index + 1]?.firstWord;
      if (first === undefined || first >= timing.words.length || index === 0 && first !== 0 || index > 0 && first <= (plan.shots[index - 1].firstWord ?? -1))
        reject('Os planos precisam seguir os índices das palavras fornecidas.');
      if (!(` ${normalized(timing.words.slice(first).map(w => w.text).join(' '))} `).startsWith(` ${quote} `))
        reject('A fala citada não começa na palavra indicada.');
      start = index === 0 ? 0 : timing.words[first].start;
      end = next === undefined ? timing.duration : timing.words[next]?.start;
      if (shot.start !== undefined && Math.abs(shot.start - start) > .02 || shot.end !== undefined && end !== undefined && Math.abs(shot.end - end) > .02)
        reject('O plano inventou segundos diferentes dos tempos fornecidos.');
    } else if (shot.firstWord !== undefined) reject('Índices de palavras exigem tempos de fala fornecidos.');
    if (start === undefined || end === undefined || end <= start || end - start < .45 || end > plan.duration)
      reject('Intervalo de plano inválido ou curto demais.');
    return { ...shot, start, end };
  });
  for (let i = 0; i < shots.length; i++) {
    const expected = i === 0 ? 0 : shots[i - 1].end;
    if (Math.abs(shots[i].start - expected) > .001) reject('Os planos têm lacuna, sobreposição ou estão fora de ordem.');
  }
  if (Math.abs(shots[shots.length - 1].end - plan.duration) > .001) reject('A direção não chega ao final do clipe.');
  return { ...plan, shots, lessonVersion: DIRECTOR_LESSON_VERSION };
}

/** Lessons extracted from the reviewed HTML/SVG production and garden summary. */
export function animationDirectionLessons(): string {
  return `MÉTODO DE DIREÇÃO ${DIRECTOR_LESSON_VERSION}
- Preserve as palavras e a ordem do roteiro. Uma ação protagonista por vez: estado inicial, antecipação, montagem/ação, assentamento e consequência visível.
- Mostre o verbo: montar = peças rígidas encaixando; guardar chuva = calha levando água ao reservatório; produzir = objeto sendo feito. Zoom e texto não substituem esses acontecimentos.
- Um objeto informacional grande por plano. Contexto, detalhe da ação e resultado usam os mesmos objetos persistentes. Etiquetas curtas e palavras simples; não copie o tema dos exemplos para um pedido diferente.
- Separe posicionamento e animação em grupos pai/filho. No SVG o translate fixo fica no grupo externo; em Three.js o grupo externo guarda a posição de montagem e o interno guarda a peça móvel. Nunca sobrescreva um posicionamento fixo por acidente.
- Use a linha do tempo absoluta compartilhada por fala, câmera, peças e legendas. Tempos planejados são estimativas; somente tempos de fala fornecidos podem ser usados como alinhamento. Nada de animação acumulada quadro a quadro.
- Mude a câmera na fronteira da ação; fixe um ângulo legível por plano, mantenha a peça ativa inteira e reserve a faixa inferior para legendas. Confirme início, encaixe, transição e resultado.
- Montagem: apoios antes da estrutura, estrutura antes do fechamento, funcionamento depois do encaixe. A peça preserva dimensões e chega à pose final real; não surge inteira no lugar nem fica esticada.
- Revisão real do primeiro pedido: detalhes ficaram próximos demais e cortaram peças. Calcule o enquadramento com tools.fitCameraToObjects(camera,[gruposDosProtagonistas],{direction:[.65,.7,1],margin:.12,captionReserve:.2}) UMA vez por plano, com as peças na pose montada, antes de aplicar os movimentos. Guarde position/target retornados e use-os no renderAt; não recalcule a câmera seguindo o volume das peças que estão voando. O helper calcula cabimento, não oclusão: escolha uma direção que mostre a ação.
- Na mesma revisão, a água ficou escondida dentro de um tanque opaco e os painéis ficaram quase pretos. Mostre o trajeto da água em um tubo com corte visível, ou gotas chegando ao reservatório. Dê aos painéis cor legível, grade de células e luz de preenchimento. Um estado interno invisível não demonstra funcionamento na imagem.
- Exemplo de direção, não história obrigatória: horta vazia -> tábuas, terra e mudas -> canteiro pronto; reservatório em peças -> corpo, tampa e conexão -> água chegando; telhado vazio -> módulos solares encaixam -> conjunto funcionando.
- Para explicações com valores, acompanhe o MESMO objeto e use só números fornecidos. Receita, custo e sobra aparecem na etapa correspondente, sem inventar alegações ou prometer renda.
- O plano é uma intenção verificável, não uma aprovação visual. Só o render real permite avaliar enquadramento, contatos e clareza; preserve erros em vez de declarar que a IA aprendeu sozinha.`;
}

export function directionPrompt(script: string, timing?: NarrationTiming): string {
  const checked = timing === undefined ? undefined : narrationTimingSchema.parse(timing);
  return `${animationDirectionLessons()}

PARTITURA OBRIGATÓRIA NA MESMA RESPOSTA (sem segunda chamada)
Comece o bloco JavaScript com um comentário JSON estrito, antes de function createScene:
/*${DIRECTION_MARKER}
{"version":1,"duration":10,"timing":"planned","objects":[{"id":"objeto","description":"objeto pedido pelo usuário","parts":["base","corpo","tampa"]}],"shots":[{"id":"montagem","start":0,"end":10,"quote":"trecho literal do roteiro","subjects":["objeto"],"focus":"objeto","camera":"detail","action":"as peças rígidas encaixam em sequência","before":"objeto desmontado","after":"objeto montado e funcionando"}]}
*/
O exemplo mostra o FORMATO, não o conteúdo. Escolha 1 a 6 planos adequados ao pedido e preencha todos os campos. camera aceita apenas wide, medium, detail ou result. Planos cobrem de 0 até duration, sem lacunas nem sobreposição. quote deve ser trecho literal da fonte. subjects/focus usam IDs de objects; parts são IDs persistentes das peças.
O servidor valida o comentário e injeta const DIRECTOR_SCORE com a partitura normalizada antes do seu programa. NÃO declare DIRECTOR_SCORE. Seu código DEVE ler DIRECTOR_SCORE.shots e usar seus start/end para as ações e a câmera; duration deve ser DIRECTOR_SCORE.duration. Nenhuma função adicional de planejar ou gerar vídeo existe no runtime.
Para montagem, use tools.createAssemblyPart(objeto,{start:plano.start,end:plano.end,fromPosition:[x,y,z],fromRotation:[rx,ry,rz]}). Defina primeiro a pose final local do objeto, então crie o controlador UMA vez em createScene. Chame controlador.apply(t) em renderAt. Ele preserva a escala e volta à mesma pose quando o tempo é buscado fora de ordem. Escalone start/end das peças dentro do plano e deixe tempo para ver o resultado; não termine todas no último quadro.
${checked ? `TEMPOS DE FALA FORNECIDOS (dados imutáveis): duração=${checked.duration}. Use timing:"provided". Em cada plano emita firstWord (índice da primeira palavra, primeiro plano = 0), em vez de start/end. O motor deriva start dessa palavra e end da primeira palavra do próximo plano, ou da duração. quote começa exatamente em firstWord. A fala é a fonte de quote; o roteiro continua definindo os objetos e ações. Palavras: ${JSON.stringify(checked.words.map((w, index) => ({ index, ...w })))}` : 'SEM TEMPOS DE ÁUDIO: use timing:"planned", duration entre 8 e 20, e start/end explícitos. Não afirme sincronização medida nem invente narração.'}
ROTEIRO PARA CONFERIR A PARTITURA: ${JSON.stringify(script.slice(0, 1200))}`;
}

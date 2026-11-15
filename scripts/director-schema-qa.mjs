/** Validate the actual provider schema against independent good/bad output fixtures. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';

const out = 'tmp/director-schema-qa';
await fs.mkdir(out, { recursive: true });
await fs.writeFile('tmp/director-schema-qa-entry.ts', `export { directionSchema } from '../src/studio/server/directionContract';
export { sourceBeats } from '../src/studio/server/grounding';
export { buildFallbackPlan } from '../src/studio/explainer/plan';`);
await build({ configFile: false, build: { ssr: path.resolve('tmp/director-schema-qa-entry.ts'), outDir: path.resolve(out, 'bundle'), emptyOutDir: true,
  rolldownOptions: { output: { entryFileNames: 'index.js', inlineDynamicImports: true } } }, ssr: { noExternal: true } });
const { directionSchema, sourceBeats, buildFallbackPlan } = await import(pathToFileURL(path.resolve(out, 'bundle/index.js')).href);
const fixtures = [];
const add = (name, script, good, bad = []) => fixtures.push({ name, schema: directionSchema(sourceBeats(script)), good, bad });
add('nullable-acting-and-enums', 'Eu sou o maior jogador do mundo hahahaha', {
  scenes: [{ sourceId: 's1', visual: 'character', story: null, staging: null, setting: null, presenterPose: null }], production: null,
}, [{ scenes: [{ sourceId: 's1', visual: 'character', staging: { action: 'laugh' } }] }]);
add('source-order-and-negation', 'Ana correu pela rua. Bruno nunca correu.', {
  scenes: [{ sourceId: 's1', visual: 'character', staging: { action: 'run' } }, { sourceId: 's2', visual: 'character', staging: { action: 'wait' } }],
}, [
  { scenes: [{ sourceId: 's1', visual: 'character', staging: { action: 'wait' } }, { sourceId: 's2', visual: 'character', staging: { action: 'run' } }] },
  { scenes: [{ sourceId: 's2', visual: 'character', staging: { action: 'wait' } }, { sourceId: 's1', visual: 'character', staging: { action: 'run' } }] },
]);
const script = 'O guindaste ergue uma carga.';
const complete = { scenes: [{ sourceId: 's1', visual: 'custom', staging: null, story: null }], production: buildFallbackPlan(script).production };
const unknownMovement = structuredClone(complete); unknownMovement.production.tracks[0].channel = 'fly';
add('complete-production-graph', script, complete, [unknownMovement]);
add('legacy-drawing-shapes', 'Uma ideia ganhou forma.', {
  scenes: [{ sourceId: 's1', visual: 'custom', staging: null, drawing: Array.from({ length: 8 }, (_, i) => ({ type: 'circle', x: i * 20, y: 0, r: 5, anim: 'pop' })) }],
});
add('handoff-with-null-performance', 'Lia pega a lanterna e entrega para Caio.', {
  scenes: [{ sourceId: 's1', visual: 'custom', staging: null, story: { action: 'handoff', prop: 'lantern', performance: null, actors: [{ name: 'Lia' }, { name: 'Caio' }] } }], production: null,
});
const filename = path.join(out, 'fixtures.json'); await fs.writeFile(filename, JSON.stringify(fixtures));
execFileSync('python3', ['-c', `import json, sys
from jsonschema import Draft202012Validator
checks = 0
for case in json.load(open(sys.argv[1])):
    Draft202012Validator.check_schema(case['schema'])
    validator = Draft202012Validator(case['schema'])
    errors = list(validator.iter_errors(case['good']))
    assert not errors, case['name'] + ': ' + str(errors[0] if errors else '')
    checks += 1
    for invalid in case['bad']:
        assert list(validator.iter_errors(invalid)), case['name'] + ': invalid action/source accepted'
        checks += 1
    print('PASS schema:', case['name'])
print('PASS independent schema checks:', checks)
`, filename], { stdio: 'inherit' });

# CrieSeuVideo — continuidade técnica, 14/11/2026

## Base e integração

Base de produção examinada: `8ae1a1b7cfc22aaa08bf1d8969d54ce9c49a6cff`.
O histórico e o checkpoint `f8a6390` foram preservados.

A branch `work/continuity-2026-11-14` reúne os seguintes trabalhos previamente separados, com resolução dos conflitos de narração:

| Origem | Conteúdo preservado |
| --- | --- |
| `fix/narration-code-only` | Clips parciais, motor 2D/3D persistido, bloqueio de download durante geração |
| `fix/explainer-narration-cache-safety` / PR #3 | Recuperação de áudio apenas do cache; preferência e identidade da voz; exportação narrada exige todos os clips |
| `audit/export-format-safety` / PR #2 | Extensão e MIME reais de MP4/WebM; erro explícito sem suporte |
| `feat/semantic-3d-presenter-poses` / PR #4 | Gestos validados do apresentador e edição por cena |
| `feat/gemini-direct-text-provider` / PR #5 | Adaptador Gemini no servidor; ausência de fallback pago automático |

O PR #1 contém propostas já parcialmente incorporadas na main; não foi mesclado novamente. Não houve alteração da publicação Lovable.

## Correções adicionais

- O fallback local não corta a 41ª frase nem qualquer frase posterior.
- Normalização divide falas longas entre palavras em vez de cortar aos 400 caracteres.
- Divisões corretas da IA são mantidas, sem redistribuir palavras para ilustrações de outro assunto.
- O endpoint rejeita explicitamente roteiros acima de 6.000 caracteres antes da chamada de IA; também rejeita um token isolado acima de 400.
- Direção em chunks preserva números decimais, URLs, pontuação e ordem integral das palavras.
- Fila com duas chamadas em andamento, interrompendo novas etapas após falha de cota/provedor. Não há retry automático.
- Falhas e JSONs inválidos são expostos ao usuário. A direção não se disfarça de IA ao substituir o resultado por presets locais.
- A ação “Criar sem IA” é explícita, local e não pede voz.
- Gemini direto para texto não dispara automaticamente TTS no gateway Lovable.
- Narração acima de 500 caracteres retorna erro antes da chamada ao provedor; ElevenLabs não exige uma chave Lovable.
- Posição das nuvens 3D depende do tempo da cena, não de quantas vezes se desenhou o quadro.

## Laboratório privado

Os arquivos `lab/` usam os mesmos módulos de direção, normalização, Canvas 2D e Toon3D da aplicação principal.

- Ensaio local, reprodução, storyboard, formatos 9:16 e 16:9 e download do plano em JSON.
- Gemini direto no servidor, com chave em configuração protegida.
- A verificação de conexão consulta apenas o catálogo de modelos; não gera conteúdo.
- Direção real só começa após ação explícita no botão. Nenhuma rota de voz, vídeo por difusão ou acesso ao banco de produção é fornecida pelo laboratório.
- A configuração hospedada deve permanecer privada ao proprietário. O bloqueio local por isolate é apenas uma proteção adicional e não um rate limiter global/durável.
- `node lab/build.mjs` constrói o frontend e o Worker em `dist/server/index.js`; `npx tsc --noEmit -p lab/tsconfig.json` verifica seus tipos. `lab/generated/` é descartável e ignorado pelo Git.

## Evidências e limites

- `npm test`: 102 testes em 22 arquivos, aprovados, sem chamadas reais de geração.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado, com avisos existentes de chunks grandes e APIs descontinuadas.
- Build e checagem de tipos do laboratório: aprovados.
- Navegador: prévia 2D observada; ensaio com 65 frases manteve as 65 cenas e a última frase, inclusive em 16:9.
- WebGL está desativado no navegador de teste. A queda explícita para 2D foi observada, mas isso não valida a aparência do Toon3D.
- O laboratório privado foi disponibilizado. A configuração hospedada respondeu HTTP 200 com Gemini configurado e voz desativada; a consulta ao catálogo Google respondeu HTTP 200 e confirmou a disponibilidade do modelo. Nenhum conteúdo foi gerado nesta verificação.
- Geração real Gemini, narração real, arquivo de vídeo final e reprodução no Android não foram homologados nesta etapa.

A direção ainda usa um repertório limitado de desenhos e gestos. Este trabalho corrige integridade e observabilidade; não promete transformar o apresentador/lousa num gerador universal de ações cinematográficas. A próxima etapa de qualidade precisa comparar renders reais com referências e ampliar as ações/composições de forma medida.

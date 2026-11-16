# CrieSeuVideo — plano de execução para a primeira animação 3D inédita pelo Gemini

Data: 16/11/2026. Este trabalho continua em branches e PRs privados. Nenhuma alteração aplicada ao site publicado ou banco remoto.

## Diagnóstico confirmado no código

- O SceneProgram já contém geometrias novas, hierarquias, câmeras, keyframes, testes de movimento e validações de contatos. Os modelos GLB podem ser carregados de um catálogo de assets autorizados.
- A cena do liquidificador foi PROGRAMADA MANUALMENTE: prova que o renderer gera MP4 3D, não que o Gemini cria uma história sozinho.
- O editor real foi testado no Chromium: responde a um programa gerado como fixture, preserva a prévia anterior diante de erro HTTP 503, rejeita um programa com campo JavaScript e oferece correção somente após clique.
- Falta testar uma cena inédita usando a API REAL do Gemini e avaliar o vídeo visualmente, não apenas os testes de código.

## Principal risco descoberto

A rota HTTP /api/ai/explainer-plan anterior não tinha uma autorização especial nem cota para geração livre. Uma chave de Gemini numa rota pública sem limite poderia ser usada por qualquer visitante, com cobranças/cotas inesperadas. Google AI Pro de consumidor não garante gratuidade da API.

## Nova proteção introduzida na branch

1. FREEFORM_3D_ENABLED somente permite geração real se for exatamente true; por padrão é desligado.
2. FREEFORM_3D_OWNER_USER_ID deve corresponder à identidade verificada no Supabase Auth. Não basta informar o ID; um JWT deve ser validado pelo servidor.
3. FREEFORM_3D_DAILY_LIMIT aceita 1 a 3 chamadas por dia UTC; o padrão é 1. Uma correção solicitada manualmente também consome uma chamada.
4. Migração SQL 0002_freeform_3d_daily_quota.sql prepara uma RPC que reserva cota de forma atômica num banco persistente. Não aplicá-la à base principal antes de autorização. Falhas na RPC bloqueiam geração.
5. O navegador só envia o token de sessão; o segredo GEMINI_API_KEY fica exclusivamente no servidor. Nenhum fallback automático para Lovable ou fal.
6. O editor ainda não possui login público universal: antes de homologar será necessário confirmar uma sessão Supabase válida e, se preciso, habilitar entrada de conta.

Outros endpoints pagos legados também merecem endurecimento antes do lançamento público; este PR protege especificamente a criação livre 3D.

## Ambiente de homologação — nunca configurar chaves no chat

Variáveis privadas do servidor: FREEFORM_3D_ENABLED=false; FREEFORM_3D_OWNER_USER_ID=UUID do proprietário; FREEFORM_3D_DAILY_LIMIT=1 ou 2; GEMINI_API_KEY=credencial atual em Secret; GEMINI_TEXT_MODEL=gemini-3.6-flash; SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY de homologação.

Revisar e aplicar a migração da quota SOMENTE numa base de homologação. A tabela tem RLS e não concede acesso a usuários normais. Verificar manualmente a autenticação e uma tentativa acima do limite antes de liberar a API.

## Primeiro teste REAL — um pedido, sem retry

A ferramenta scripts/controlled-gemini-3d-trial.ts é offline por padrão; executá-la sem confirmação não produz chamadas ao Google. Com autorização explícita para eventual cobrança de UMA chamada, a ferramenta pode receber a chave via Secret e a variável CONFIRM_ONE_GEMINI_CALL=I_APPROVE_ONE_CALL.

Roteiro experimental (não programado previamente): Uma pequena turbina eólica recebe uma rajada de vento. Suas pás começam a girar, aceleram e depois param.

O diretor deve devolver nós e geometria criados pela IA, movimento das pás e câmera. O script salvará apenas o plano validado e o relatório sem credenciais; nenhuma voz e nenhuma geração extra são solicitadas.

## Provas exigidas para chamar de sucesso

- Fidelidade ao roteiro, sem trocar frases ou eventos.
- Turbina reconhecível e indicação visual do vento; pás inicialmente paradas, depois acelerando e finalmente parando.
- Nenhum código externo executado e nenhum fallback para uma imagem fixa ou apresentador.
- Repetição determinística do movimento após voltar a timeline.
- Capturas reais do WebGL em pelo menos 3 instantes, avaliação humana da coerência e contatos.
- MP4 vertical de aproximadamente 8 segundos com início, meio e fim, verificando duração, codec, quadros e reprodução móvel.
- Exatamente 1 geração autorizada, zero chamadas automáticas, nenhuma TTS comprada.

Se o Gemini rejeitar ou não entregar um resultado bom, documentar a falha e solicitar autorização separada antes de outra chamada.

## Evolução depois da prova

1. Ampliar roteiro experimental para uma flor abrindo pétalas, pistões e fenômenos naturais.
2. Avaliador visual a partir de quadros, não apenas propriedades numéricas.
3. Rigging e interação de animais, física e contatos corporais; essas capacidades ainda são parciais.
4. Integrar com segurança PRs empilhados do Work, mudanças recentes da main e trabalho 2D do Claude.
5. Antes de produção pública, aplicar autenticação/cotas também a rotas legadas de IA e narração, realizar testes Android e revisar custos.

Não fazer merge, publicar, migrar produção, habilitar secrets ou gastar créditos sem aprovação.

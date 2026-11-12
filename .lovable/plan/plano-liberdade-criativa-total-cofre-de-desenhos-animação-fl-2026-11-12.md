# Plano: Liberdade criativa total + Cofre de desenhos + Animação fluida

Sem cenas duras: a IA continua livre para desenhar qualquer coisa, mas com peças melhores, regras de acabamento e memória do que já criou.

## 1. Corrigir a pizzaria que volta sozinha
- Ao abrir, carrega o último projeto real; se não houver, tela em branco.
- Autosave só depois que você digitar, ditar ou gerar.
- Excluir limpa a tela na hora, sem re-salvar.

## 2. Cofre de desenhos (reuso automático)
- Todo desenho gerado é guardado automaticamente com etiquetas (carro, celular, balança, escritório...).
- Antes de desenhar, a IA recebe a lista do cofre e reaproveita ou adapta o que já existe (custo quase zero).
- Só desenha do zero o que é inédito. A galeria manual continua existindo.

## 3. Vocabulário maior para a IA (liberdade sem quebrar)
- Novas peças prontas e polidas que a IA combina livremente: celular com chat (balões e check azul), notebook com site, mapa com pino, balança com pêndulo, gráfico, moedas, relógio, selo/carimbo, X vermelho, mãos (apontar, segurar), animais, multidão simples, skyline com carros.
- Personagem em modo busto com mais expressões (sobrancelhas, olhar que segue o objeto, boca na fala); corpo inteiro só quando a cena pede.
- A IA ainda pode criar formas livres, mas o herói da cena ocupa 60–70% da tela.

## 4. Acabamento uniforme
- Contorno escuro único proporcional ao tamanho, cantos arredondados, sombra sólida de carimbo em tudo.
- Fundo sunburst girando com cor pela emoção da frase, além dos cenários existentes.

## 5. Movimento fluido
- Mola real (overshoot elástico) em todas as entradas; selos entram inclinados como carimbo.
- Câmera viva: micro-zoom contínuo, tremor em impactos, zoom/pan rápido com desfoque entre cenas.
- Regra de alternância: a IA nunca repete o mesmo tipo de plano em cenas seguidas (close, objeto herói, mockup, metáfora, plano aberto).

## Ordem
1. Bug da pizzaria → 2. Mola + câmera → 3. Novas peças + busto + acabamento → 4. Cofre de desenhos → 5. Teste visual com roteiro real.

## Detalhes técnicos
- ExplainerStudio.tsx (init/autosave), library.ts (vault com tags), render.ts (spring, câmera, novas peças, busto), layout.ts (herói 60–70%), drawing.ts (novos tipos + guia), api/ai/explainer-plan.ts (catálogo do vault no prompt, alternância).
- Testes vitest para mola, vault e init; Playwright para checagem visual.

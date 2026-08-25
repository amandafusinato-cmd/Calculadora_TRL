# Calculadora de TRL

Aplicação web (HTML/CSS/JS puro, sem dependências e sem back-end) que reproduz a lógica da
planilha **"Calculadora TRL"** em uma interface mais amigável, com resultado calculado
automaticamente e um relatório pronto para impressão/PDF.

## Como usar

Abra `index.html` diretamente no navegador ou publique a pasta em qualquer serviço de
hospedagem estática (GitHub Pages, Netlify, etc). Não há build nem instalação de pacotes.

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

Todas as respostas ficam salvas apenas no `localStorage` do navegador do usuário — nenhum
dado é enviado a um servidor.

## Metodologia

A calculadora segue a mesma base da planilha original: **ABNT NBR ISO 16290:2015**, com
critérios adicionais institucionais adaptados de ROCHA, D. (2016) — *"Uma adaptação da Norma
NBR ISO 16290:2015 aplicada em projetos do setor Aeroespacial"* (ITA).

Para cada um dos 9 níveis de TRL existem dois tipos de critério, ambos respondidos com o
mesmo controle de três estados — **Sim** (100 pontos) / **Parcial** (50) / **Não** (0):

- **N — critérios NBR ISO 16290:2015**, marcados com o selo **★ mandatório**: são
  essenciais para caracterizar o nível.
- **I — critérios institucionais adicionais**: contam para a nota do nível, mas não
  bloqueiam sozinhos o avanço.

**Nota do nível** = média de todos os critérios do nível (Sim/Parcial/Não → 100/50/0).

**Bloqueio por critério mandatório:** um nível só pode ser avançado (botão "Próximo
nível") quando **todos** os critérios ★ mandatórios estiverem respondidos como **Sim**.
Um único mandatório em Parcial, Não, ou ainda não respondido, trava o avanço com um
alerta específico — independentemente da nota do nível.

**Tolerância mínima:** além disso, a nota do nível (incluindo os critérios adicionais)
precisa atingir a tolerância mínima definida em "Dados" (33% por padrão, mesmo valor
usado na planilha original) para o nível ser considerado atendido.

A cada nível, um alerta contextual explica o estado atual: **★ Bloqueado** (mandatório
não atendido), **Em construção** (falta nota mínima ou respostas) ou **Atendido**. O
botão "Ver TRL atual (parcial)" permite conferir o resultado a qualquer momento, mesmo
com níveis incompletos.

Dois resultados são calculados na tela de resultado, ambos de forma **cumulativa** (um
nível só conta como atingido se todos os níveis anteriores também tiverem sido atingidos
— a maturidade tecnológica não "pula" etapas):

- **TRL com tolerância** — nível atingido quando os mandatórios estão satisfeitos **e**
  a nota do nível é maior ou igual à tolerância definida.
- **TRL ISO 16290 estrito** — nível atingido quando **todos** os critérios N (norma) do
  nível foram marcados como Sim, sem qualquer tolerância sobre os critérios adicionais.

> Nota sobre fidelidade à planilha original: as colunas de apoio "TRL ESPAÇO" e "TRL ISO" da
> planilha foram reimplementadas a partir da metodologia descrita nas abas "Início" e
> "MANUAL TRL" (que definem claramente os critérios N/I e a regra de tolerância). Uma
> inconsistência interna encontrada na fórmula auxiliar da coluna "TRL ISO" da planilha
> (que somava os critérios "I" em vez dos critérios "N") foi corrigida aqui para refletir o
> que a documentação da própria planilha descreve como resultado "somente dos critérios
> relacionados à Norma NBR ISO 16290:2015".

## Múltiplas réguas de maturidade

A calculadora não está presa à régua da NASA. Na tela "Dados" é possível trocar de
metodologia — cada uma define seus próprios níveis, agrupamentos e critérios, e as
respostas de cada uma ficam salvas separadamente (trocar de régua não apaga o que já foi
preenchido em outra):

- **NASA / ISO 16290** (padrão) — 9 níveis (TRL 1–9), com checklist detalhado de
  critérios ★ obrigatórios (NBR ISO 16290:2015) e adicionais (ROCHA, D. 2016).
- **API 17N (Subsea)** — 8 níveis (TRL 0–7), escala do American Petroleum Institute
  (Recommended Practice 17N, 2009) para tecnologia subsea, amplamente usada na indústria
  de óleo & gás. Cada nível tem uma única condição de atingimento (tratada como critério
  ★), conforme a "API 17 Technology Readiness Level Ladder" (fonte: API RP 17N;
  referência da escada: Astrimar) — essa régua não publica um checklist detalhado de
  subcritérios como a ISO 16290, por isso não foram inventados critérios adicionais.

Novas réguas podem ser adicionadas em `assets/questions.js`, no registro `FRAMEWORKS`,
sem alterar a lógica de cálculo em `app.js` (que é genérica para qualquer framework).

> MRL (Manufacturing Readiness Level) e IRL (Integration Readiness Level), mencionados no
> aviso metodológico do relatório, são métricas complementares — avaliam dimensões
> diferentes (fabricação e integração), não níveis alternativos da mesma régua de TRL —
> por isso não entram no seletor de metodologia, mas podem ser adicionadas como uma nova
> aba/relatório complementar se fizer sentido no futuro.

## Estrutura

```
index.html            Telas: Início, Dados, Avaliação, Resultado + relatório imprimível
assets/style.css       Estilo da interface e do relatório (inclui @media print)
assets/questions.js    Bancos de perguntas por metodologia (NASA/ISO e API 17N) + registro FRAMEWORKS
assets/app.js          Lógica de cálculo, navegação e geração do relatório
```

## Relatório

Na tela de resultado, o botão **"Gerar relatório"** monta uma versão formatada, no estilo de
relatórios institucionais de calculadoras de TRL (como o modelo usado pela vitrine
tecnológica da UFRGS), e aciona a impressão do navegador — o usuário pode imprimir em papel
ou salvar como PDF diretamente pelo diálogo de impressão. O relatório traz:

- Identificação (tecnologia, responsável, data, metodologia utilizada);
- Resultado com tolerância x leitura estrita, e a escada de maturidade;
- **Gráfico de qualidade da evidência por nível** — uma barra por nível, colorida por
  faixa (Forte ≥80%, Bom 60–79%, Parcial 40–59%, Fraco <40%, ou Bloqueado quando um
  critério ★ obrigatório não foi atendido, independentemente da nota);
- **Próximos passos** — identifica automaticamente o primeiro nível ainda não atingido na
  cadeia cumulativa e lista o que falta: o critério obrigatório pendente como prioridade,
  e os demais critérios não atendidos daquele nível como itens a considerar;
- Detalhamento por nível, comentários/evidências registrados e um aviso metodológico
  (natureza qualitativa do resultado, recomendação de complementar com MRL/IRL, e
  limitação de escopo do documento).

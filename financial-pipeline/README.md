# Pipeline financeiro (ISI SM) — protótipo

Reimplementa em código a lógica hoje feita manualmente na aba **"Gastos
Reais"** da planilha do painel, a partir das quatro fontes brutas descritas
no documento de contexto do projeto (`contexto-projeto-controle-financeiro.md`):
SESuite, FIN, Atualizações e Previsões. Este é o "próximo passo sugerido"
daquele documento — um protótipo para validar a lógica antes de avançar
para banco de dados / site / app.

Nenhum dado real de projeto (planilhas de origem, valores, nomes de
fornecedor/requisitante) faz parte deste repositório — só o código do
pipeline e testes com dados sintéticos.

## O que o pipeline faz

1. **Solicitações** (`build_solicitacoes`) — uma linha por `Identificador`
   do SESuite, com a camada de override da aba Atualizações aplicada
   (`previsao_entrega_final`), sem apagar a data original do bot.
2. **Realizado** (`build_realizado`) — soma o FIN por Identificador
   (excluindo linhas `"Saldo"`), tratando corretamente o 1:N do
   parcelamento, e marca `tem_nf` para quem tem pelo menos um pagamento com
   `Número do documento` preenchido.
3. **Resumos por Projeto x Ano-Mês** — `build_comprometido_summary`
   (Status `AF EMITIDA`/`ENTREGUE`), `build_realizado_summary` e
   `build_previsto_summary` (a partir da aba `Previsoes`, sem join de linha
   com as demais fontes — orçamento puro, por design).
4. **Painel consolidado** (`build_panel`) — junta os três resumos numa
   tabela Projeto x Ano-Mês, equivalente ao que alimenta os gráficos
   "Previsto vs Realizado (Financeiro)" e a Curva-S do painel atual.
5. **Comparação com a planilha manual** (`compare_with_manual`) — mede, por
   Identificador, se o valor comprometido e o realizado calculados batem
   com o que está hoje na aba `Gastos Reais`. Usada para validar a lógica,
   não para reproduzir a aba manual coluna a coluna (colunas como `Tipo`,
   `Nacional/Importada` e o `Previsto` por linha vêm de categorização manual
   sem chave de join automática, e ficam fora do escopo deste protótipo).

## Uso

```bash
pip install -r requirements.txt

python -m financial_pipeline.cli ORIGEM.xlsx --out consolidado.xlsx
python -m financial_pipeline.cli ORIGEM.xlsx --out consolidado.xlsx --compare-manual PAINEL.xlsx
```

- `ORIGEM.xlsx`: arquivo com as abas `Previsoes`, `Aquisições - SESuite`,
  `Atualizações - Entregas e datas`, `FIN - Pagamentos (Nacionais)` e
  `Realizado (Razão)` (mesmo formato de `Gastos reais, aquisições e
  viagens.xlsx`).
- `PAINEL.xlsx` (opcional, para `--compare-manual`): arquivo com uma aba
  `Gastos Reais` no formato atual (mesmo formato de `Curva_S_RTs2.xlsx`).

`consolidado.xlsx` sai com duas abas: `Solicitacoes` (uma linha por
Identificador, com valor comprometido e realizado) e `Painel financeiro
mensal` (Previsto x Comprometido x Realizado por Projeto/mês).

## Testes

```bash
python -m pytest tests/
```

Os testes usam apenas dados sintéticos (nenhuma planilha real) e cobrem as
regras do documento de contexto: exclusão de linhas `"Saldo"` do FIN,
override de data sem perda do dado original, filtro de Status para
comprometido, e soma correta do 1:N do FIN.

## Validação contra a planilha manual

Rodar `--compare-manual` contra o par de arquivos reais confirma que a
lógica documentada está no caminho certo, com dois achados que valem
decisão antes de trocar a planilha manual pelo pipeline:

- **Comprometido**: a grande maioria dos Identificadores bate dentro de
  centavos; o resíduo se explica por diferenças de "foto" no tempo entre a
  exportação do SESuite e a última edição manual da aba, além de alguns
  valores digitados à mão na planilha manual (inclusive um "Chamado" não
  numérico, tratado pelo pipeline como sem correspondência em vez de
  quebrar o join). Não há um problema estrutural na lógica de Comprometido.
- **Realizado**: aqui a definição do documento de contexto (linha do FIN
  com `Número do documento` preenchido, ou seja, pagamento com NF lançado
  no FIN) diverge da prática atual na planilha manual — lá, `Preço
  realizado (chegada da NF)` na prática segue o `Status` do SESuite
  (praticamente sempre igual a `Preço Total` quando `Status = ENTREGUE`),
  o que é mais próximo de "NF chegou fisicamente" do que "pagamento
  lançado no FIN". As duas leituras respondem perguntas diferentes
  (chegada da mercadoria/NF vs. pagamento efetivamente processado) e a
  planilha manual hoje usa a primeira. **Antes de trocar a planilha por
  este pipeline, vale decidir explicitamente qual das duas definições de
  "Realizado" o painel deve mostrar** — `build_realizado`/`tem_nf` já
  isola a informação de origem (FIN) para ambos os casos; usar `Status ==
  "ENTREGUE"` do SESuite em vez de `tem_nf` reproduziria a definição atual
  da planilha manual, caso essa seja a intenção.

## Estrutura

```
financial_pipeline/
  sources.py   Leitura das 5 abas de origem, com normalização de tipos
  build.py     Solicitações, Realizado, e os três resumos + painel
  compare.py   Comparação com a aba "Gastos Reais" manual
  cli.py       Interface de linha de comando
tests/
  test_build.py   Testes com dados sintéticos
```

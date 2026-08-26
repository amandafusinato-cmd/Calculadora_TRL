# Contexto do projeto: Controle financeiro de projetos (ISI SM)

Este documento resume o desenho já validado em conversa com o Claude no chat, para servir de ponto de partida ao abrir o Claude Code neste projeto. Cole este arquivo (ou peça pro Code ler `contexto-projeto-controle-financeiro.md`) como primeira mensagem da sessão.

## Objetivo

Substituir o processo manual de controle financeiro de projetos (hoje uma planilha "Gastos Reais" digitada linha a linha, ~1700 linhas) por um pipeline automatizado que consolida dados de três bots + entradas manuais, alimentando um painel (hoje em Looker Studio, arquivo `Curva_S_RTs2.xlsx`) com a visão Previsto x Comprometido x Realizado por projeto/unidade.

## Fontes de dados hoje disponíveis

Arquivo de referência: `Gastos_reais__aquisições_e_viagens_2.xlsx`

| Aba | Origem | O que é | Chave |
|---|---|---|---|
| `Aquisições - SESuite` | Bot 1 | Todo chamado aberto no SESuite. 5.769 linhas, **Identificador é único** por linha. | `Identificador` |
| `FIN - Pagamentos (Nacionais)` | Bot 2 | Pagamentos/NFs do sistema FIN. **Um Identificador pode ter várias linhas** (965 de 3.195 IDs têm mais de uma — parcelamento é normal). | `Identificador` (1:N) |
| `Atualizações - Entregas e datas` | Manual | Camada de override: permite sobrescrever a data prevista de entrega e registrar a data/valor real quando necessário, sem apagar o dado original do bot. | `Identificador` |
| `Previsoes` | Manual | Orçamento previsto, no nível de item (não agregado por mês): Projeto, Descrição, Tipo, Data prevista, Valor previsto. | Sem chave de join com as demais — é solto por design |
| `Realizado (Razão)` | Bot 3 (planilha de caixa oficial) | O que de fato já saiu do caixa do projeto. Tem delay grande. **Não tem Identificador** — só projeto/rubrica/pessoa/valor/data contábil. | Sem join direto — usar como checagem agregada por projeto/período, não linha a linha |
| `Rubricas` | Lista de apoio | Categorias de despesa. | — |

Arquivo do painel atual: `Curva_S_RTs2.xlsx`, aba `Gastos Reais` — é a tabela consolidada manual que queremos automatizar. As demais abas desse arquivo (`Projetos - financeiro`, `Geral - chamados`, `Projetos - chamados`, `Tabela_dados`) são agregações via `SUMIFS` em cima dela e alimentam o painel Looker Studio — a lógica de agregação pode ser reaproveitada.

## Modelo de dados proposto

Entidade central: **Solicitação**, uma linha por `Identificador`, enriquecida progressivamente:

1. **Origem SESuite**: Identificador, requisitante, projeto/unidade, data abertura, comprador, data de análise, valor (`Valor R$`), `previsao_entrega`, `Status` (`CHAMADO ABERTO` → `AF EMITIDA` → `ENTREGUE`)
2. **Origem Atualizações** (override): se existir linha para o Identificador, `Data de Entrega Prevista - Atualizada` substitui `previsao_entrega` do SESuite nos cálculos e exibições — mas o valor original do bot nunca é apagado, fica preservado para auditoria.
3. **Origem FIN** (1:N): cada linha é um pagamento/NF vinculado ao Identificador. **Excluir linhas onde `Número do FIN = "Saldo"`** — são linhas de saldo residual, não pagamentos reais, e contá-las duplica valor.

## As três métricas

- **Previsto**: vem da aba `Previsoes` (manual, item a item). Sem join automático com as outras fontes — é orçamento puro. Possível evolução futura: tentar casar por Descrição/Projeto para medir taxa de conversão previsto → comprometido.
- **Comprometido**: soma de `Valor R$` do SESuite por Projeto/CR, dentro do período definido por `previsao_entrega` (ou pela data de override, quando existir). Inclui `AF EMITIDA` e `ENTREGUE`.
- **Realizado**: join `SESuite.Identificador = FIN.Identificador`, somando `Valor Líquido a Pagar` do FIN (excluindo linhas "Saldo"), para Identificadores que têm pelo menos uma linha de FIN com `Número do documento` preenchido (isto é, tem NF).
- **Pago** (lente adicional, mais lenta): checagem agregada por projeto/período contra `Realizado (Razão)`, sem join linha a linha.

## Regras e pegadinhas já identificadas

- Um Identificador do SESuite pode ter N linhas no FIN (parcelamento) — não assumir 1:1.
- Filtrar linhas `"Saldo"` na coluna `Número do FIN` antes de somar valores.
- `Realizado (Razão)` não tem Identificador — não forçar join linha a linha, tratar como fonte de conferência agregada.
- A data de entrega prevista precisa ser editável por pessoas, sem perder o dado original do bot — usar sempre a lógica de override, nunca sobrescrever a coluna original.
- Datas em algumas colunas do SESuite vêm como texto (ex: `13/06/2023`) em vez de datetime — checar tipos ao importar.

## Próximo passo sugerido

Prototipar um script (Python, ex. `pandas` + `openpyxl`) que:
1. Lê as três fontes brutas (SESuite, FIN, Atualizações, Previsoes)
2. Aplica os filtros e joins acima
3. Gera uma tabela consolidada equivalente à aba `Gastos Reais`
4. Compara com a versão manual existente para validar se a lógica bate antes de avançar para banco de dados / site / app

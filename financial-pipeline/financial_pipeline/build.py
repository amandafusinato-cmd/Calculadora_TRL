"""Construção da tabela de Solicitações e dos resumos Previsto x Comprometido
x Realizado, seguindo o modelo de dados descrito no documento de contexto.
"""

from __future__ import annotations

import pandas as pd

# Status do SESuite que contam como "comprometido" (ver documento de
# contexto: "Inclui AF EMITIDA e ENTREGUE").
COMPROMETIDO_STATUS = {"AF EMITIDA", "ENTREGUE"}

# Linhas de FIN com este valor em "Número do FIN" são saldo residual, não
# pagamento real — sempre excluídas antes de somar (ver "Regras e
# pegadinhas" no documento de contexto).
FIN_SALDO_MARKER = "Saldo"


def _ano_mes(series: pd.Series) -> pd.Series:
    """Reduz uma coluna de datas ao período Ano-Mês (ex.: '2026-05')."""
    return series.dt.to_period("M").astype(str)


def build_solicitacoes(sesuite: pd.DataFrame, atualizacoes: pd.DataFrame) -> pd.DataFrame:
    """Uma linha por Identificador do SESuite, com a camada de override.

    `atualizacoes` pode sobrescrever a data de entrega prevista e registrar
    entrega/valor real por fora do bot, sem apagar o dado original — as duas
    colunas de data ficam lado a lado, e `previsao_entrega_final` é a que os
    demais cálculos devem usar.
    """
    override = atualizacoes.rename(
        columns={
            "Data de Entrega Prevista - Atualizada": "previsao_entrega_override",
            "Data de Entrega (NF)": "data_entrega_nf_override",
            "Valor Real (R$)": "valor_real_override",
        }
    )

    solicitacoes = sesuite.merge(override, on="Identificador", how="left")
    solicitacoes["previsao_entrega_final"] = solicitacoes["previsao_entrega_override"].combine_first(
        solicitacoes["previsao_entrega"]
    )
    return solicitacoes


def build_realizado(solicitacoes: pd.DataFrame, fin: pd.DataFrame) -> pd.DataFrame:
    """Enriquece `solicitacoes` com o valor realizado (pago com NF) via FIN.

    Um Identificador pode ter várias linhas de FIN (parcelamento) — todas as
    linhas válidas (excluindo "Saldo") são somadas por Identificador antes do
    join, então a agregação nunca duplica pagamentos.
    """
    pagamentos = fin[fin["Número do FIN"] != FIN_SALDO_MARKER].copy()
    pagamentos_com_nf = pagamentos[pagamentos["Número do documento"].notna()]

    por_identificador = (
        pagamentos_com_nf.groupby("Identificador", as_index=False)
        .agg(
            valor_realizado=("Valor Líquido a Pagar (R$)", "sum"),
            qtd_pagamentos=("Número do FIN", "count"),
            data_pagamento=("Data Agendada para Pagamento", "max"),
        )
    )

    resultado = solicitacoes.merge(por_identificador, on="Identificador", how="left")
    resultado["valor_realizado"] = resultado["valor_realizado"].fillna(0.0)
    resultado["tem_nf"] = resultado["qtd_pagamentos"].fillna(0) > 0
    return resultado


def build_comprometido_summary(solicitacoes: pd.DataFrame) -> pd.DataFrame:
    """Comprometido por Projeto x Ano-Mês, no período de `previsao_entrega_final`.

    Inclui apenas chamados com Status AF EMITIDA ou ENTREGUE — um chamado
    ainda em "CHAMADO ABERTO" não é orçamento comprometido.
    """
    comprometido = solicitacoes[solicitacoes["Status"].isin(COMPROMETIDO_STATUS)].copy()
    comprometido = comprometido.dropna(subset=["previsao_entrega_final"])
    comprometido["ano_mes"] = _ano_mes(comprometido["previsao_entrega_final"])

    return (
        comprometido.groupby(["Projeto", "nome_projeto", "ano_mes"], as_index=False)
        .agg(
            valor_comprometido=("Valor R$", "sum"),
            qtd_chamados_comprometidos=("Identificador", "nunique"),
        )
    )


def build_previsto_summary(previsoes: pd.DataFrame) -> pd.DataFrame:
    """Previsto por Projeto x Ano-Mês, a partir da aba `Previsoes` (manual).

    Sem join de linha com as demais fontes por design — orçamento puro, item
    a item, agregado apenas por período para alimentar o painel.
    """
    dados = previsoes.dropna(subset=["Data Prevista de Recebimento"]).copy()
    dados["ano_mes"] = _ano_mes(dados["Data Prevista de Recebimento"])

    return (
        dados.groupby(["Projeto", "ano_mes"], as_index=False)
        .agg(
            valor_previsto=("Valor Previsto (R$)", "sum"),
            qtd_itens_previstos=("Descrição", "count"),
        )
    )


def build_realizado_summary(realizado: pd.DataFrame) -> pd.DataFrame:
    """Realizado por Projeto x Ano-Mês, no período de `previsao_entrega_final`.

    Usa a mesma data de referência do comprometido (não a data de pagamento)
    para que Comprometido e Realizado fiquem comparáveis mês a mês no painel.
    """
    dados = realizado[realizado["tem_nf"]].dropna(subset=["previsao_entrega_final"]).copy()
    dados["ano_mes"] = _ano_mes(dados["previsao_entrega_final"])

    return (
        dados.groupby(["Projeto", "nome_projeto", "ano_mes"], as_index=False)
        .agg(
            valor_realizado=("valor_realizado", "sum"),
            qtd_chamados_realizados=("Identificador", "nunique"),
        )
    )


def build_panel(
    previsto_summary: pd.DataFrame,
    comprometido_summary: pd.DataFrame,
    realizado_summary: pd.DataFrame,
) -> pd.DataFrame:
    """Junta os três resumos num painel único Projeto x Ano-Mês.

    Equivalente ao que alimenta os gráficos "Previsto vs Realizado
    (Financeiro)" e a Curva-S do painel: uma linha por Projeto/mês com as
    três métricas lado a lado (0 onde não houve movimento naquele mês).
    """
    projeto_cols = ["Projeto", "nome_projeto"]
    comp = comprometido_summary[[*projeto_cols, "ano_mes", "valor_comprometido", "qtd_chamados_comprometidos"]]
    real = realizado_summary[[*projeto_cols, "ano_mes", "valor_realizado", "qtd_chamados_realizados"]]

    painel = comp.merge(real, on=[*projeto_cols, "ano_mes"], how="outer")
    painel = painel.merge(
        previsto_summary.rename(columns={"Projeto": "nome_projeto"}),
        on=["nome_projeto", "ano_mes"],
        how="outer",
    )

    numeric_cols = [
        "valor_previsto",
        "valor_comprometido",
        "valor_realizado",
        "qtd_itens_previstos",
        "qtd_chamados_comprometidos",
        "qtd_chamados_realizados",
    ]
    for col in numeric_cols:
        painel[col] = painel[col].fillna(0)

    return painel.sort_values(["nome_projeto", "ano_mes"]).reset_index(drop=True)

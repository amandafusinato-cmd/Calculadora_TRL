"""Testes com dados sintéticos (sem nenhum dado real de projeto).

Cobrem as regras do documento de contexto: exclusão de linhas "Saldo" do
FIN, override de data de entrega sem perda do dado original, filtro de
Status para comprometido, e agregação 1:N do FIN sem duplicar valor.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from financial_pipeline.build import (  # noqa: E402
    build_comprometido_summary,
    build_panel,
    build_previsto_summary,
    build_realizado,
    build_realizado_summary,
    build_solicitacoes,
)


def _sesuite():
    return pd.DataFrame(
        {
            "Identificador": pd.array([1, 2, 3], dtype="Int64"),
            "nome_projeto": ["Projeto A", "Projeto A", "Projeto B"],
            "Projeto": [111, 111, 222],
            "Valor R$": [1000.0, 2000.0, 500.0],
            "previsao_entrega": pd.to_datetime(["2026-01-10", "2026-02-05", "2026-01-20"]),
            "Status": ["ENTREGUE", "AF EMITIDA", "CHAMADO ABERTO"],
        }
    )


def _atualizacoes():
    # Só o Identificador 2 tem override; 1 e 3 não aparecem na aba manual.
    return pd.DataFrame(
        {
            "Identificador": pd.array([2], dtype="Int64"),
            "Data de Entrega Prevista - Atualizada": pd.to_datetime(["2026-03-01"]),
            "Data de Entrega (NF)": pd.to_datetime([pd.NaT]),
            "Valor Real (R$)": [None],
        }
    )


def _fin():
    return pd.DataFrame(
        {
            "Identificador": pd.array([1, 1, 1, 2], dtype="Int64"),
            "Número do FIN": ["FIN.1", "FIN.2", "Saldo", "FIN.3"],
            "Número do documento": ["NF1", "NF2", None, "NF3"],
            "Valor Líquido a Pagar (R$)": [600.0, 400.0, None, 2000.0],
            "Data Agendada para Pagamento": pd.to_datetime(["2026-01-15", "2026-01-20", pd.NaT, "2026-03-05"]),
        }
    )


def test_override_preserves_original_and_wins():
    solicitacoes = build_solicitacoes(_sesuite(), _atualizacoes())

    row1 = solicitacoes[solicitacoes["Identificador"] == 1].iloc[0]
    row2 = solicitacoes[solicitacoes["Identificador"] == 2].iloc[0]

    # Sem override: usa a data original do SESuite.
    assert row1["previsao_entrega_final"] == pd.Timestamp("2026-01-10")
    # Com override: usa a data atualizada...
    assert row2["previsao_entrega_final"] == pd.Timestamp("2026-03-01")
    # ...mas o dado original do bot continua presente, não é apagado.
    assert row2["previsao_entrega"] == pd.Timestamp("2026-02-05")


def test_saldo_rows_excluded_and_multiple_payments_summed():
    solicitacoes = build_solicitacoes(_sesuite(), _atualizacoes())
    realizado = build_realizado(solicitacoes, _fin())

    row1 = realizado[realizado["Identificador"] == 1].iloc[0]
    # 600 + 400, a linha "Saldo" (sem Número do documento) não entra.
    assert row1["valor_realizado"] == 1000.0
    assert row1["qtd_pagamentos"] == 2
    assert row1["tem_nf"]

    row3 = realizado[realizado["Identificador"] == 3].iloc[0]
    assert row3["valor_realizado"] == 0.0
    assert not row3["tem_nf"]


def test_comprometido_excludes_chamado_aberto():
    solicitacoes = build_solicitacoes(_sesuite(), _atualizacoes())
    resumo = build_comprometido_summary(solicitacoes)

    # Identificador 3 está em CHAMADO ABERTO -> Projeto B não deve aparecer.
    assert "Projeto B" not in set(resumo["nome_projeto"])
    total_projeto_a = resumo[resumo["nome_projeto"] == "Projeto A"]["valor_comprometido"].sum()
    assert total_projeto_a == 3000.0


def test_realizado_summary_only_counts_paid_with_nf():
    solicitacoes = build_solicitacoes(_sesuite(), _atualizacoes())
    realizado = build_realizado(solicitacoes, _fin())
    resumo = build_realizado_summary(realizado)

    # Só o Identificador 1 (Projeto A, 2026-01) e o 2 (Projeto A, 2026-03,
    # via override) têm NF; o 3 não teve nenhum pagamento.
    assert set(resumo["ano_mes"]) == {"2026-01", "2026-03"}
    assert resumo["valor_realizado"].sum() == 1000.0 + 2000.0


def test_panel_combines_the_three_metrics_by_project_and_month():
    solicitacoes = build_solicitacoes(_sesuite(), _atualizacoes())
    realizado = build_realizado(solicitacoes, _fin())
    comprometido_summary = build_comprometido_summary(realizado)
    realizado_summary = build_realizado_summary(realizado)

    previsoes = pd.DataFrame(
        {
            "Projeto": ["Projeto A"],
            "Data Prevista de Recebimento": pd.to_datetime(["2026-01-01"]),
            "Valor Previsto (R$)": [5000.0],
            "Descrição": ["item x"],
        }
    )
    previsto_summary = build_previsto_summary(previsoes)

    painel = build_panel(previsto_summary, comprometido_summary, realizado_summary)

    linha_jan = painel[(painel["nome_projeto"] == "Projeto A") & (painel["ano_mes"] == "2026-01")].iloc[0]
    assert linha_jan["valor_previsto"] == 5000.0
    assert linha_jan["valor_comprometido"] == 1000.0
    assert linha_jan["valor_realizado"] == 1000.0

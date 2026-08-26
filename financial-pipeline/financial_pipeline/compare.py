"""Comparação do pipeline com a aba "Gastos Reais" (consolidação manual).

Serve para validar a lógica antes de trocar a planilha manual pelo pipeline:
mede, para os chamados que aparecem nas duas fontes, se o valor comprometido
e o valor realizado calculados batem com o que foi digitado manualmente.

Não é uma comparação linha-a-linha perfeita — a aba manual mistura chamados
do SESuite com lançamentos de viagem que não têm Identificador, e algumas
colunas dela (Tipo, Nacional/Importada, Previsto por linha) vêm de
categorização manual sem chave de join automática. Este módulo mede apenas
o que É automatizável: valor comprometido e valor realizado por chamado.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

TOLERANCIA_CENTAVOS = 0.01


@dataclass
class ComparisonReport:
    total_chamados_manual: int
    chamados_sem_correspondencia_no_pipeline: int
    chamados_comparados: int
    comprometido_batendo: int
    realizado_batendo: int
    delta_total_comprometido: float
    delta_total_realizado: float
    detalhe: pd.DataFrame

    def summary(self) -> str:
        pct_comp = (
            100 * self.comprometido_batendo / self.chamados_comparados if self.chamados_comparados else 0
        )
        pct_real = (
            100 * self.realizado_batendo / self.chamados_comparados if self.chamados_comparados else 0
        )
        return (
            f"Chamados na aba manual: {self.total_chamados_manual}\n"
            f"  sem correspondência no pipeline: {self.chamados_sem_correspondencia_no_pipeline}\n"
            f"  comparados: {self.chamados_comparados}\n"
            f"Comprometido batendo (±R$ {TOLERANCIA_CENTAVOS:.2f}): "
            f"{self.comprometido_batendo}/{self.chamados_comparados} ({pct_comp:.1f}%)\n"
            f"Realizado batendo (±R$ {TOLERANCIA_CENTAVOS:.2f}): "
            f"{self.realizado_batendo}/{self.chamados_comparados} ({pct_real:.1f}%)\n"
            f"Delta total comprometido (pipeline - manual): R$ {self.delta_total_comprometido:,.2f}\n"
            f"Delta total realizado (pipeline - manual): R$ {self.delta_total_realizado:,.2f}\n"
        )


def compare_with_manual(realizado: pd.DataFrame, gastos_reais_manual: pd.DataFrame) -> ComparisonReport:
    manual = gastos_reais_manual.copy()
    chamado_numerico = pd.to_numeric(manual["Chamado"], errors="coerce")
    # Uma célula "Chamado" com valor não inteiro é erro de digitação na aba
    # manual (não é um Identificador válido) — tratada como sem correspondência.
    chamado_numerico = chamado_numerico.where(chamado_numerico % 1 == 0)
    manual["Identificador"] = chamado_numerico.astype("Int64")
    manual = manual.dropna(subset=["Identificador"])

    # Um mesmo Identificador pode ocupar várias linhas na aba manual (item a
    # item); o pipeline tem uma linha por Identificador, então a comparação
    # precisa ser por Identificador agregado, não linha a linha.
    manual_por_id = manual.groupby("Identificador", as_index=False).agg(
        comprometido_manual=("Preço Total", "sum"),
        realizado_manual=("Preço realizado (chegada da NF)", "sum"),
        qtd_linhas_manual=("Identificador", "count"),
    )

    pipeline = realizado[["Identificador", "Valor R$", "valor_realizado"]].drop_duplicates("Identificador")

    detalhe = manual_por_id.merge(pipeline, on="Identificador", how="left")
    detalhe = detalhe.rename(
        columns={
            "Valor R$": "comprometido_pipeline",
            "valor_realizado": "realizado_pipeline",
        }
    )

    sem_correspondencia = detalhe["comprometido_pipeline"].isna()
    comparaveis = detalhe[~sem_correspondencia].copy()

    comparaveis["delta_comprometido"] = comparaveis["comprometido_pipeline"] - comparaveis[
        "comprometido_manual"
    ].fillna(0)
    comparaveis["delta_realizado"] = comparaveis["realizado_pipeline"].fillna(0) - comparaveis[
        "realizado_manual"
    ].fillna(0)

    comprometido_ok = (comparaveis["delta_comprometido"].abs() <= TOLERANCIA_CENTAVOS).sum()
    realizado_ok = (comparaveis["delta_realizado"].abs() <= TOLERANCIA_CENTAVOS).sum()

    return ComparisonReport(
        total_chamados_manual=len(detalhe),
        chamados_sem_correspondencia_no_pipeline=int(sem_correspondencia.sum()),
        chamados_comparados=len(comparaveis),
        comprometido_batendo=int(comprometido_ok),
        realizado_batendo=int(realizado_ok),
        delta_total_comprometido=float(comparaveis["delta_comprometido"].sum()),
        delta_total_realizado=float(comparaveis["delta_realizado"].sum()),
        detalhe=detalhe,
    )

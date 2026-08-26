"""CLI do pipeline: gera a consolidação a partir do arquivo de origem.

Uso:
    python -m financial_pipeline.cli SOURCE.xlsx --out saida.xlsx
    python -m financial_pipeline.cli SOURCE.xlsx --out saida.xlsx --compare-manual GASTOS_REAIS.xlsx

`GASTOS_REAIS.xlsx`, quando informado, precisa ter uma aba "Gastos Reais" no
mesmo formato da consolidação manual atual — normalmente é o mesmo arquivo do
painel (`Curva_S_RTs2.xlsx`).
"""

from __future__ import annotations

import argparse
import sys

import pandas as pd

from .build import (
    build_comprometido_summary,
    build_panel,
    build_previsto_summary,
    build_realizado,
    build_realizado_summary,
    build_solicitacoes,
)
from .compare import compare_with_manual
from .sources import load_sources


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Arquivo Excel com as abas SESuite/FIN/Atualizações/Previsoes")
    parser.add_argument("--out", required=True, help="Arquivo .xlsx de saída com a consolidação")
    parser.add_argument(
        "--compare-manual",
        metavar="ARQUIVO",
        help="Arquivo Excel com uma aba 'Gastos Reais' para validar o pipeline contra a consolidação manual",
    )
    args = parser.parse_args(argv)

    print(f"Lendo fontes de {args.source}...")
    sources = load_sources(args.source)

    solicitacoes = build_solicitacoes(sources.sesuite, sources.atualizacoes)
    realizado = build_realizado(solicitacoes, sources.fin)

    comprometido_summary = build_comprometido_summary(realizado)
    realizado_summary = build_realizado_summary(realizado)
    previsto_summary = build_previsto_summary(sources.previsoes)
    panel = build_panel(previsto_summary, comprometido_summary, realizado_summary)

    print(f"Escrevendo {args.out}...")
    with pd.ExcelWriter(args.out, engine="openpyxl") as writer:
        realizado.to_excel(writer, sheet_name="Solicitacoes", index=False)
        panel.to_excel(writer, sheet_name="Painel financeiro mensal", index=False)

    if args.compare_manual:
        print(f"Comparando com {args.compare_manual} (aba 'Gastos Reais')...")
        manual = pd.ExcelFile(args.compare_manual).parse("Gastos Reais")
        report = compare_with_manual(realizado, manual)
        print()
        print(report.summary())

    return 0


if __name__ == "__main__":
    sys.exit(main())

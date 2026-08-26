"""Pipeline de consolidação financeira de projetos (ISI SM).

Reimplementa em código a lógica hoje feita manualmente na aba "Gastos Reais"
da planilha do painel, a partir das fontes brutas descritas no documento de
contexto do projeto (SESuite, FIN, Atualizações e Previsões).
"""

from .build import (
    build_comprometido_summary,
    build_panel,
    build_previsto_summary,
    build_realizado,
    build_realizado_summary,
    build_solicitacoes,
)
from .sources import SHEETS, load_sources

__all__ = [
    "SHEETS",
    "load_sources",
    "build_solicitacoes",
    "build_realizado",
    "build_comprometido_summary",
    "build_previsto_summary",
    "build_realizado_summary",
    "build_panel",
]

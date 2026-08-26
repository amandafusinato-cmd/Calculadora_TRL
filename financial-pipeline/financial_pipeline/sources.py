"""Leitura das fontes brutas do arquivo "Gastos reais, aquisições e viagens".

O arquivo de origem é uma planilha Excel com uma aba por fonte de dados. Os
nomes de aba abaixo são os mesmos usados na planilha real — se a instituição
renomear uma aba, ajuste as constantes aqui, não o resto do pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

SHEETS = {
    "previsoes": "Previsoes",
    "sesuite": "Aquisições - SESuite",
    "atualizacoes": "Atualizações - Entregas e datas",
    "fin": "FIN - Pagamentos (Nacionais)",
    "razao": "Realizado (Razão)",
}

# Colunas de data em cada fonte, coagidas para datetime na leitura. Algumas
# exportações do SESuite trazem essas colunas como texto ("13/06/2023") em
# vez de datetime — ver "Regras e pegadinhas" no documento de contexto.
_DATE_COLUMNS = {
    "sesuite": [
        "Data Aprovação GP",
        "Data Análise Célula",
        "Data Aprovação Técnica",
        "previsao_entrega",
        "data_emissao_oc",
        "Data do Recebimento",
    ],
    "atualizacoes": [
        "Data de Entrega Prevista - Atualizada",
        "Data de Entrega (NF)",
    ],
    "fin": [
        "Data da Abertura do FIN",
        "Data Agendada para Pagamento",
    ],
    "previsoes": ["Data Prevista de Recebimento"],
    "razao": ["Data Lan.", "Data convertida"],
}

# Identificador aparece como int em algumas fontes e float em outras (ex.:
# FIN, por causa de NaN nas linhas "Saldo" sem Identificador). Normalizamos
# todas para Int64 (nullable) para permitir join sem perda de linha.
_ID_COLUMNS = {
    "sesuite": ["Identificador"],
    "atualizacoes": ["Identificador"],
    "fin": ["Identificador"],
}


@dataclass
class Sources:
    """Um DataFrame por aba de origem, já com tipos normalizados."""

    previsoes: pd.DataFrame
    sesuite: pd.DataFrame
    atualizacoes: pd.DataFrame
    fin: pd.DataFrame
    razao: pd.DataFrame


def _coerce_dates(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)
    return df


def _coerce_ids(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
    return df


def load_sources(path: str) -> Sources:
    """Lê as cinco abas relevantes do arquivo de origem em DataFrames.

    `path` é o caminho para o arquivo Excel equivalente a
    "Gastos reais, aquisições e viagens.xlsx". As abas são lidas pelo nome
    (ver `SHEETS`), não pela posição.
    """
    xls = pd.ExcelFile(path)

    frames = {}
    for key, sheet_name in SHEETS.items():
        if sheet_name not in xls.sheet_names:
            raise ValueError(
                f"Aba '{sheet_name}' (fonte '{key}') não encontrada em {path}. "
                f"Abas disponíveis: {xls.sheet_names}"
            )
        df = xls.parse(sheet_name)
        df = _coerce_dates(df, _DATE_COLUMNS.get(key, []))
        df = _coerce_ids(df, _ID_COLUMNS.get(key, []))
        frames[key] = df

    return Sources(**frames)

/* ===================================================================
 * Banco de perguntas da Calculadora de TRL
 * Baseado em: ABNT NBR ISO 16290:2015 (critérios "N", obrigatórios,
 * sem tolerância) + critérios adicionais adaptados de ROCHA, D. (2016)
 * "Uma adaptação da Norma NBR ISO 16290:2015 aplicada em projetos do
 * setor Aeroespacial" (critérios "I", avaliados em % e sujeitos à
 * tolerância definida pelo usuário).
 *
 * type: "N" -> critério ISO 16290 (checkbox sim/não, obrigatório)
 * type: "I" -> critério adicional (percentual 0-100%, passo 5)
 * =================================================================== */

const TRL_LEVELS = [
  {
    level: 1,
    title: "TRL 1",
    subtitle: "Princípios básicos observados e reportados",
    group: 1,
    marco: "As aplicações potenciais são identificadas na sequência das observações básicas, mas o conceito do elemento ainda não foi formulado.",
    realizacao: "Expressão dos princípios básicos destinados a serem utilizados. Identificação de potenciais aplicações.",
    questions: [
      { type: "N", text: "Foram identificados os princípios básicos?" },
      { type: "N", text: "Foram identificadas potenciais aplicações para a tecnologia?" },
      { type: "I", text: "Foram documentados os estudos que confirmam os princípios básicos?" },
      { type: "I", text: "Foram identificadas leis e pressupostos utilizados na nova tecnologia e não proíbem o desenvolvimento?" },
      { type: "I", text: "Foi levantada e documentada a ideia dos riscos, custos e cronograma para desenvolvimento da pesquisa tecnológica?" },
      { type: "I", text: "Foi identificado quem e onde será realizada as pesquisas da tecnologia?" },
      { type: "I", text: "Existe fonte monetária ou interessados, stakeholders (patrocinadores) na concretização da tecnologia?" },
      { type: "I", text: "Foi levantado se alguma outra instituição de pesquisa ou empresa está pesquisando a tecnologia no país?" },
      { type: "I", text: "Foi realizada pesquisa em ambiente exploratório?" },
      { type: "I", text: "Existem publicações científicas em revistas/anais/congressos a respeito da tecnologia?" }
    ]
  },
  {
    level: 2,
    title: "TRL 2",
    subtitle: "Conceito tecnológico e/ou aplicação formulados",
    group: 1,
    marco: "Formulação de potenciais aplicações e conceito preliminar do elemento. Nenhuma prova de conceito ainda.",
    realizacao: "Formulação de aplicações potenciais e conceito preliminar do elemento, proporcionando compreensão de como seriam utilizados os princípios básicos.",
    questions: [
      { type: "N", text: "Foram formuladas as potenciais aplicações?" },
      { type: "I", text: "Foi realizada pesquisa em ambiente de trabalho?" },
      { type: "I", text: "Foram identificadas as principais funções a serem desempenhadas pela tecnologia?" },
      { type: "I", text: "Foi documentada a viabilidade das aplicações confirmadas por estudos?" },
      { type: "I", text: "Foi identificada a funcionalidade da tecnologia?" },
      { type: "I", text: "Foram identificados possíveis GAP's da tecnologia e documentados?" },
      { type: "I", text: "Sabe que programa (projeto) a tecnologia vai apoiar?" },
      { type: "I", text: "Foram identificados potenciais clientes?" },
      { type: "I", text: "Cliente demonstra interesse na aplicação?" }
    ]
  },
  {
    level: 3,
    title: "TRL 3",
    subtitle: "Prova de conceito experimental e analítica, da função crítica e/ou característica",
    group: 1,
    marco: "O conceito do elemento é elaborado e o desempenho é demonstrado através de modelos analíticos apoiados por dados/características experimentais.",
    realizacao: "Requisitos de desempenho preliminares (podem direcionar várias missões), incluindo definição de requisitos de desempenho funcional.",
    questions: [
      { type: "N", text: "Foi concretizado a realização do projeto conceitual do elemento e documentado?" },
      { type: "N", text: "Foram especificados os requisitos de desempenho da tecnologia?" },
      { type: "I", text: "Foi verificada a viabilidade da aplicação por experimentos de laboratório (simulação)?" },
      { type: "I", text: "Foram identificados os possíveis defeitos da tecnologia em experimentos de laboratório?" },
      { type: "I", text: "Foram identificados e documentados os componentes que devem trabalhar juntos (visão sistêmica)?" },
      { type: "I", text: "Foi plenamente demonstrada a viabilidade científica da tecnologia?" },
      { type: "I", text: "Foram identificadas e desenvolvidas as técnicas de desenvolvimento da tecnologia?" },
      { type: "I", text: "Foram avaliados os conceitos de fabricação da tecnologia?" },
      { type: "I", text: "Foram identificados os componentes chaves para fabricação?" },
      { type: "I", text: "Foi documentada a ideia dos riscos, custos e cronograma para desenvolvimento do protótipo?" }
    ]
  },
  {
    level: 4,
    title: "TRL 4",
    subtitle: "Validação funcional do componente e/ou \"breadboard\" em ambiente de laboratório",
    group: 2,
    marco: "O desempenho funcional do elemento é demonstrado por meio de testes em ambiente de laboratório (breadboard).",
    realizacao: "Projeto conceitual do elemento.",
    questions: [
      { type: "N", text: "Foi realizado o projeto conceitual da tecnologia?" },
      { type: "I", text: "Foram testados os componentes individuais em laboratórios e realizados relatórios?" },
      { type: "I", text: "Foram totalmente identificados os possíveis GAP's da tecnologia?" },
      { type: "I", text: "Foram identificados os requisitos gerais do sistema para aplicação aos usuários finais?" },
      { type: "I", text: "Foram estabelecidas as métricas de desempenho da tecnologia?" },
      { type: "I", text: "Foi identificado os custos para desenvolvimento do protótipo?" },
      { type: "I", text: "Foi realizado o cronograma para desenvolvimento do protótipo?" },
      { type: "I", text: "Foi iniciado o programa de gestão de risco do protótipo?" },
      { type: "I", text: "Foram iniciados os estudos de integração da tecnologia ao projeto final?" }
    ]
  },
  {
    level: 5,
    title: "TRL 5",
    subtitle: "Validação funcional do componente e/ou \"breadboard\" em ambiente relevante",
    group: 2,
    marco: "Funções críticas do elemento são identificadas e o ambiente relevante associado é definido. Breadboards em escala reduzida são construídos para verificar o desempenho através de testes no ambiente relevante, sujeitos a efeitos de escala.",
    realizacao: "Entradas de dados experimentais, definição do experimento em laboratório e dos resultados.",
    questions: [
      { type: "N", text: "Foi realizado a definição preliminar de requisitos de desempenho no ambiente relevante?" },
      { type: "N", text: "Foi realizado o projeto preliminar do elemento, suportado por modelos apropriados para a verificação das funções críticas?" },
      { type: "N", text: "Foi realizado plano de teste de função crítica para análise dos efeitos de escala?" },
      { type: "N", text: "Foi estipulado a definição da placa de ensaio para a verificação da função crítica?" },
      { type: "N", text: "Foram realizados os testes de placa de ensaio com relatórios?" },
      { type: "I", text: "Foram identificados os efeitos das possíveis falhas da tecnologia (se houver)?" },
      { type: "I", text: "Foram identificados os requisitos de interface de sistema?" },
      { type: "I", text: "Foram identificadas as interações entre os componentes/subsistemas?" },
      { type: "I", text: "Foi realizada modificações no ambiente de laboratório para aproximar do ambiente operacional, deixando apto a testes?" },
      { type: "I", text: "Foram realizados testes tecnológicos dos componentes em ambiente relevante?" }
    ]
  },
  {
    level: 6,
    title: "TRL 6",
    subtitle: "Demonstração do modelo ou protótipo do sistema/subsistema em ambiente relevante",
    group: 2,
    marco: "Funções críticas do elemento são verificadas, o desempenho é demonstrado no ambiente relevante e modelos representativos em forma, ajuste e função.",
    realizacao: "Modelos analíticos do elemento para a prova de conceito.",
    questions: [
      { type: "N", text: "Foram realizados identificação e análise das funções críticas do elemento e verificadas as funções críticas e documentadas em relatório?" },
      { type: "N", text: "O ambiente relevante de funcionamento para eventual sistema é conhecido?" },
      { type: "I", text: "Foi realizada e documentada a definição de requerimento do desempenho e do ambiente relevante?" },
      { type: "I", text: "Foram documentados os requisitos completos de sistema e subsistema para funcionamento?" },
      { type: "I", text: "Foram concluídas as avaliações das características de desempenho da tecnologia mesmo com os possíveis GAP's?" },
      { type: "I", text: "Foi iniciada a aquisição de dados da manutenção real, confiabilidade e dados de suporte?" },
      { type: "I", text: "Foi testado o modelo representativo (protótipo) completo em laboratório, ambiente operacional de alta fidelidade (simulação)?" }
    ]
  },
  {
    level: 7,
    title: "TRL 7",
    subtitle: "Demonstração do protótipo do sistema em ambiente operacional",
    group: 3,
    marco: "O desempenho é demonstrado para o ambiente operacional, em terra ou, se necessário, no espaço. Um modelo representativo, refletindo plenamente todos os aspectos do design do modelo de voo, é construído e testado com margens adequadas para demonstrar o desempenho no ambiente operacional.",
    realizacao: "Requisitos de desempenho preliminares, projeto conceitual do elemento, plano de teste de desempenho funcional, definição da placa de ensaio e relatórios de teste.",
    questions: [
      { type: "N", text: "Foi documentada a definição de requisitos de desempenho?" },
      { type: "N", text: "Foi documentada a definição do ambiente operacional?" },
      { type: "N", text: "Foi documentada a definição do modelo e da realização do teste?" },
      { type: "I", text: "Foi realizado testes em cada interface do sistema/software individualmente em condições de tensão e anômalas?" },
      { type: "I", text: "Foi simulado as funcionalidades disponíveis para demonstração em ambiente operacional?" },
      { type: "I", text: "Foi totalmente integrado o protótipo ao ambiente real demonstrado (ou simulado ambiente operacional)?" },
      { type: "I", text: "Foi realizado teste com sucesso do protótipo do sistema em um ambiente estipulado?" },
      { type: "I", text: "Foi realizado documentação do teste do modelo de protótipo?" },
      { type: "I", text: "Foi documentada a ideia dos riscos, custos e cronograma para desenvolvimento da tecnologia em escala?" }
    ]
  },
  {
    level: 8,
    title: "TRL 8",
    subtitle: "Sistema real completo e qualificado em operação por meio de testes e demonstração",
    group: 3,
    marco: "Modelo de voo é qualificado e integrado no sistema final, pronto para o voo.",
    realizacao: "Definição preliminar de requisitos de desempenho e do ambiente relevante, identificação e análise das funções críticas do elemento, projeto preliminar do elemento e plano de teste de função crítica.",
    questions: [
      { type: "N", text: "Foi construído e integrado o modelo final no sistema final? (produto)" },
      { type: "I", text: "Foram realizados ajustes dos componentes a suas funções para deixar compatível com o sistema operacional?" },
      { type: "I", text: "Foi testado o sistema e caracterizado com seu design e função para a aplicação pretendida?" },
      { type: "I", text: "Foram demonstrados os resultados, os funcionamentos e a função da tecnologia em eventual teste de sistema de plataforma?" },
      { type: "I", text: "Foi concluído o processo de controle da interface?" },
      { type: "I", text: "Foi concluída a documentação formal de regulamentação?" },
      { type: "I", text: "Foi concluída a documentação da gestão e controle de configuração?" },
      { type: "I", text: "Foram demonstradas todas as funcionalidades em ambiente operacional simulado e sistema qualificado através de teste e avaliação na plataforma real?" },
      { type: "I", text: "Foi identificado que o sistema atende às especificações?" },
      { type: "I", text: "Foi iniciado o programa de gestão de risco em parceria com o desenvolvimento com a indústria?" },
      { type: "I", text: "Foi identificado os custos para desenvolvimento da tecnologia em escala ou transmitido o conhecimento em parceria com a indústria?" },
      { type: "I", text: "Foi estipulado cronograma para desenvolvimento em escala da tecnologia ou realizado trabalho em parceria com a indústria?" }
    ]
  },
  {
    level: 9,
    title: "TRL 9",
    subtitle: "Sistema real testado na aplicação por meio de operações com missão alcançada",
    group: 3,
    marco: "Tecnologia está madura. O elemento tem sucesso em serviço para a missão atribuída no ambiente operacional real.",
    realizacao: "Definição de requisitos de desempenho e do ambiente em causa, projeto do elemento, plano de teste de função crítica, definição de modelo para as verificações de funções críticas e relatórios de ensaio.",
    questions: [
      { type: "N", text: "Foi realizado comissionamento na fase de operação inicial?" },
      { type: "N", text: "Foram finalizados os relatórios de operação em voo?" },
      { type: "I", text: "Foi plenamente demonstrado o sistema real?" },
      { type: "I", text: "Foi implementado com sucesso o conceito operacional?" },
      { type: "I", text: "Foi instalada e implantada a tecnologia em plataforma de sistema antes destinado?" },
      { type: "I", text: "Foi realizada através de operações de missão bem-sucedida o sistema de missão real \"aplicação comprovada\"?" },
      { type: "I", text: "Foram realizados todos os processos de fabricação controlados para o nível de qualidade adequado?" },
      { type: "I", text: "Foi incluída na documentação o processo de desenvolvimento em escala, o custo e o cronograma para tal desenvolvimento?" },
      { type: "I", text: "Foi incluída na documentação final o processo de parceria e de transferência de conhecimento para a indústria?" },
      { type: "I", text: "Foi realizado plano de negócio para desenvolvimento da tecnologia?" },
      { type: "I", text: "Foram realizadas publicações científicas e/ou patentes a respeito da tecnologia?" },
      { type: "I", text: "É possível reproduzir o mesmo projeto com os mesmos requisitos?" }
    ]
  }
];

/* Grupos de avaliação (definem até onde a avaliação é respondida) */
const TRL_GROUPS = [
  { id: 1, label: "TRL 1 a 3", ceiling: 3, name: "Pesquisa e Desenvolvimento (P&D)",
    description: "Atividades de pesquisa e exploração da tecnologia, descobrimento e formulação do conceito da tecnologia a ser desenvolvida." },
  { id: 2, label: "TRL 1 a 6", ceiling: 6, name: "Construção da Tecnologia",
    description: "Desenvolvimento do conceito da tecnologia e aplicação (protótipo), prova experimental da tecnologia realizada em ambiente laboratorial relevante." },
  { id: 3, label: "TRL 1 a 9", ceiling: 9, name: "Validação e Produção",
    description: "Demonstração em ambiente operacional, sistema qualificado e missão alcançada, possibilidade de reprodução em escala, processo de parceria e transferência tecnológica para a indústria." }
];

/* ===================================================================
 * Escala alternativa — API 17N (Subsea / Óleo & Gás)
 *
 * Fonte: API Recommended Practice 17N (2009) — "Recommended Practice
 * for Subsea Production System Reliability, Technical Risk and
 * Integrity Management". Escala de 8 níveis (TRL 0 a 7), adotada pela
 * indústria offshore de óleo & gás a partir do modelo da NASA.
 * Textos-base (estado da proposta / critério de atingimento / foco de
 * teste) conforme a "API 17 Technology Readiness Level Ladder"
 * (referência: Astrimar); agrupamento em 3 fases conforme as mesmas
 * anotações da escada oficial ("Understand function and performance",
 * "Make it Reliable as a device", "Reliability Growth & Uncertainty
 * Reduction").
 *
 * Diferente da escala NASA/ISO 16290 usada nesta calculadora, a API
 * 17N não publica um checklist detalhado de subcritérios por nível —
 * cada nível tem uma única condição de atingimento (tratada aqui como
 * critério ★ obrigatório). Por isso, o percentual de tolerância pouco
 * se aplica: cada nível é Sim (100%), Parcial (50%) ou Não (0%).
 * =================================================================== */
const API_LEVELS = [
  {
    level: 0, title: "TRL 0", subtitle: "Conception (Concepção)",
    group: 1,
    marco: "Estado de partida: tecnologia proposta em fase de pré-pesquisa (\"pre-research technology proposed\").",
    realizacao: "Foco de teste/análise: pesquisa experimental (1 — Experimental research). Objetivo da fase: entender função e desempenho.",
    questions: [
      { type: "N", text: "TRL 0 atingido — a pesquisa básica foi realizada (\"Basic Research achieved\")?" }
    ]
  },
  {
    level: 1, title: "TRL 1", subtitle: "Concept Demonstration (Demonstração de conceito)",
    group: 1,
    marco: "Estado de partida: tecnologia ainda não comprovada (\"unproven technology proposed\").",
    realizacao: "Foco de teste/análise: pesquisa experimental (1 — Experimental research). Objetivo da fase: entender função e desempenho.",
    questions: [
      { type: "N", text: "TRL 1 atingido — a tecnologia foi demonstrada (\"Technology is demonstrated\")?" }
    ]
  },
  {
    level: 2, title: "TRL 2", subtitle: "Concept Validation (Validação de conceito)",
    group: 1,
    marco: "Estado de partida: tecnologia demonstrada, mas ainda não validada (\"demonstrated but unvalidated technology proposed\").",
    realizacao: "Foco de teste/análise: bancadas de laboratório e mock-ups (2 — Lab rigs and mock ups). Objetivo da fase: entender função e desempenho.",
    questions: [
      { type: "N", text: "TRL 2 atingido — a tecnologia foi validada (\"Technology is validated\")?" }
    ]
  },
  {
    level: 3, title: "TRL 3", subtitle: "Prototype Qualification Testing (Qualificação do protótipo)",
    group: 2,
    marco: "Estado de partida: tecnologia validada, mas ainda não testada (\"validated but untested technology proposed\").",
    realizacao: "Foco de teste/análise: teste de vida até a destruição (3 — Life test to destruction). Objetivo da fase: tornar o dispositivo confiável.",
    questions: [
      { type: "N", text: "TRL 3 atingido — o protótipo foi testado, com robustez e confiabilidade demonstradas (\"prototype tested, robust & reliable\")?" }
    ]
  },
  {
    level: 4, title: "TRL 4", subtitle: "Environment Qualification Testing (Qualificação em ambiente)",
    group: 2,
    marco: "Estado de partida: produto proposto ainda não testado em campo (\"proposed product has not been field tested\").",
    realizacao: "Foco de teste/análise: ambientes de campo (4 — Field environments). Objetivo da fase: tornar o dispositivo confiável.",
    questions: [
      { type: "N", text: "TRL 4 atingido — o teste em ambiente (environment qualification testing) foi concluído?" }
    ]
  },
  {
    level: 5, title: "TRL 5", subtitle: "System Qualification Testing (Qualificação do sistema)",
    group: 3,
    marco: "Estado de partida: produto proposto ainda não testado em sistema (\"proposed product has not been system tested\").",
    realizacao: "Foco de teste/análise: integração de sistema (5 — System integration). Objetivo da fase: crescimento de confiabilidade e redução de incerteza.",
    questions: [
      { type: "N", text: "TRL 5 atingido — os testes de sistema (system qualification testing) foram concluídos?" }
    ]
  },
  {
    level: 6, title: "TRL 6", subtitle: "Qualification of Installed System (Qualificação do sistema instalado)",
    group: 3,
    marco: "Estado de partida: tecnologia nunca instalada em ambiente subsea (\"technology has never been installed subsea\").",
    realizacao: "Foco de teste/análise: sistema + ambiente (6 — System + environment). Objetivo da fase: crescimento de confiabilidade e redução de incerteza.",
    questions: [
      { type: "N", text: "TRL 6 atingido — o sistema foi instalado, testado e comissionado (\"system installed, tested & commissioned\")?" }
    ]
  },
  {
    level: 7, title: "TRL 7", subtitle: "Proving Technology over Time (Comprovação da tecnologia ao longo do tempo)",
    group: 3,
    marco: "Estado de partida: tecnologia nunca operada em ambiente subsea (\"technology has never been operated subsea\"). Ao ser atingido, a tecnologia está \"field proven\" (comprovada em campo).",
    realizacao: "Foco de teste/análise: operação (7 — Operating). Objetivo da fase: crescimento de confiabilidade e redução de incerteza.",
    questions: [
      { type: "N", text: "TRL 7 atingido — o produto está operando com desempenho aceitável (\"operating with acceptable performance\")?" }
    ]
  }
];

const API_GROUPS = [
  { id: 1, label: "TRL 0 a 2", ceiling: 2, name: "Entender função e desempenho",
    description: "Understand function and performance — concepção, demonstração e validação de conceito." },
  { id: 2, label: "TRL 0 a 4", ceiling: 4, name: "Tornar o dispositivo confiável",
    description: "Make it Reliable as a device — qualificação do protótipo e do ambiente." },
  { id: 3, label: "TRL 0 a 7", ceiling: 7, name: "Crescimento de confiabilidade e redução de incerteza",
    description: "Reliability Growth & Uncertainty Reduction — qualificação de sistema, instalação e comprovação em campo (field proven)." }
];

/* ===================================================================
 * Registro de metodologias (frameworks) disponíveis na calculadora.
 * Cada framework define sua própria escala de níveis, agrupamentos,
 * nível mínimo/máximo e se possui checklist detalhado (N/I) ou apenas
 * um critério único por nível.
 * =================================================================== */
const FRAMEWORKS = {
  nasa: {
    id: "nasa",
    label: "NASA / ISO 16290",
    shortLabel: "NASA · ISO 16290 (padrão)",
    scaleNote: "9 níveis (TRL 1–9) — ABNT NBR ISO 16290:2015, com critérios institucionais adicionais adaptados de ROCHA, D. (2016).",
    citation: "ABNT NBR ISO 16290:2015; adaptação institucional ROCHA, D. (2016), ITA.",
    minLevel: 1,
    maxLevel: 9,
    hasChecklist: true,
    levels: TRL_LEVELS,
    groups: TRL_GROUPS
  },
  api: {
    id: "api",
    label: "API 17N (Subsea)",
    shortLabel: "API 17N · Óleo & Gás",
    scaleNote: "8 níveis (TRL 0–7) — American Petroleum Institute, Recommended Practice 17N, para tecnologia subsea.",
    citation: "API Recommended Practice 17N (2009); escada de referência: Astrimar.",
    minLevel: 0,
    maxLevel: 7,
    hasChecklist: false,
    levels: API_LEVELS,
    groups: API_GROUPS
  }
};
const FRAMEWORK_LIST = Object.values(FRAMEWORKS);

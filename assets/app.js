/* ===================================================================
 * Calculadora de TRL — lógica da aplicação
 *
 * Metodologia (replicada a partir da planilha original):
 *   - Cada nível possui critérios "N" (obrigatórios/mandatórios,
 *     marcados com ★) e "I" (adicionais/institucionais). Todos são
 *     respondidos em três estados: Sim (100 pontos), Parcial (50) ou
 *     Não (0).
 *   - Nota do nível = média de todos os critérios do nível.
 *   - Um nível só pode ser AVANÇADO quando todos os critérios ★
 *     estiverem em "Sim" (bloqueio duro, sem tolerância) E a nota do
 *     nível atingir a tolerância mínima definida pelo usuário.
 *   - Um nível "leitura estrita" é atingido quando todos os critérios
 *     ★ estão em "Sim", independente da nota dos demais critérios.
 *   - A maturidade é cumulativa: o TRL final é o maior nível em que
 *     todos os níveis anteriores também foram atingidos.
 *
 * Réguas de maturidade (ver FRAMEWORKS em questions.js): existe UMA
 * avaliação (um único conjunto de critérios e respostas, numerado
 * internamente de 1 a 9 — a numeração NASA/ISO). A régua escolhida
 * pelo usuário (NASA ou API 17N) só controla como esse mesmo nível
 * interno é NUMERADO e ATÉ ONDE ele é navegável.
 *
 * Múltiplas avaliações: cada tecnologia avaliada é um "projeto",
 * salvo separadamente (ver seção "Store" abaixo). `state` sempre
 * aponta para o projeto ativo — funções de cálculo aceitam um projeto
 * explícito (parâmetro `proj`, default = state) para permitir listar
 * o status de todos os projetos sem trocar o projeto ativo.
 * =================================================================== */

const STORE_KEY = "trl-calculadora-store-v1";

/* ---------------------------------------------------------------
 * Modal (confirmação / aviso) — substitui confirm()/alert() nativos,
 * que ficam bloqueados/silenciosos dentro de iframes sandboxed (como
 * a prévia de Artifact) e travam a página em vez de abrir um diálogo.
 * --------------------------------------------------------------- */
function showConfirm(message, { confirmLabel = "Confirmar", danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    document.getElementById("modal-message").textContent = message;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = "btn" + (danger ? " danger" : "");
    cancelBtn.hidden = false;
    overlay.hidden = false;

    function cleanup(result) {
      overlay.hidden = true;
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      resolve(result);
    }
    function onConfirm() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === overlay) cleanup(false); }
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
  });
}

function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modal-overlay");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    document.getElementById("modal-message").textContent = message;
    confirmBtn.textContent = "OK";
    confirmBtn.className = "btn";
    cancelBtn.hidden = true;
    overlay.hidden = false;

    function cleanup() {
      overlay.hidden = true;
      confirmBtn.removeEventListener("click", onOk);
      overlay.removeEventListener("click", onOverlay);
      resolve();
    }
    function onOk() { cleanup(); }
    function onOverlay(e) { if (e.target === overlay) cleanup(); }
    confirmBtn.addEventListener("click", onOk);
    overlay.addEventListener("click", onOverlay);
  });
}

const ANSWER_VALUES = ["sim", "parcial", "nao"];
const ANSWER_LABELS = { sim: "Sim", parcial: "Parcial", nao: "Não" };
const ANSWER_POINTS = { sim: 100, parcial: 50, nao: 0 };

/* ---------------------------------------------------------------
 * Store — múltiplas avaliações (projetos)
 * --------------------------------------------------------------- */
function genId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function newProject(name) {
  const now = new Date().toISOString();
  return {
    id: genId(),
    createdAt: now,
    updatedAt: now,
    meta: { nome: name || "", resp: "", data: "" },
    frameworkId: "nasa",
    groupId: TRL_GROUPS[TRL_GROUPS.length - 1].id, // grupo mais amplo por padrão
    tolerance: 33,
    currentLevel: 1,           // nível interno (numeração NASA/ISO, 1–9)
    answers: {},                 // { [nível interno]: ["sim"|"parcial"|"nao"|null, ...] }
    comments: {},                 // { [nível interno]: string }
    history: []                    // [{ date, day, finalTol, finalIso, frameworkId }, ...]
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.projects && Object.keys(parsed.projects).length && parsed.projects[parsed.activeId]) {
        // preenche campos que possam faltar em projetos salvos por versões anteriores
        Object.values(parsed.projects).forEach(p => {
          if (!p.history) p.history = [];
          if (!p.comments) p.comments = {};
          if (!p.answers) p.answers = {};
        });
        return parsed;
      }
    }
  } catch (e) { /* localStorage indisponível ou dado corrompido — recomeça */ }
  const p = newProject("");
  return { activeId: p.id, projects: { [p.id]: p } };
}

let store = loadStore();
let state = store.projects[store.activeId];

function saveStoreOnly() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
function saveState() {
  state.updatedAt = new Date().toISOString();
  saveStoreOnly();
  refreshProjectBar();
  updateGlobalProgress();
}

function projectList() {
  return Object.values(store.projects).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
function switchProject(id) {
  if (!store.projects[id]) return;
  store.activeId = id;
  state = store.projects[id];
  saveStoreOnly();
  refreshProjectBar();
  updateGlobalProgress();
}
function createProject() {
  const p = newProject("");
  store.projects[p.id] = p;
  switchProject(p.id);
  return p;
}
function duplicateProject(id) {
  const src = store.projects[id];
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = genId();
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = copy.createdAt;
  copy.meta.nome = (src.meta.nome || "Sem nome") + " (cópia)";
  copy.history = [];
  store.projects[copy.id] = copy;
  saveStoreOnly();
  return copy;
}
function deleteProject(id) {
  delete store.projects[id];
  const remaining = Object.keys(store.projects);
  if (!remaining.length) {
    const p = newProject("");
    store.projects[p.id] = p;
    store.activeId = p.id;
  } else if (store.activeId === id) {
    store.activeId = remaining[0];
  }
  state = store.projects[store.activeId];
  saveStoreOnly();
  refreshProjectBar();
  updateGlobalProgress();
}

function slugify(str) {
  return (str || "avaliacao").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "avaliacao";
}

/* Baixa `data` (string) como `filename`. Em um viewer de Artifact
 * (sandboxed), um <a download> comum não funciona — usa a capability
 * "downloads" quando disponível, com fallback para o download comum
 * (o que sempre acontece no site publicado normalmente). */
async function saveFile(filename, data) {
  if (window.claude && window.claude.use) {
    try {
      const downloads = await window.claude.use("downloads");
      if (downloads) {
        await downloads.save({ filename, data });
        return;
      }
    } catch (e) { /* recusado/indisponível — cai para o download comum abaixo */ }
  }
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportProject(id) {
  const proj = store.projects[id];
  if (!proj) return;
  saveFile(`trl-${slugify(proj.meta.nome)}.json`, JSON.stringify(proj, null, 2));
}

const BACKUP_TYPE = "trl-calculadora-backup";

function exportAllProjects() {
  const backup = {
    type: BACKUP_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: Object.values(store.projects)
  };
  const filename = `trl-backup-todas-avaliacoes-${new Date().toISOString().slice(0, 10)}.json`;
  saveFile(filename, JSON.stringify(backup, null, 2));
}

function isValidProjectShape(p) {
  return !!p && typeof p === "object" && typeof p.answers === "object" && !!p.meta;
}

function importAsNewProject(data) {
  const proj = { ...newProject(""), ...data, id: genId() };
  proj.createdAt = new Date().toISOString();
  proj.updatedAt = proj.createdAt;
  if (!FRAMEWORKS[proj.frameworkId]) proj.frameworkId = "nasa";
  store.projects[proj.id] = proj;
  return proj;
}

function importProjectFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      // Backup completo (várias avaliações num arquivo só)
      if (data && data.type === BACKUP_TYPE && Array.isArray(data.projects)) {
        const validProjects = data.projects.filter(isValidProjectShape);
        if (!validProjects.length) throw new Error("backup vazio ou inválido");
        let firstId = null;
        validProjects.forEach(p => {
          const proj = importAsNewProject(p);
          if (!firstId) firstId = proj.id;
        });
        saveStoreOnly();
        switchProject(firstId);
        showScreen("projetos");
        return;
      }

      // Avaliação única
      if (!isValidProjectShape(data)) throw new Error("formato inválido");
      const proj = importAsNewProject(data);
      switchProject(proj.id);
      showScreen("resultado");
    } catch (e) {
      showAlert("Não foi possível importar este arquivo — verifique se é um .json exportado por esta calculadora.");
    }
  };
  reader.readAsText(file);
}

/* fw() = régua de maturidade ativa (NASA ou API) */
function fw(proj = state) { return FRAMEWORKS[proj.frameworkId]; }
function toDisplay(level, proj = state) { return level + fw(proj).offset; }
function toDisplayFor(level, frameworkId) { return level + FRAMEWORKS[frameworkId].offset; }
function levelDef(level) { return TRL_LEVELS.find(l => l.level === level); }

/* Níveis internos navegáveis pela régua ativa (1..maxInternalLevel) */
function frameworkLevels(proj = state) { return TRL_LEVELS.filter(l => l.level <= fw(proj).maxInternalLevel); }
function levelPosition(level, proj = state) { return frameworkLevels(proj).findIndex(l => l.level === level) + 1; }

function getGroup(id) { return TRL_GROUPS.find(g => g.id === id); }
/* Teto do grupo, já limitado ao alcance da régua ativa */
function ceilingLevel(proj = state) { return Math.min(getGroup(proj.groupId).ceiling, fw(proj).maxInternalLevel); }
function groupLabel(g, proj = state) {
  return `TRL ${toDisplay(1, proj)} a ${toDisplay(Math.min(g.ceiling, fw(proj).maxInternalLevel), proj)}`;
}

function ensureAnswers(level) {
  const def = levelDef(level);
  if (!state.answers[level]) {
    state.answers[level] = def.questions.map(() => null);
  }
  return state.answers[level];
}

/* ---------------------------------------------------------------
 * Cálculo
 * --------------------------------------------------------------- */
function computeLevel(level, proj = state) {
  const def = levelDef(level);
  const answers = proj.answers[level];
  const totalCount = def.questions.length;
  if (!answers) {
    return { percent: 0, evidencedCount: 0, totalCount, mandatoryOk: false,
             mandatoryIssue: "unanswered", allAnswered: false, passTol: false, passIso: false,
             status: "blocked-unanswered", canAdvance: false };
  }

  let points = 0, evidencedCount = 0;
  let mandatoryIssue = null; // null | "nao" | "parcial" | "unanswered"
  let allAnswered = true;

  def.questions.forEach((q, i) => {
    const val = answers[i];
    points += ANSWER_POINTS[val] || 0;
    if (val === "sim" || val === "parcial") evidencedCount++;
    if (val === null || val === undefined) allAnswered = false;

    if (q.type === "N") {
      if (val === "nao" && mandatoryIssue !== "nao") mandatoryIssue = "nao";
      else if (val === "parcial" && !mandatoryIssue) mandatoryIssue = "parcial";
      else if ((val === null || val === undefined) && !mandatoryIssue) mandatoryIssue = "unanswered";
    }
  });

  const percent = totalCount ? points / totalCount : 0;
  const mandatoryOk = mandatoryIssue === null;
  const thresholdOk = percent >= proj.tolerance;
  const passTol = mandatoryOk && thresholdOk;
  const passIso = mandatoryOk;

  let status;
  if (mandatoryIssue === "nao") status = "blocked-nao";
  else if (mandatoryIssue === "parcial") status = "blocked-parcial";
  else if (mandatoryIssue === "unanswered") status = "blocked-unanswered";
  else if (!thresholdOk || !allAnswered) status = "pending";
  else status = "pass";

  return { percent, evidencedCount, totalCount, mandatoryOk, mandatoryIssue, allAnswered,
           passTol, passIso, status, canAdvance: status === "pass" };
}

function computeAll(proj = state) {
  const ceiling = ceilingLevel(proj);
  const rows = [];
  let cumTol = true, cumIso = true;
  let finalTol = null, finalIso = null;

  for (const def of frameworkLevels(proj)) {
    const inScope = def.level <= ceiling;
    if (!inScope) {
      rows.push({ level: def.level, percent: null, passTol: null, passIso: null, inScope: false });
      continue;
    }
    const r = computeLevel(def.level, proj);
    cumTol = cumTol && r.passTol;
    cumIso = cumIso && r.passIso;
    if (cumTol) finalTol = def.level;
    if (cumIso) finalIso = def.level;
    rows.push({ level: def.level, percent: r.percent, passTol: r.passTol, passIso: r.passIso,
                cumTol, cumIso, inScope: true });
  }
  if (finalTol === null) finalTol = 0;
  if (finalIso === null) finalIso = 0;
  return { rows, finalTol, finalIso, ceiling };
}

function levelAlert(r) {
  const tol = state.tolerance;
  switch (r.status) {
    case "blocked-nao":
      return { type: "blocked", icon: "✖",
        text: `Critério(s) obrigatório(s) (★) marcado(s) como Não — são essenciais para caracterizar este nível. Não é possível avançar até que sejam atendidos.` };
    case "blocked-parcial":
      return { type: "blocked", icon: "★",
        text: `Critério(s) obrigatório(s) (★) ainda parcial(is) — é necessário marcá-los como Sim para caracterizar este nível.` };
    case "blocked-unanswered":
      return { type: "blocked", icon: "★",
        text: `Responda todos os critérios obrigatórios (★) deste nível — eles são essenciais para caracterizar o TRL.` };
    case "pending":
      return { type: "pending", icon: "↻",
        text: `Em construção — nota atual ${Math.round(r.percent)}% (${r.evidencedCount} de ${r.totalCount} critérios com evidência). É necessário atingir ao menos ${tol}% para avançar.` };
    default:
      return { type: "pass", icon: "✓",
        text: `Nível atendido — ${r.evidencedCount} de ${r.totalCount} critérios com evidência, critérios obrigatórios satisfeitos.` };
  }
}

/* ---------------------------------------------------------------
 * Próximos passos — o que falta para avançar ao próximo TRL
 * --------------------------------------------------------------- */
function nextStepsData(result) {
  const target = result.rows.find(r => r.inScope && !r.cumTol);
  if (!target) {
    if (result.finalTol >= fw().maxInternalLevel) return { done: true, maxed: true };
    return { done: true, maxed: false, ceiling: toDisplay(result.ceiling) };
  }
  const def = levelDef(target.level);
  const answers = state.answers[target.level] || [];
  const pending = def.questions
    .map((q, i) => ({ q, val: answers[i] }))
    .filter(x => x.val !== "sim");
  const mandatoryPending = pending.filter(x => x.q.type === "N");
  const priority = mandatoryPending[0] || pending[0] || null;
  const rest = priority ? pending.filter(x => x !== priority) : [];
  return { done: false, level: def, rest, priority };
}

function nextStepsHtml(ns) {
  if (ns.done) {
    if (ns.maxed) {
      return `<div class="nextstep-card done"><div class="ns-head">🏁 Maturidade máxima da régua atingida</div>
        <p>A tecnologia atingiu o nível mais alto de ${fw().shortLabel} (TRL ${toDisplay(fw().maxInternalLevel)}). Não há próximos passos dentro desta régua.</p></div>`;
    }
    return `<div class="nextstep-card done"><div class="ns-head">✓ Grupo avaliado concluído</div>
      <p>Todos os níveis do grupo selecionado (até TRL ${ns.ceiling}) foram atingidos. Para continuar, amplie o grupo alvo em "Dados" e prossiga a avaliação.</p></div>`;
  }
  const p = ns.priority;
  const displayLvl = toDisplay(ns.level.level);
  const priorityHtml = p
    ? `<b>Prioridade:</b> ${p.q.type === "N" ? "Atender o critério obrigatório" : "Elevar para “Sim” o critério"} — ${escapeHtml(p.q.text)}`
    : `<b>Prioridade:</b> concluir os critérios restantes deste nível.`;
  const restHtml = ns.rest.length
    ? `<b>Considere também:</b><ul>${ns.rest.map(x => `<li>${x.q.type === "N" ? "★ " : ""}${escapeHtml(x.q.text)}</li>`).join("")}</ul>`
    : "";
  return `
    <div class="nextstep-card">
      <div class="ns-head">→ Próximo passo — para avançar ao TRL ${displayLvl} (${escapeHtml(ns.level.subtitle)})</div>
      <p>${priorityHtml}</p>
      ${restHtml}
    </div>`;
}

/* ---------------------------------------------------------------
 * Gráfico de qualidade da evidência por nível
 * --------------------------------------------------------------- */
function evidenceChartData() {
  return frameworkLevels().map(def => {
    const answers = state.answers[def.level];
    if (!answers || answers.every(a => a === null)) {
      return { level: toDisplay(def.level), state: "none" };
    }
    const r = computeLevel(def.level);
    if (r.mandatoryIssue === "nao" || r.mandatoryIssue === "parcial") {
      return { level: toDisplay(def.level), state: "blocked", percent: r.percent };
    }
    let band;
    if (r.percent >= 80) band = "forte";
    else if (r.percent >= 60) band = "bom";
    else if (r.percent >= 40) band = "parcial";
    else band = "fraco";
    return { level: toDisplay(def.level), state: "scored", band, percent: r.percent };
  });
}

function evidenceChartHtml(data) {
  const cols = data.map(d => {
    if (d.state === "none") {
      return `<div class="ev-col">
        <div class="ev-track"><div class="ev-bar none"></div></div>
        <div class="ev-pct none">—</div><div class="ev-level">${d.level}</div></div>`;
    }
    if (d.state === "blocked") {
      return `<div class="ev-col">
        <div class="ev-track"><div class="ev-bar blocked" style="height:100%"></div></div>
        <div class="ev-pct blocked">★</div><div class="ev-level">${d.level}</div></div>`;
    }
    const h = Math.max(4, Math.round(d.percent));
    return `<div class="ev-col">
      <div class="ev-track"><div class="ev-bar ${d.band}" style="height:${h}%"></div></div>
      <div class="ev-pct">${Math.round(d.percent)}%</div><div class="ev-level">${d.level}</div></div>`;
  }).join("");
  return `
    <div class="evidence-chart">${cols}</div>
    <div class="evidence-legend">
      <span><i class="sw forte"></i>Forte (≥80%)</span>
      <span><i class="sw bom"></i>Bom (60–79%)</span>
      <span><i class="sw parcial"></i>Parcial (40–59%)</span>
      <span><i class="sw fraco"></i>Fraco (&lt;40%)</span>
      <span><i class="sw blocked"></i>Bloqueado (★ = obrigatório não atendido)</span>
    </div>`;
}

/* ---------------------------------------------------------------
 * Histórico de reavaliações (linha do tempo)
 * --------------------------------------------------------------- */
/* A chave de deduplicação do retrato é a "Data da avaliação" (campo em
 * Dados) — não a data real do clique. Registrar de novo NO MESMO DIA
 * DE AVALIAÇÃO atualiza aquele retrato em vez de duplicar; para
 * registrar vários pontos (ex.: simular versões TRL1 e TRL2), basta
 * trocar a data da avaliação entre um retrato e outro. Sem data
 * preenchida, cai no dia corrente como antes. */
function recordSnapshot() {
  const result = computeAll();
  const day = state.meta.data || new Date().toISOString().slice(0, 10);
  const entry = { day, finalTol: result.finalTol, finalIso: result.finalIso, frameworkId: state.frameworkId };
  const idx = state.history.findIndex(h => h.day === day);
  if (idx >= 0) state.history[idx] = entry;
  else state.history.push(entry);
  saveState();
  return entry;
}

function shortDate(day) {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

function timelineHtml(historyUnsorted) {
  const history = [...historyUnsorted].sort((a, b) => a.day.localeCompare(b.day));
  const w = 560, h = 160, padL = 26, padR = 16, padT = 18, padB = 26;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const n = history.length;
  const x = i => n <= 1 ? padL + innerW / 2 : padL + (innerW * i / (n - 1));
  const y = v => padT + innerH - (v / 9) * innerH; // eixo fixo 0–9 (numeração interna)

  const ptsTol = history.map((e, i) => `${x(i)},${y(e.finalTol)}`).join(" ");
  const ptsIso = history.map((e, i) => `${x(i)},${y(e.finalIso)}`).join(" ");
  const grid = [0, 3, 6, 9].map(v => `
    <line x1="${padL}" y1="${y(v)}" x2="${w - padR}" y2="${y(v)}" stroke="var(--border)" stroke-width="1"></line>
    <text x="2" y="${y(v) + 4}" font-size="10" fill="var(--text-faint)">${v}</text>`).join("");
  const marks = history.map((e, i) => `
    <circle cx="${x(i)}" cy="${y(e.finalTol)}" r="4" fill="#2f6fed"></circle>
    <text x="${x(i)}" y="${y(e.finalTol) - 10}" font-size="11" text-anchor="middle" fill="var(--text)" font-weight="700">TRL ${toDisplayFor(e.finalTol, e.frameworkId)}</text>
    <text x="${x(i)}" y="${h - 8}" font-size="10" text-anchor="middle" fill="var(--text-faint)">${shortDate(e.day)}</text>`).join("");

  const rows = history.slice().reverse().map(e => `
    <tr><td>${formatDate(e.day)}</td>
        <td class="tv">TRL ${toDisplayFor(e.finalTol, e.frameworkId)}</td>
        <td class="tv">TRL ${toDisplayFor(e.finalIso, e.frameworkId)}</td></tr>`).join("");

  return `
    <div class="timeline-wrap">
      <svg class="timeline-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução do TRL ao longo do tempo">
        ${grid}
        <polyline points="${ptsIso}" fill="none" stroke="var(--text-faint)" stroke-width="2" stroke-dasharray="4 3"></polyline>
        <polyline points="${ptsTol}" fill="none" stroke="#2f6fed" stroke-width="2.5"></polyline>
        ${marks}
      </svg>
      <div class="timeline-table">
        <table>
          <thead><tr><th></th><th>Tolerância</th><th>Estrita</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------------------------------------------------------------
 * Navegação entre telas
 * --------------------------------------------------------------- */
function showScreen(name) {
  if ((name === "avaliacao" || name === "resultado") && !state.meta.nome.trim()) {
    name = "dados";
    document.getElementById("dados-validation").hidden = false;
    setTimeout(() => document.getElementById("inp-nome").focus(), 50);
  }
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
  document.querySelectorAll("#stepper button").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === name);
  });
  document.body.classList.toggle("screen-projetos-active", name === "projetos");
  if (name === "projetos") renderProjectsList();
  if (name === "dados") renderDadosScreen();
  if (name === "avaliacao") renderLevel(state.currentLevel);
  if (name === "resultado") renderResultado();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("#stepper button").forEach(b => {
  b.addEventListener("click", () => showScreen(b.dataset.screen));
});
document.querySelectorAll("[data-goto]").forEach(b => {
  b.addEventListener("click", () => showScreen(b.dataset.goto));
});

/* ---------------------------------------------------------------
 * Tela 0 · Minhas avaliações
 * --------------------------------------------------------------- */
let projectsSearchTerm = "";

function renderProjectsList() {
  const wrap = document.getElementById("projects-list");
  const all = projectList();
  const term = projectsSearchTerm.trim().toLowerCase();
  const list = term ? all.filter(p => (p.meta.nome || "").toLowerCase().includes(term)) : all;

  if (!all.length) {
    wrap.innerHTML = `<div class="projects-empty">Nenhuma avaliação ainda.</div>`;
    return;
  }
  if (!list.length) {
    wrap.innerHTML = `<div class="projects-empty">Nenhuma avaliação encontrada para "${escapeHtml(projectsSearchTerm.trim())}".</div>`;
    return;
  }
  wrap.innerHTML = "";
  list.forEach(p => {
    const result = computeAll(p);
    const div = document.createElement("div");
    div.className = "project-card" + (p.id === store.activeId ? " active" : "");
    const updated = new Date(p.updatedAt);
    div.innerHTML = `
      <div class="pc-main">
        <div class="pc-name">${escapeHtml(p.meta.nome || "Sem nome")}</div>
        <div class="pc-meta">
          <span>${escapeHtml(p.meta.resp || "sem responsável")}</span>
          <span>·</span>
          <span>Atualizado em ${updated.toLocaleDateString("pt-BR")}</span>
        </div>
      </div>
      <div class="pc-badges">
        <span class="trl-badge">TRL ${toDisplay(result.finalTol, p)}</span>
        <span class="status-tag na">${FRAMEWORKS[p.frameworkId].shortLabel}</span>
      </div>
      <div class="pc-actions">
        <button data-act="open">Abrir</button>
        <button data-act="dup">Duplicar</button>
        <button data-act="export">Exportar</button>
        <button data-act="del" class="pc-danger">Excluir</button>
      </div>`;
    div.querySelector('[data-act=open]').addEventListener("click", () => { switchProject(p.id); showScreen("dados"); });
    div.querySelector('[data-act=dup]').addEventListener("click", () => { duplicateProject(p.id); renderProjectsList(); });
    div.querySelector('[data-act=export]').addEventListener("click", () => exportProject(p.id));
    div.querySelector('[data-act=del]').addEventListener("click", async () => {
      const ok = await showConfirm(`Excluir a avaliação "${p.meta.nome || "Sem nome"}"? Essa ação não pode ser desfeita.`, { confirmLabel: "Excluir" });
      if (ok) {
        deleteProject(p.id);
        renderProjectsList();
      }
    });
    wrap.appendChild(div);
  });
}

document.getElementById("btn-new-project").addEventListener("click", () => {
  createProject();
  showScreen("dados");
});
document.getElementById("btn-import").addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importProjectFile(file);
  e.target.value = "";
});
document.getElementById("btn-export-all").addEventListener("click", () => exportAllProjects());
document.getElementById("projects-search").addEventListener("input", (e) => {
  projectsSearchTerm = e.target.value;
  renderProjectsList();
});

/* ---------------------------------------------------------------
 * Tela 1 · Início
 * --------------------------------------------------------------- */
function renderIsoRef() {
  document.getElementById("iso-ref-title").textContent =
    `Referência rápida — os ${frameworkLevels().length} níveis (${fw().label})`;
  const table = document.getElementById("iso-ref-table");
  let html = "<thead><tr><th>Nível</th><th>Marco alcançado</th><th>Realização de trabalho</th></tr></thead><tbody>";
  frameworkLevels().forEach(l => {
    html += `<tr><td><b>TRL ${toDisplay(l.level)}</b><br><span style="color:var(--text-faint);font-size:12px">${l.subtitle}</span></td>
      <td>${l.marco}</td><td>${l.realizacao}</td></tr>`;
  });
  html += "</tbody>";
  table.innerHTML = html;
}

document.getElementById("btn-start").addEventListener("click", () => showScreen("dados"));

/* ---------------------------------------------------------------
 * Tela 2 · Dados
 * --------------------------------------------------------------- */
function renderFrameworkOptions() {
  const wrap = document.getElementById("framework-options");
  wrap.innerHTML = "";
  FRAMEWORK_LIST.forEach(f => {
    const div = document.createElement("label");
    div.className = "group-option" + (state.frameworkId === f.id ? " selected" : "");
    div.innerHTML = `
      <input type="radio" name="framework" value="${f.id}" ${state.frameworkId === f.id ? "checked" : ""}>
      <div>
        <div class="g-title">${f.label}</div>
        <div class="g-sub">${f.scaleNote}</div>
      </div>`;
    div.querySelector("input").addEventListener("change", () => {
      state.frameworkId = f.id;
      if (state.currentLevel > f.maxInternalLevel) state.currentLevel = f.maxInternalLevel;
      saveState();
      renderFrameworkOptions();
      renderGroupOptions();
      renderIsoRef();
    });
    wrap.appendChild(div);
  });
}

function renderGroupOptions() {
  const wrap = document.getElementById("group-options");
  wrap.innerHTML = "";
  TRL_GROUPS.forEach(g => {
    const div = document.createElement("label");
    div.className = "group-option" + (state.groupId === g.id ? " selected" : "");
    div.innerHTML = `
      <input type="radio" name="group" value="${g.id}" ${state.groupId === g.id ? "checked" : ""}>
      <div>
        <div class="g-title">${groupLabel(g)} — ${g.name}</div>
        <div class="g-sub">${g.description}</div>
      </div>`;
    div.querySelector("input").addEventListener("change", () => {
      state.groupId = g.id;
      saveState();
      renderGroupOptions();
    });
    wrap.appendChild(div);
  });
}

function bindMetaInputs() {
  const nome = document.getElementById("inp-nome");
  const resp = document.getElementById("inp-resp");
  const data = document.getElementById("inp-data");
  nome.addEventListener("input", () => {
    state.meta.nome = nome.value; saveState();
    if (nome.value.trim()) document.getElementById("dados-validation").hidden = true;
  });
  resp.addEventListener("input", () => { state.meta.resp = resp.value; saveState(); });
  data.addEventListener("input", () => { state.meta.data = data.value; saveState(); });

  const tol = document.getElementById("inp-tolerancia");
  const tolOut = document.getElementById("tolerancia-out");
  tol.oninput = () => {
    state.tolerance = Number(tol.value);
    tolOut.textContent = state.tolerance;
    saveState();
  };
}

function renderDadosScreen() {
  document.getElementById("inp-nome").value = state.meta.nome;
  document.getElementById("inp-resp").value = state.meta.resp;
  document.getElementById("inp-data").value = state.meta.data;
  document.getElementById("inp-tolerancia").value = state.tolerance;
  document.getElementById("tolerancia-out").textContent = state.tolerance;
  document.getElementById("dados-validation").hidden = true;
  renderFrameworkOptions();
  renderGroupOptions();
}

document.getElementById("btn-to-avaliacao").addEventListener("click", () => {
  if (!state.meta.nome.trim()) {
    document.getElementById("dados-validation").hidden = false;
    document.getElementById("inp-nome").focus();
    return;
  }
  showScreen("avaliacao");
});

/* ---------------------------------------------------------------
 * Tela 3 · Avaliação
 * --------------------------------------------------------------- */
const STATUS_META = {
  "pass":               { pill: "pass",    label: "Atendido" },
  "pending":            { pill: "pending", label: "Em construção" },
  "blocked-nao":        { pill: "blocked", label: "★ Bloqueado" },
  "blocked-parcial":    { pill: "blocked", label: "★ Bloqueado" },
  "blocked-unanswered": { pill: "blocked", label: "★ Bloqueado" }
};

function renderLevelTabs() {
  const ceiling = ceilingLevel();
  const wrap = document.getElementById("level-tabs");
  wrap.innerHTML = "";
  frameworkLevels().forEach(def => {
    const inScope = def.level <= ceiling;
    const btn = document.createElement("button");
    btn.className = "level-tab" + (def.level === state.currentLevel ? " current" : "");
    let pctLabel = "fora do grupo";
    if (inScope) {
      const r = computeLevel(def.level);
      const meta = STATUS_META[r.status];
      btn.classList.add(meta.pill);
      pctLabel = Math.round(r.percent) + "%";
    }
    btn.innerHTML = `<span class="lt-num">TRL ${toDisplay(def.level)}</span><span class="lt-pct">${pctLabel}</span>`;
    btn.disabled = !inScope;
    btn.addEventListener("click", () => { state.currentLevel = def.level; renderLevel(def.level); });
    wrap.appendChild(btn);
  });
}

function renderLevel(level) {
  const def = levelDef(level);
  state.currentLevel = level;
  ensureAnswers(level);
  saveState();

  document.getElementById("lvl-chip").textContent = "TRL" + toDisplay(level);
  document.getElementById("lvl-eyebrow").textContent =
    `Nível ${levelPosition(level)} de ${frameworkLevels().length} · ${fw().shortLabel} · ${groupLabel(getGroup(state.groupId))}`;
  document.getElementById("lvl-title").textContent = def.subtitle;
  document.getElementById("lvl-marco").textContent = def.marco;
  document.getElementById("lvl-realizacao").textContent = def.realizacao;

  const qwrap = document.getElementById("lvl-questions");
  qwrap.innerHTML = "";
  def.questions.forEach((q, i) => qwrap.appendChild(renderQuestionRow(level, i, q)));

  document.getElementById("lvl-comment").value = state.comments[level] || "";
  document.getElementById("lvl-comment").oninput = (e) => {
    state.comments[level] = e.target.value; saveState();
  };

  updateLevelStatus(level);
  renderLevelTabs();

  document.getElementById("btn-prev-level").disabled = level <= frameworkLevels()[0].level;
  const ceiling = ceilingLevel();
  document.getElementById("btn-next-level").textContent = level >= ceiling ? "Ver resultado →" : "Próximo nível →";
}

function renderQuestionRow(level, index, q) {
  const answers = state.answers[level];
  const row = document.createElement("div");
  row.className = "q-row";
  const mandatoryChip = q.type === "N" ? `<span class="chip-mandatory">★ mandatório</span>` : "";
  row.innerHTML = `
    <div class="q-text">${q.text} ${mandatoryChip}</div>
    <div class="answer-group" role="group"></div>`;
  const group = row.querySelector(".answer-group");
  ANSWER_VALUES.forEach(v => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `answer-btn ${v}` + (answers[index] === v ? " active" : "");
    btn.textContent = ANSWER_LABELS[v].toUpperCase();
    btn.addEventListener("click", () => {
      answers[index] = answers[index] === v ? null : v; // clicar de novo desmarca
      saveState();
      renderLevel(level);
    });
    group.appendChild(btn);
  });
  return row;
}

function updateLevelStatus(level) {
  const r = computeLevel(level);
  const meta = STATUS_META[r.status];

  const pill = document.getElementById("lvl-status-pill");
  pill.className = "status-pill " + meta.pill;
  document.getElementById("lvl-status-text").textContent = `${meta.label} · ${Math.round(r.percent)}%`;

  const seg = document.getElementById("lvl-segmented");
  const answers = state.answers[level] || [];
  seg.innerHTML = answers.map(a => `<span class="seg ${a || "empty"}"></span>`).join("");

  const alert = levelAlert(r);
  const alertEl = document.getElementById("lvl-alert");
  alertEl.className = "alert-banner " + alert.type;
  alertEl.innerHTML = `<span class="alert-icon">${alert.icon}</span><span>${alert.text}</span>`;

  const nextBtn = document.getElementById("btn-next-level");
  nextBtn.disabled = !r.canAdvance;
  nextBtn.title = r.canAdvance ? "" : "Resolva os pontos indicados no alerta abaixo para avançar.";
}

document.getElementById("lvl-iso-toggle").addEventListener("click", () => {
  const box = document.getElementById("lvl-iso-ref");
  box.hidden = !box.hidden;
});

document.getElementById("btn-prev-level").addEventListener("click", () => {
  if (state.currentLevel > frameworkLevels()[0].level) renderLevel(state.currentLevel - 1);
});
document.getElementById("btn-next-level").addEventListener("click", () => {
  const ceiling = ceilingLevel();
  if (state.currentLevel >= ceiling) { showScreen("resultado"); }
  else renderLevel(state.currentLevel + 1);
});
document.getElementById("btn-peek-result").addEventListener("click", () => showScreen("resultado"));

/* ---------------------------------------------------------------
 * Tela 4 · Resultado
 * --------------------------------------------------------------- */
function ladderHtml(result) {
  let html = "";
  result.rows.forEach(row => {
    let cls = "pending", sub = "fora do grupo";
    if (row.inScope) {
      cls = row.passTol ? "pass" : "fail";
      sub = row.percent === null ? "—" : Math.round(row.percent) + "%";
    }
    html += `<div class="rung ${cls}">TRL ${toDisplay(row.level)}<span class="sub">${sub}</span></div>`;
  });
  return html;
}

function tableRowsHtml(result) {
  return result.rows.map(row => {
    if (!row.inScope) {
      return `<tr><td>TRL ${toDisplay(row.level)}</td><td class="num">—</td><td class="num"><span class="status-tag na">fora do grupo</span></td><td class="num"><span class="status-tag na">fora do grupo</span></td></tr>`;
    }
    return `<tr>
      <td>TRL ${toDisplay(row.level)}</td>
      <td class="num">${Math.round(row.percent)}%</td>
      <td class="num"><span class="status-tag ${row.passTol ? "ok" : "bad"}">${row.passTol ? "Atingido" : "Não atingido"}</span></td>
      <td class="num"><span class="status-tag ${row.passIso ? "ok" : "bad"}">${row.passIso ? "Atingido" : "Não atingido"}</span></td>
    </tr>`;
  }).join("");
}

function renderResultado() {
  const result = computeAll();

  document.getElementById("res-nome").textContent = state.meta.nome || "—";
  document.getElementById("res-resp").textContent = state.meta.resp || "—";
  document.getElementById("res-data").textContent = formatDate(state.meta.data);
  document.getElementById("res-metodologia").textContent = fw().label;

  document.getElementById("res-trl-tol").textContent = "TRL " + toDisplay(result.finalTol);
  document.getElementById("res-trl-iso").textContent = "TRL " + toDisplay(result.finalIso);

  document.getElementById("ladder").innerHTML = ladderHtml(result);
  document.getElementById("res-table").querySelector("tbody").innerHTML = tableRowsHtml(result);
  document.getElementById("res-evidence").innerHTML = evidenceChartHtml(evidenceChartData());
  document.getElementById("res-nextsteps").innerHTML = nextStepsHtml(nextStepsData(result));

  const historyCard = document.getElementById("res-history-card");
  if (state.history.length) {
    historyCard.hidden = false;
    document.getElementById("res-history").innerHTML = timelineHtml(state.history);
  } else {
    historyCard.hidden = true;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

document.getElementById("btn-snapshot").addEventListener("click", () => {
  recordSnapshot();
  renderResultado();
});
document.getElementById("btn-export").addEventListener("click", () => exportProject(store.activeId));
document.getElementById("btn-new-from-result").addEventListener("click", async () => {
  const ok = await showConfirm('Iniciar uma nova avaliação? A avaliação atual continua salva em "Minhas avaliações".', { confirmLabel: "Nova avaliação", danger: false });
  if (ok) {
    createProject();
    showScreen("dados");
  }
});

/* ---------------------------------------------------------------
 * Relatório imprimível
 * --------------------------------------------------------------- */
document.getElementById("btn-report").addEventListener("click", () => {
  recordSnapshot();
  buildReport();
  window.print();
});

/* "Visualizar relatório" mostra o mesmo conteúdo em tela, como
 * alternativa a imprimir — útil em qualquer navegador, e essencial
 * onde window.print() está bloqueado (ex.: dentro do sandbox de uma
 * prévia de Artifact, que trata print() como um diálogo modal). */
function openReportPreview() {
  recordSnapshot();
  buildReport();
  document.getElementById("report-root").hidden = false;
}
function closeReportPreview() {
  document.getElementById("report-root").hidden = true;
}
document.getElementById("btn-report-preview").addEventListener("click", openReportPreview);
document.getElementById("report-close").addEventListener("click", closeReportPreview);
document.getElementById("report-print-from-preview").addEventListener("click", () => window.print());
document.getElementById("report-root").addEventListener("click", (e) => {
  if (e.target.id === "report-root") closeReportPreview();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("report-root").hidden) closeReportPreview();
});

function buildReport() {
  const result = computeAll();

  document.getElementById("rep-gendate").textContent = "Gerado em " + new Date().toLocaleString("pt-BR");
  document.getElementById("rep-nome").textContent = state.meta.nome || "—";
  document.getElementById("rep-resp").textContent = state.meta.resp || "—";
  document.getElementById("rep-data").textContent = formatDate(state.meta.data);
  document.getElementById("rep-metodologia").textContent = fw().label;
  document.getElementById("rep-trl-tol").textContent = "TRL " + toDisplay(result.finalTol);
  document.getElementById("rep-trl-iso").textContent = "TRL " + toDisplay(result.finalIso);
  document.getElementById("rep-tol-pct").textContent = state.tolerance + "%";
  document.getElementById("rep-ladder").innerHTML = ladderHtml(result);
  document.getElementById("rep-table").querySelector("tbody").innerHTML = tableRowsHtml(result);
  document.getElementById("rep-evidence").innerHTML = evidenceChartHtml(evidenceChartData());
  document.getElementById("rep-nextsteps").innerHTML = nextStepsHtml(nextStepsData(result));
  document.getElementById("rep-citation").textContent = fw().citation;

  document.getElementById("rep-history-section").style.display = state.history.length ? "" : "none";
  document.getElementById("rep-history").innerHTML = state.history.length ? timelineHtml(state.history) : "";

  const commentsWrap = document.getElementById("rep-comments");
  commentsWrap.innerHTML = "";
  let any = false;
  frameworkLevels().forEach(def => {
    const c = state.comments[def.level];
    if (c && c.trim()) {
      any = true;
      const p = document.createElement("p");
      p.innerHTML = `<b>TRL ${toDisplay(def.level)}:</b> ${escapeHtml(c)}`;
      commentsWrap.appendChild(p);
    }
  });
  document.getElementById("rep-comments-section").style.display = any ? "" : "none";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------
 * Barra de projeto / progresso global
 * --------------------------------------------------------------- */
function refreshProjectBar() {
  document.getElementById("project-bar-name").textContent = state.meta.nome || "Sem nome";
  document.getElementById("project-bar-meta").textContent =
    `${fw().shortLabel} · grupo ${groupLabel(getGroup(state.groupId))} · tolerância ${state.tolerance}%`;
}

function updateGlobalProgress() {
  const result = computeAll();
  let total = 0, done = 0;
  result.rows.forEach(row => {
    if (!row.inScope) return;
    const def = levelDef(row.level);
    const answers = state.answers[row.level] || [];
    total += def.questions.length;
    done += answers.filter(a => a !== null && a !== undefined).length;
  });
  const pct = total ? (done / total * 100) : 0;
  document.getElementById("global-progress-fill").style.width = pct + "%";
}

/* ---------------------------------------------------------------
 * Init
 * --------------------------------------------------------------- */
function init() {
  renderIsoRef();
  renderDadosScreen();
  bindMetaInputs();
  refreshProjectBar();
  updateGlobalProgress();
  showScreen("inicio");
}
init();

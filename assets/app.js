/* ===================================================================
 * Calculadora de TRL — lógica da aplicação
 *
 * Metodologia (replicada a partir da planilha original):
 *   - Cada nível de TRL possui critérios "N" (NBR ISO 16290:2015,
 *     obrigatórios, resposta sim/não) e "I" (adicionais/institucionais,
 *     resposta em % de conclusão, de 0 a 100, passo 5).
 *   - Nota do nível = média de todos os critérios do nível, onde um
 *     critério N vale 100 (atendido) ou 0 (não atendido) e um critério
 *     I vale o seu próprio percentual.
 *   - Um nível "com tolerância" é considerado ATINGIDO quando essa nota
 *     é >= tolerância definida pelo usuário (padrão 33%, igual à
 *     planilha original).
 *   - Um nível "ISO estrito" é considerado ATINGIDO quando TODOS os
 *     critérios N do nível estão marcados como atendidos (sem
 *     tolerância — leitura literal da norma).
 *   - Por definição, a maturidade é cumulativa: o TRL final é o maior
 *     nível em que TODOS os níveis anteriores também foram atingidos.
 * =================================================================== */

const STORAGE_KEY = "trl-calculadora-state-v2";

/* Cada resposta é um tri-estado: "sim" | "parcial" | "nao" | null (não respondido). */
const ANSWER_VALUES = ["sim", "parcial", "nao"];
const ANSWER_LABELS = { sim: "Sim", parcial: "Parcial", nao: "Não" };
const ANSWER_POINTS = { sim: 100, parcial: 50, nao: 0 };

const DEFAULT_STATE = () => ({
  meta: { nome: "", resp: "", data: "" },
  groupId: 3,
  tolerance: 33,
  currentLevel: 1,
  answers: {},   // { [level]: ["sim"|"parcial"|"nao"|null, ...] }
  comments: {}   // { [level]: string }
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE(), ...parsed };
  } catch (e) {
    return DEFAULT_STATE();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getGroup(id) { return TRL_GROUPS.find(g => g.id === id); }
function ceilingLevel() { return getGroup(state.groupId).ceiling; }

function ensureAnswers(level) {
  const def = TRL_LEVELS.find(l => l.level === level);
  if (!state.answers[level]) {
    state.answers[level] = def.questions.map(() => null);
  }
  return state.answers[level];
}

/* ---------------------------------------------------------------
 * Cálculo
 *
 * Cada critério (N ou I) é respondido em três estados: Sim (100
 * pontos), Parcial (50) ou Não (0); não respondido conta como 0.
 *
 * Um nível só pode ser AVANÇADO quando:
 *   1) todos os critérios N (NBR ISO 16290, marcados como "obrigatório")
 *      estiverem respondidos como "Sim" — um único N como "Parcial",
 *      "Não" ou em branco BLOQUEIA o nível, independente da nota; e
 *   2) a nota do nível (média de todos os critérios) atinge a
 *      tolerância mínima definida em "Dados".
 * --------------------------------------------------------------- */
function computeLevel(level) {
  const def = TRL_LEVELS.find(l => l.level === level);
  const answers = state.answers[level];
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
  const thresholdOk = percent >= state.tolerance;
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

function computeAll() {
  const ceiling = ceilingLevel();
  const rows = [];
  let cumTol = true, cumIso = true;
  let finalTol = 0, finalIso = 0;

  for (const def of TRL_LEVELS) {
    const inScope = def.level <= ceiling;
    if (!inScope) {
      rows.push({ level: def.level, percent: null, passTol: null, passIso: null, inScope: false });
      continue;
    }
    const r = computeLevel(def.level);
    cumTol = cumTol && r.passTol;
    cumIso = cumIso && r.passIso;
    if (cumTol) finalTol = def.level;
    if (cumIso) finalIso = def.level;
    rows.push({ level: def.level, percent: r.percent, passTol: r.passTol, passIso: r.passIso,
                cumTol, cumIso, inScope: true });
  }
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
 * Navegação entre telas
 * --------------------------------------------------------------- */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
  document.querySelectorAll("#stepper button").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === name);
  });
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
 * Tela 1 · Início
 * --------------------------------------------------------------- */
function renderIsoRef() {
  const table = document.getElementById("iso-ref-table");
  let html = "<thead><tr><th>Nível</th><th>Marco alcançado</th><th>Realização de trabalho</th></tr></thead><tbody>";
  TRL_LEVELS.forEach(l => {
    html += `<tr><td><b>${l.title}</b><br><span style="color:var(--gray-500);font-size:12px">${l.subtitle}</span></td>
      <td>${l.marco}</td><td>${l.realizacao}</td></tr>`;
  });
  html += "</tbody>";
  table.innerHTML = html;
}

document.getElementById("btn-start").addEventListener("click", () => showScreen("dados"));

/* ---------------------------------------------------------------
 * Tela 2 · Dados
 * --------------------------------------------------------------- */
function renderGroupOptions() {
  const wrap = document.getElementById("group-options");
  wrap.innerHTML = "";
  TRL_GROUPS.forEach(g => {
    const div = document.createElement("label");
    div.className = "group-option" + (state.groupId === g.id ? " selected" : "");
    div.innerHTML = `
      <input type="radio" name="group" value="${g.id}" ${state.groupId === g.id ? "checked" : ""}>
      <div>
        <div class="g-title">${g.label} — ${g.name}</div>
        <div class="g-sub">${g.description}</div>
      </div>`;
    div.querySelector("input").addEventListener("change", () => {
      state.groupId = g.id;
      if (state.currentLevel > g.ceiling) state.currentLevel = g.ceiling;
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
  nome.value = state.meta.nome; resp.value = state.meta.resp; data.value = state.meta.data;
  nome.addEventListener("input", () => { state.meta.nome = nome.value; saveState(); });
  resp.addEventListener("input", () => { state.meta.resp = resp.value; saveState(); });
  data.addEventListener("input", () => { state.meta.data = data.value; saveState(); });

  const tol = document.getElementById("inp-tolerancia");
  const tolOut = document.getElementById("tolerancia-out");
  tol.value = state.tolerance; tolOut.textContent = state.tolerance;
  tol.addEventListener("input", () => {
    state.tolerance = Number(tol.value);
    tolOut.textContent = state.tolerance;
    saveState();
  });
}

document.getElementById("btn-to-avaliacao").addEventListener("click", () => showScreen("avaliacao"));

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
  TRL_LEVELS.forEach(def => {
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
    btn.innerHTML = `<span class="lt-num">TRL ${def.level}</span><span class="lt-pct">${pctLabel}</span>`;
    btn.disabled = !inScope;
    btn.addEventListener("click", () => { state.currentLevel = def.level; renderLevel(def.level); });
    wrap.appendChild(btn);
  });
}

function renderLevel(level) {
  const def = TRL_LEVELS.find(l => l.level === level);
  state.currentLevel = level;
  ensureAnswers(level);
  saveState();

  document.getElementById("lvl-chip").textContent = "TRL" + level;
  document.getElementById("lvl-eyebrow").textContent = `Nível ${level} de 9 · ${getGroup(state.groupId).label}`;
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

  document.getElementById("btn-prev-level").disabled = level <= 1;
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
  if (state.currentLevel > 1) renderLevel(state.currentLevel - 1);
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
    html += `<div class="rung ${cls}">TRL ${row.level}<span class="sub">${sub}</span></div>`;
  });
  return html;
}

function tableRowsHtml(result) {
  return result.rows.map(row => {
    if (!row.inScope) {
      return `<tr><td>TRL ${row.level}</td><td class="num">—</td><td class="num"><span class="status-tag na">fora do grupo</span></td><td class="num"><span class="status-tag na">fora do grupo</span></td></tr>`;
    }
    return `<tr>
      <td>TRL ${row.level}</td>
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

  document.getElementById("res-trl-tol").textContent = "TRL " + result.finalTol;
  document.getElementById("res-trl-iso").textContent = "TRL " + result.finalIso;

  document.getElementById("ladder").innerHTML = ladderHtml(result);
  document.getElementById("res-table").querySelector("tbody").innerHTML = tableRowsHtml(result);
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm("Isso irá apagar todas as respostas da avaliação atual. Deseja continuar?")) {
    localStorage.removeItem(STORAGE_KEY);
    state = DEFAULT_STATE();
    showScreen("inicio");
    init();
  }
});

/* ---------------------------------------------------------------
 * Relatório imprimível
 * --------------------------------------------------------------- */
document.getElementById("btn-report").addEventListener("click", () => {
  buildReport();
  window.print();
});

function buildReport() {
  const result = computeAll();

  document.getElementById("rep-gendate").textContent = "Gerado em " + new Date().toLocaleString("pt-BR");
  document.getElementById("rep-nome").textContent = state.meta.nome || "—";
  document.getElementById("rep-resp").textContent = state.meta.resp || "—";
  document.getElementById("rep-data").textContent = formatDate(state.meta.data);
  document.getElementById("rep-trl-tol").textContent = "TRL " + result.finalTol;
  document.getElementById("rep-trl-iso").textContent = "TRL " + result.finalIso;
  document.getElementById("rep-tol-pct").textContent = state.tolerance + "%";
  document.getElementById("rep-ladder").innerHTML = ladderHtml(result);
  document.getElementById("rep-table").querySelector("tbody").innerHTML = tableRowsHtml(result);

  const commentsWrap = document.getElementById("rep-comments");
  commentsWrap.innerHTML = "";
  let any = false;
  TRL_LEVELS.forEach(def => {
    const c = state.comments[def.level];
    if (c && c.trim()) {
      any = true;
      const p = document.createElement("p");
      p.innerHTML = `<b>${def.title}:</b> ${escapeHtml(c)}`;
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
 * Init
 * --------------------------------------------------------------- */
function init() {
  renderIsoRef();
  renderGroupOptions();
  bindMetaInputs();
  showScreen("inicio");
}
init();

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

const STORAGE_KEY = "trl-calculadora-state-v1";

const DEFAULT_STATE = () => ({
  meta: { nome: "", resp: "", data: "" },
  groupId: 3,
  tolerance: 33,
  currentLevel: 1,
  answers: {},   // { [level]: [bool|number, ...] }
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
    state.answers[level] = def.questions.map(q => q.type === "N" ? false : 0);
  }
  return state.answers[level];
}

/* ---------------------------------------------------------------
 * Cálculo
 * --------------------------------------------------------------- */
function computeLevel(level) {
  const def = TRL_LEVELS.find(l => l.level === level);
  const answers = state.answers[level];
  if (!answers) return { percent: 0, passTol: false, passIso: false, answered: false };

  let points = 0;
  let nTotal = 0, nOk = 0;
  def.questions.forEach((q, i) => {
    const val = answers[i];
    if (q.type === "N") {
      nTotal++;
      if (val === true) nOk++;
      points += val === true ? 100 : 0;
    } else {
      points += Number(val) || 0;
    }
  });
  const percent = def.questions.length ? points / def.questions.length : 0;
  const passTol = percent >= state.tolerance;
  const passIso = nTotal === 0 ? true : nOk === nTotal;
  return { percent, passTol, passIso, answered: true };
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
function renderLevelTabs() {
  const ceiling = ceilingLevel();
  const wrap = document.getElementById("level-tabs");
  wrap.innerHTML = "";
  TRL_LEVELS.forEach(def => {
    const inScope = def.level <= ceiling;
    const btn = document.createElement("button");
    btn.className = "level-tab" + (def.level === state.currentLevel ? " current" : "");
    if (inScope && state.answers[def.level]) {
      const r = computeLevel(def.level);
      btn.classList.add(r.passTol ? "pass" : "fail");
    }
    btn.innerHTML = `<span class="lt-num">TRL ${def.level}</span><span class="lt-pct">${
      inScope ? (state.answers[def.level] ? Math.round(computeLevel(def.level).percent) + "%" : "—") : "fora do grupo"
    }</span>`;
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

  document.getElementById("lvl-title").textContent = `${def.title} — ${def.subtitle}`;
  document.getElementById("lvl-subtitle").textContent =
    `Grupo: ${getGroup(state.groupId).label} · Critério de aprovação: nota ≥ ${state.tolerance}% (com tolerância) ou todos os critérios ISO atendidos (leitura estrita)`;
  document.getElementById("lvl-marco").textContent = def.marco;
  document.getElementById("lvl-realizacao").textContent = def.realizacao;

  const qwrap = document.getElementById("lvl-questions");
  qwrap.innerHTML = "";

  const nQs = def.questions.filter(q => q.type === "N");
  const iQs = def.questions.filter(q => q.type === "I");

  if (nQs.length) {
    qwrap.appendChild(sectionHeader("Critérios NBR ISO 16290:2015", "n", "obrigatório"));
    def.questions.forEach((q, i) => { if (q.type === "N") qwrap.appendChild(renderNRow(level, i, q)); });
  }
  if (iQs.length) {
    qwrap.appendChild(sectionHeader("Critérios institucionais adicionais", "i", "% com tolerância"));
    def.questions.forEach((q, i) => { if (q.type === "I") qwrap.appendChild(renderIRow(level, i, q)); });
  }

  document.getElementById("lvl-comment").value = state.comments[level] || "";
  document.getElementById("lvl-comment").oninput = (e) => {
    state.comments[level] = e.target.value; saveState();
  };

  updateLevelScore(level);
  renderLevelTabs();

  document.getElementById("btn-prev-level").disabled = level <= 1;
  const ceiling = ceilingLevel();
  document.getElementById("btn-next-level").textContent = level >= ceiling ? "Ver resultado →" : "Próximo nível →";
}

function sectionHeader(text, cls, tag) {
  const h = document.createElement("h3");
  h.innerHTML = `${text} <span class="chip ${cls}">${tag}</span>`;
  return h;
}

function renderNRow(level, index, q) {
  const answers = state.answers[level];
  const row = document.createElement("div");
  row.className = "q-row";
  row.innerHTML = `
    <div class="q-text">${q.text}</div>
    <div class="q-control">
      <span style="font-size:12.5px;color:var(--gray-500)">${answers[index] ? "Atendido" : "Não atendido"}</span>
      <label class="switch">
        <input type="checkbox" ${answers[index] ? "checked" : ""}>
        <span class="track"></span>
      </label>
    </div>`;
  row.querySelector("input").addEventListener("change", (e) => {
    answers[index] = e.target.checked;
    saveState();
    renderLevel(level);
  });
  return row;
}

function renderIRow(level, index, q) {
  const answers = state.answers[level];
  const row = document.createElement("div");
  row.className = "q-row";
  row.innerHTML = `
    <div class="q-text">${q.text}</div>
    <div class="q-control">
      <div class="slider-control">
        <input type="range" min="0" max="100" step="5" value="${answers[index]}">
        <span class="pct">${answers[index]}%</span>
      </div>
    </div>`;
  const input = row.querySelector("input");
  const pctLabel = row.querySelector(".pct");
  input.addEventListener("input", () => {
    answers[index] = Number(input.value);
    pctLabel.textContent = answers[index] + "%";
    saveState();
    updateLevelScore(level);
    renderLevelTabs();
  });
  return row;
}

function updateLevelScore(level) {
  const r = computeLevel(level);
  document.getElementById("lvl-pct").textContent = Math.round(r.percent) + "%";
  document.getElementById("lvl-progress").style.width = Math.min(100, r.percent) + "%";
}

document.getElementById("btn-prev-level").addEventListener("click", () => {
  if (state.currentLevel > 1) renderLevel(state.currentLevel - 1);
});
document.getElementById("btn-next-level").addEventListener("click", () => {
  const ceiling = ceilingLevel();
  if (state.currentLevel >= ceiling) { showScreen("resultado"); }
  else renderLevel(state.currentLevel + 1);
});

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

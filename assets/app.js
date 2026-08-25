/* ===================================================================
 * Calculadora de TRL — lógica da aplicação
 *
 * Metodologia (replicada a partir da planilha original, com suporte a
 * múltiplas réguas de maturidade — ver FRAMEWORKS em questions.js):
 *   - Cada nível possui critérios "N" (obrigatórios/mandatórios,
 *     marcados com ★) e, na régua NASA/ISO, também critérios "I"
 *     (adicionais/institucionais). Todos são respondidos em três
 *     estados: Sim (100 pontos), Parcial (50) ou Não (0).
 *   - Nota do nível = média de todos os critérios do nível.
 *   - Um nível só pode ser AVANÇADO quando todos os critérios ★
 *     estiverem em "Sim" (bloqueio duro, sem tolerância) E a nota do
 *     nível atingir a tolerância mínima definida pelo usuário.
 *   - Um nível "ISO estrito" é atingido quando todos os critérios ★
 *     estão em "Sim", independente da nota dos demais critérios.
 *   - A maturidade é cumulativa: o TRL final é o maior nível em que
 *     todos os níveis anteriores também foram atingidos.
 * =================================================================== */

const STORAGE_KEY = "trl-calculadora-state-v3";

const ANSWER_VALUES = ["sim", "parcial", "nao"];
const ANSWER_LABELS = { sim: "Sim", parcial: "Parcial", nao: "Não" };
const ANSWER_POINTS = { sim: 100, parcial: 50, nao: 0 };

function defaultFrameworkState(framework) {
  const groups = framework.groups;
  return {
    groupId: groups[groups.length - 1].id, // grupo mais amplo por padrão
    tolerance: 33,
    currentLevel: framework.minLevel,
    answers: {},   // { [level]: ["sim"|"parcial"|"nao"|null, ...] }
    comments: {}   // { [level]: string }
  };
}

const DEFAULT_STATE = () => {
  const byFramework = {};
  FRAMEWORK_LIST.forEach(f => { byFramework[f.id] = defaultFrameworkState(f); });
  return {
    meta: { nome: "", resp: "", data: "" },
    frameworkId: "nasa",
    byFramework
  };
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    const base = DEFAULT_STATE();
    // merge raso, preservando qualquer estado de framework já default-preenchido
    return {
      ...base,
      ...parsed,
      byFramework: { ...base.byFramework, ...(parsed.byFramework || {}) }
    };
  } catch (e) {
    return DEFAULT_STATE();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* fw()  = definição da metodologia ativa (níveis, grupos, metadados)
 * fst() = estado (respostas/comentários/tolerância/grupo) da metodologia ativa */
function fw() { return FRAMEWORKS[state.frameworkId]; }
function fst() { return state.byFramework[state.frameworkId]; }

function getGroup(id) { return fw().groups.find(g => g.id === id); }
function ceilingLevel() { return getGroup(fst().groupId).ceiling; }
function levelDef(level) { return fw().levels.find(l => l.level === level); }
function levelPosition(level) { return fw().levels.findIndex(l => l.level === level) + 1; }

function ensureAnswers(level) {
  const def = levelDef(level);
  if (!fst().answers[level]) {
    fst().answers[level] = def.questions.map(() => null);
  }
  return fst().answers[level];
}

/* ---------------------------------------------------------------
 * Cálculo
 * --------------------------------------------------------------- */
function computeLevel(level) {
  const def = levelDef(level);
  const answers = fst().answers[level];
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
  const thresholdOk = percent >= fst().tolerance;
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
  let finalTol = null, finalIso = null;

  for (const def of fw().levels) {
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
  if (finalTol === null) finalTol = fw().minLevel - 1;
  if (finalIso === null) finalIso = fw().minLevel - 1;
  return { rows, finalTol, finalIso, ceiling };
}

function levelAlert(r) {
  const tol = fst().tolerance;
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
    if (result.finalTol >= fw().maxLevel) return { done: true, maxed: true };
    return { done: true, maxed: false, ceiling: result.ceiling };
  }
  const def = levelDef(target.level);
  const answers = fst().answers[target.level] || [];
  const pending = def.questions
    .map((q, i) => ({ q, val: answers[i] }))
    .filter(x => x.val !== "sim");
  const mandatoryPending = pending.filter(x => x.q.type === "N");
  const priority = mandatoryPending[0] || pending[0] || null;
  const rest = priority ? pending.filter(x => x !== priority) : [];
  return { done: false, level: def, priority, rest };
}

function nextStepsHtml(ns) {
  if (ns.done) {
    if (ns.maxed) {
      return `<div class="nextstep-card done"><div class="ns-head">🏁 Maturidade máxima da régua atingida</div>
        <p>A tecnologia atingiu o nível mais alto de ${fw().shortLabel} (TRL ${fw().maxLevel}). Não há próximos passos dentro desta metodologia.</p></div>`;
    }
    return `<div class="nextstep-card done"><div class="ns-head">✓ Grupo avaliado concluído</div>
      <p>Todos os níveis do grupo selecionado (até TRL ${ns.ceiling}) foram atingidos. Para continuar, amplie o grupo alvo em "Dados" e prossiga a avaliação.</p></div>`;
  }
  const p = ns.priority;
  const priorityHtml = p
    ? `<b>Prioridade:</b> ${p.q.type === "N" ? "Atender o critério obrigatório" : "Elevar para “Sim” o critério"} — ${escapeHtml(p.q.text)}`
    : `<b>Prioridade:</b> concluir os critérios restantes deste nível.`;
  const restHtml = ns.rest.length
    ? `<b>Considere também:</b><ul>${ns.rest.map(x => `<li>${x.q.type === "N" ? "★ " : ""}${escapeHtml(x.q.text)}</li>`).join("")}</ul>`
    : "";
  return `
    <div class="nextstep-card">
      <div class="ns-head">→ Próximo passo — para avançar ao ${ns.level.title} (${escapeHtml(ns.level.subtitle)})</div>
      <p>${priorityHtml}</p>
      ${restHtml}
    </div>`;
}

/* ---------------------------------------------------------------
 * Gráfico de qualidade da evidência por nível
 * --------------------------------------------------------------- */
function evidenceChartData() {
  return fw().levels.map(def => {
    const answers = fst().answers[def.level];
    if (!answers || answers.every(a => a === null)) {
      return { level: def.level, state: "none" };
    }
    const r = computeLevel(def.level);
    if (r.mandatoryIssue === "nao" || r.mandatoryIssue === "parcial") {
      return { level: def.level, state: "blocked", percent: r.percent };
    }
    let band;
    if (r.percent >= 80) band = "forte";
    else if (r.percent >= 60) band = "bom";
    else if (r.percent >= 40) band = "parcial";
    else band = "fraco";
    return { level: def.level, state: "scored", band, percent: r.percent };
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
 * Navegação entre telas
 * --------------------------------------------------------------- */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
  document.querySelectorAll("#stepper button").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === name);
  });
  if (name === "avaliacao") renderLevel(fst().currentLevel);
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
  document.getElementById("iso-ref-title").textContent =
    `Referência rápida — os ${fw().levels.length} níveis (${fw().label})`;
  const table = document.getElementById("iso-ref-table");
  let html = "<thead><tr><th>Nível</th><th>Marco alcançado</th><th>Realização de trabalho</th></tr></thead><tbody>";
  fw().levels.forEach(l => {
    html += `<tr><td><b>${l.title}</b><br><span style="color:var(--text-faint);font-size:12px">${l.subtitle}</span></td>
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
      saveState();
      renderFrameworkOptions();
      renderGroupOptions();
      bindToleranceInput();
      renderIsoRef();
      updateTopbarBadge();
    });
    wrap.appendChild(div);
  });
}

function renderGroupOptions() {
  const wrap = document.getElementById("group-options");
  wrap.innerHTML = "";
  fw().groups.forEach(g => {
    const div = document.createElement("label");
    div.className = "group-option" + (fst().groupId === g.id ? " selected" : "");
    div.innerHTML = `
      <input type="radio" name="group" value="${g.id}" ${fst().groupId === g.id ? "checked" : ""}>
      <div>
        <div class="g-title">${g.label} — ${g.name}</div>
        <div class="g-sub">${g.description}</div>
      </div>`;
    div.querySelector("input").addEventListener("change", () => {
      fst().groupId = g.id;
      if (fst().currentLevel > g.ceiling) fst().currentLevel = g.ceiling;
      saveState();
      renderGroupOptions();
    });
    wrap.appendChild(div);
  });
}

function bindToleranceInput() {
  const tol = document.getElementById("inp-tolerancia");
  const tolOut = document.getElementById("tolerancia-out");
  tol.value = fst().tolerance;
  tolOut.textContent = fst().tolerance;
  tol.oninput = () => {
    fst().tolerance = Number(tol.value);
    tolOut.textContent = fst().tolerance;
    saveState();
  };
}

function bindMetaInputs() {
  const nome = document.getElementById("inp-nome");
  const resp = document.getElementById("inp-resp");
  const data = document.getElementById("inp-data");
  nome.value = state.meta.nome; resp.value = state.meta.resp; data.value = state.meta.data;
  nome.addEventListener("input", () => { state.meta.nome = nome.value; saveState(); });
  resp.addEventListener("input", () => { state.meta.resp = resp.value; saveState(); });
  data.addEventListener("input", () => { state.meta.data = data.value; saveState(); });
  bindToleranceInput();
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
  fw().levels.forEach(def => {
    const inScope = def.level <= ceiling;
    const btn = document.createElement("button");
    btn.className = "level-tab" + (def.level === fst().currentLevel ? " current" : "");
    let pctLabel = "fora do grupo";
    if (inScope) {
      const r = computeLevel(def.level);
      const meta = STATUS_META[r.status];
      btn.classList.add(meta.pill);
      pctLabel = Math.round(r.percent) + "%";
    }
    btn.innerHTML = `<span class="lt-num">TRL ${def.level}</span><span class="lt-pct">${pctLabel}</span>`;
    btn.disabled = !inScope;
    btn.addEventListener("click", () => { fst().currentLevel = def.level; renderLevel(def.level); });
    wrap.appendChild(btn);
  });
}

function renderLevel(level) {
  const def = levelDef(level);
  fst().currentLevel = level;
  ensureAnswers(level);
  saveState();

  document.getElementById("lvl-chip").textContent = "TRL" + level;
  document.getElementById("lvl-eyebrow").textContent =
    `Nível ${levelPosition(level)} de ${fw().levels.length} · ${fw().shortLabel} · ${getGroup(fst().groupId).label}`;
  document.getElementById("lvl-title").textContent = def.subtitle;
  document.getElementById("lvl-marco").textContent = def.marco;
  document.getElementById("lvl-realizacao").textContent = def.realizacao;

  const qwrap = document.getElementById("lvl-questions");
  qwrap.innerHTML = "";
  def.questions.forEach((q, i) => qwrap.appendChild(renderQuestionRow(level, i, q)));

  document.getElementById("lvl-comment").value = fst().comments[level] || "";
  document.getElementById("lvl-comment").oninput = (e) => {
    fst().comments[level] = e.target.value; saveState();
  };

  updateLevelStatus(level);
  renderLevelTabs();

  document.getElementById("btn-prev-level").disabled = level <= fw().minLevel;
  const ceiling = ceilingLevel();
  document.getElementById("btn-next-level").textContent = level >= ceiling ? "Ver resultado →" : "Próximo nível →";
}

function renderQuestionRow(level, index, q) {
  const answers = fst().answers[level];
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
  const answers = fst().answers[level] || [];
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
  if (fst().currentLevel > fw().minLevel) renderLevel(fst().currentLevel - 1);
});
document.getElementById("btn-next-level").addEventListener("click", () => {
  const ceiling = ceilingLevel();
  if (fst().currentLevel >= ceiling) { showScreen("resultado"); }
  else renderLevel(fst().currentLevel + 1);
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
  document.getElementById("res-metodologia").textContent = fw().label;

  document.getElementById("res-trl-tol").textContent = "TRL " + result.finalTol;
  document.getElementById("res-trl-iso").textContent = "TRL " + result.finalIso;

  document.getElementById("ladder").innerHTML = ladderHtml(result);
  document.getElementById("res-table").querySelector("tbody").innerHTML = tableRowsHtml(result);
  document.getElementById("res-evidence").innerHTML = evidenceChartHtml(evidenceChartData());
  document.getElementById("res-nextsteps").innerHTML = nextStepsHtml(nextStepsData(result));
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm("Isso irá apagar todas as respostas da avaliação atual (em todas as metodologias). Deseja continuar?")) {
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
  document.getElementById("rep-metodologia").textContent = fw().label;
  document.getElementById("rep-trl-tol").textContent = "TRL " + result.finalTol;
  document.getElementById("rep-trl-iso").textContent = "TRL " + result.finalIso;
  document.getElementById("rep-tol-pct").textContent = fst().tolerance + "%";
  document.getElementById("rep-ladder").innerHTML = ladderHtml(result);
  document.getElementById("rep-table").querySelector("tbody").innerHTML = tableRowsHtml(result);
  document.getElementById("rep-evidence").innerHTML = evidenceChartHtml(evidenceChartData());
  document.getElementById("rep-nextsteps").innerHTML = nextStepsHtml(nextStepsData(result));
  document.getElementById("rep-citation").textContent = fw().citation;

  const commentsWrap = document.getElementById("rep-comments");
  commentsWrap.innerHTML = "";
  let any = false;
  fw().levels.forEach(def => {
    const c = fst().comments[def.level];
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
function updateTopbarBadge() {
  document.getElementById("topbar-metodologia").textContent = fw().shortLabel;
}

function init() {
  renderIsoRef();
  renderFrameworkOptions();
  renderGroupOptions();
  bindMetaInputs();
  updateTopbarBadge();
  showScreen("inicio");
}
init();

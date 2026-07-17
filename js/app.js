/* Peptídeo é Vida! — front-end estático (sem framework, sem build step).
   Corrige os travamentos do site anterior: catálogo paginado (nunca renderiza
   mais que PAGE_SIZE cards de uma vez) e apenas UMA calculadora montada por vez. */

(() => {
  "use strict";

  // ---- Configuração ----------------------------------------------------
  const PAGE_SIZE = 9;
  // Troque pelo endpoint da sua conta em https://formspree.io (grátis) para o
  // formulário de contato enviar de verdade. Até lá, ele cai automaticamente
  // para abrir o cliente de e-mail do usuário — nunca finge que enviou, como
  // o formulário do site antigo fazia. Veja o README para o passo a passo.
  const CONTACT_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";
  const CONTACT_EMAIL = "orsicasaro@gmail.com";

  // ---- Estado ------------------------------------------------------------
  let query = "";
  let currentPage = 1;
  let openCalcId = null;

  // ---- Utilidades ----------------------------------------------------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $all = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  function classifyEvidence(levelRaw) {
    const t = levelRaw.toLowerCase();
    const highTerms = ["aprovado", "fda", "anvisa", "fase iii", "fase iv", "cmed", "fase 2/3", "fase ii/iii", "fase iii/iv"];
    const mediumTerms = ["fase ii", "fase i", "clínico", "clinico", "estudos", "observacionais", "fase iia"];
    if (highTerms.some((k) => t.includes(k))) return "evidence-high";
    if (mediumTerms.some((k) => t.includes(k))) return "evidence-medium";
    return "evidence-low";
  }

  function waLink(message) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  // window.open(url, "_blank") é o jeito certo no desktop (abre o WhatsApp
  // Web numa aba nova, sem perder o site). No celular é o oposto: navegadores
  // embutidos (o do próprio WhatsApp, Instagram, TikTok — de onde vem boa
  // parte de quem clica aqui) costumam bloquear esse popup ou abrir uma aba
  // em branco que fica "carregando" para sempre, o que parece um travamento.
  // Em toque, navegamos na aba atual — é o padrão recomendado para links
  // wa.me e o que garante o hand-off para o app do WhatsApp de fato acontecer.
  function openWhatsApp(message) {
    const url = waLink(message);
    // matchMedia sozinho não é confiável dentro de navegadores embutidos
    // (o do WhatsApp, Instagram etc. às vezes reportam hover/pointer errado).
    // Checamos também sinais diretos de toque; qualquer um positivo já basta
    // pra usar o caminho seguro (mesma aba) em vez do window.open.
    const isTouchPrimary =
      (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) ||
      "ontouchstart" in window ||
      (navigator.maxTouchPoints || 0) > 0;
    if (isTouchPrimary) {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  const WHATSAPP_ICON = `<svg viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zM223.9 438.3c-33.1 0-65.5-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>`;
  const CALC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`;

  // ---- Filtro ----------------------------------------------------------
  function getFiltered() {
    if (!query) return PRODUCTS;
    const q = query.toLowerCase();
    return PRODUCTS.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.aliases.some((a) => a.toLowerCase().includes(q)) ||
      p.diagnoses.some((d) => d.toLowerCase().includes(q))
    );
  }

  // ---- Render: card de produto -----------------------------------------
  function renderCard(p) {
    const evClass = classifyEvidence(p.evidenceLevel);
    const isOpen = openCalcId === p.id;
    return `
      <div class="product-card" id="peptide-card-${p.id}">
        <div class="product-card-top">
          <h3>${p.name}</h3>
          <span class="alias">${p.aliases.slice(0, 2).join(" • ")}</span>
        </div>
        <p class="mechanism-text">${p.mechanism.substring(0, 160)}...</p>
        <div class="peptide-specs">
          <div class="spec-item"><strong>Posologia:</strong><span>${p.dosage}</span></div>
          <div class="spec-item"><strong>Via:</strong><span>${p.route}</span></div>
          <div class="spec-item"><strong>Ciclo:</strong><span>${p.cycle}</span></div>
          <div class="spec-item"><strong>Evidência:</strong><span class="evidence-badge ${evClass}" title="${p.evidenceLevel}">${p.evidenceLevel}</span></div>
        </div>
        <div class="product-actions">
          <button class="btn-calculator-toggle ${isOpen ? "active" : ""}" data-calc-toggle="${p.id}">
            ${CALC_ICON}${isOpen ? "Fechar Calculadora" : "Calculadora de Dosagem"}
          </button>
          <button class="btn-whatsapp" data-quote="${p.id}">${WHATSAPP_ICON}Pedir Orçamento</button>
        </div>
        ${isOpen ? renderCalculator(p) : ""}
      </div>`;
  }

  // ---- Render: calculadora de reconstituição ----------------------------
  function calcDefaults(p) {
    const cfg = CALC_CONFIG[p.id];
    if (cfg) return cfg;
    let vialSize = 5;
    const unitMatch = p.pricing?.unit?.match(/(\d+(?:\.\d+)?)\s*mg/i);
    if (unitMatch) vialSize = parseFloat(unitMatch[1]);
    let targetDose = 250;
    const rangeMatch = p.dosage.match(/(\d+(?:\.\d+)?)[-–](\d+(?:\.\d+)?)\s*mcg/i);
    const singleMatch = p.dosage.match(/(\d+(?:\.\d+)?)\s*mcg/i);
    if (rangeMatch) targetDose = parseFloat(rangeMatch[1]);
    else if (singleMatch) targetDose = parseFloat(singleMatch[1]);
    return { vialSize, targetDose, diluent: 2 };
  }

  function renderCalculator(p) {
    const d0 = calcDefaults(p);
    return `<div class="peptide-calculator" data-calc-panel="${p.id}"
                 data-vial="${d0.vialSize}" data-diluent="${d0.diluent}" data-dose="${d0.targetDose}"></div>`;
  }

  function calcMath(vialSize, diluent, targetDose) {
    const concentration = (vialSize * 1000) / diluent;      // mcg/mL
    const perUnit = (vialSize * 10) / diluent;               // mcg por UI (seringa U-100)
    const units = targetDose / perUnit;                      // UI a puxar
    const dosesPerVial = Math.floor((vialSize * 1000) / targetDose);
    return { concentration, perUnit, units, dosesPerVial };
  }

  // Gera só a parte que MUDA a cada cálculo (resultados, seringa, guia).
  // Nunca contém <input> — por isso pode ser substituída à vontade sem
  // nunca roubar o foco de um campo onde o usuário esteja digitando ou
  // arrastando.
  function calcOutputsHTML(vialSize, diluent, targetDose) {
    const { concentration, perUnit, units, dosesPerVial } = calcMath(vialSize, diluent, targetDose);
    const safeUnits = isNaN(units) || !isFinite(units) ? 0 : units;
    const safeDoses = isNaN(dosesPerVial) || !isFinite(dosesPerVial) ? 0 : dosesPerVial;

    let resultBlock;
    if (safeUnits > 100) {
      resultBlock = `<div class="calc-alert danger">⚠️ <strong>Erro:</strong> A dose excede a capacidade total de uma seringa U-100 (100 UI / 1mL). Reduza a quantidade de diluente ou divida a aplicação.</div>`;
    } else if (safeUnits < 1) {
      resultBlock = `<div class="calc-alert warning">⚠️ <strong>Atenção:</strong> A dose é menor que 1 UI, tornando a medição na seringa imprecisa. Adicione mais diluente para diminuir a concentração.</div>`;
    } else {
      const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        .map((v) => `<div class="syringe-tick ${v % 20 === 0 ? "major" : ""}" style="left:${v}%">${v % 20 === 0 ? `<span class="tick-label">${v}</span>` : ""}</div>`)
        .join("");
      resultBlock = `
        <div class="syringe-visualization">
          <span class="vis-title">Representação na Seringa de 100 UI:</span>
          <div class="syringe-container">
            <div class="syringe-needle"></div>
            <div class="syringe-barrel">
              <div class="syringe-plunger" style="width:${Math.min(100, Math.max(0, safeUnits))}%"></div>
              <div class="syringe-markings">${ticks}</div>
            </div>
            <div class="syringe-plunger-rod"></div>
          </div>
          <p class="vis-summary">Aspire até a marca de <strong>${Math.round(safeUnits)} UI</strong> na seringa de insulina.</p>
        </div>`;
    }

    return `
      <div class="calculator-results">
        <div class="result-metric"><span class="metric-label">Concentração da Mistura</span><span class="metric-value">${concentration.toLocaleString("pt-BR")} mcg/mL</span></div>
        <div class="result-metric"><span class="metric-label">Concentração por 1 UI</span><span class="metric-value">${perUnit.toFixed(1)} mcg / UI</span></div>
        <div class="result-metric highlight"><span class="metric-label">Puxar na Seringa</span><span class="metric-value">${safeUnits.toFixed(1)} UI</span></div>
        <div class="result-metric"><span class="metric-label">Doses por Frasco</span><span class="metric-value">~${safeDoses} doses</span></div>
      </div>
      ${resultBlock}
      <div class="reconstitution-guide">
        <h5>📋 Guia de Reconstituição Passo a Passo:</h5>
        <ol>
          <li>Higienize as mãos e limpe a tampa de borracha do frasco do peptídeo (${vialSize} mg) e do diluente com um algodão embebido em álcool 70%.</li>
          <li>Aspire exatamente <strong>${diluent} mL</strong> do diluente (como água bacteriostática) com uma seringa apropriada.</li>
          <li>Introduza a agulha no frasco de pó liofilizado e injete o líquido lentamente, apontando para a parede de vidro do frasco para evitar criar espuma ou danificar o peptídeo.</li>
          <li>Remova a seringa de diluição e gire o frasco suavemente com movimentos circulares na palma das mãos até que o pó esteja totalmente dissolvido. Nunca chacoalhe o frasco.</li>
          <li>Com uma seringa de insulina U-100 (100 unidades/1mL), aspire até a marca de <strong>${safeUnits.toFixed(1)} UI</strong> (unidades) para obter a dose exata de <strong>${targetDose} mcg</strong>.</li>
          <li>Armazene o frasco reconstituído na geladeira (entre 2°C e 8°C). Este frasco renderá cerca de <strong>${safeDoses} doses</strong> iguais.</li>
        </ol>
      </div>
      <div class="calc-disclaimer">⚠️ <strong>Aviso Médico:</strong> Esta calculadora é uma ferramenta informativa baseada em cálculos matemáticos padrão de diluição. Não substitui a orientação médica ou profissional. Sempre siga as recomendações do seu médico ou farmacêutico.</div>
    `;
  }

  // Monta o painel inteiro (inclui os <input>) — chamada só quando a
  // calculadora abre ou quando "Resetar" é clicado, nunca durante digitação
  // ou arrasto.
  function paintCalculator(panel, p) {
    const vialSize = parseFloat(panel.dataset.vial);
    const diluent = parseFloat(panel.dataset.diluent);
    const targetDose = parseFloat(panel.dataset.dose);

    const routeUnit = `${p.route} ${p.pricing.unit}`.toLowerCase();
    const isPen = routeUnit.includes("caneta");
    const isNasal = routeUnit.includes("intranasal") || routeUnit.includes("spray");
    const isAmpoule = routeUnit.includes("ampola") || p.id === "cerebrolysin";

    panel.innerHTML = `
      <div class="calculator-header">
        <h4>🧪 Calculadora de Reconstituição e Dosagem</h4>
        <button class="btn-reset-calc" data-calc-reset="${p.id}" title="Restaurar valores padrão">Resetar</button>
      </div>
      ${isPen ? `<div class="calc-alert warning"><strong>Aviso sobre Caneta:</strong> Este peptídeo é comumente fornecido em canetas comerciais multi-doses pré-carregadas. A reconstituição não é necessária para canetas comuns. A calculadora abaixo simula caso você possua a versão em pó liofilizado.</div>` : ""}
      ${isNasal ? `<div class="calc-alert info"><strong>Uso Intranasal:</strong> Este peptídeo geralmente é usado como spray nasal. Se possuir o spray pronto, a dosagem é por borrifadas. A calculadora abaixo simula a diluição caso use o pó liofilizado.</div>` : ""}
      ${isAmpoule ? `<div class="calc-alert info"><strong>Ampola Líquida:</strong> Esta apresentação vem pronta para uso direto IM/IV (líquido). Não necessita de água bacteriostática adicional para reconstituição.</div>` : ""}
      <div class="calculator-grid">
        <div class="input-group">
          <label>Frasco do Peptídeo (mg): <strong data-label="vial">${vialSize} mg</strong></label>
          <input type="range" min="1" max="100" step="1" value="${vialSize}" class="calc-range" data-calc-field="vial" data-calc-id="${p.id}">
          <input type="number" value="${vialSize}" class="calc-num-input" data-calc-field="vial" data-calc-id="${p.id}">
        </div>
        <div class="input-group">
          <label>Diluente adicionado (mL): <strong data-label="diluent">${diluent} mL</strong></label>
          <input type="range" min="0.5" max="10" step="0.5" value="${diluent}" class="calc-range" data-calc-field="diluent" data-calc-id="${p.id}">
          <input type="number" value="${diluent}" class="calc-num-input" data-calc-field="diluent" data-calc-id="${p.id}">
        </div>
        <div class="input-group">
          <label>Dose Desejada: <strong data-label="dose">${targetDose} mcg (${(targetDose / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} mg)</strong></label>
          <input type="range" min="10" max="${Math.min(vialSize * 1000, 20000)}" step="10" value="${targetDose}" class="calc-range" data-calc-field="dose" data-calc-id="${p.id}">
          <div style="display:flex;gap:8px;">
            <div style="flex:1;display:flex;flex-direction:column;gap:2px;">
              <span style="font-size:.7rem;color:var(--text-muted);">mcg:</span>
              <input type="number" value="${targetDose}" class="calc-num-input" data-calc-field="dose" data-calc-id="${p.id}">
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:2px;">
              <span style="font-size:.7rem;color:var(--text-muted);">mg:</span>
              <input type="number" value="${targetDose / 1000}" step="0.01" class="calc-num-input" data-calc-field="dose-mg" data-calc-id="${p.id}">
            </div>
          </div>
        </div>
      </div>
      <div data-calc-dynamic="${p.id}">${calcOutputsHTML(vialSize, diluent, targetDose)}</div>
    `;
  }

  // Atualiza só os números/seringa/guia e os campos que NÃO estão em uso —
  // nunca substitui um <input> pelo qual o usuário está com o dedo (arrasto)
  // ou com o teclado aberto (digitação), então nada perde o foco.
  function refreshCalcOutputs(panel, p) {
    const vialSize = parseFloat(panel.dataset.vial);
    const diluent = parseFloat(panel.dataset.diluent);
    const targetDose = parseFloat(panel.dataset.dose);
    const active = document.activeElement;

    const setLabel = (name, text) => {
      const el = panel.querySelector(`[data-label="${name}"]`);
      if (el) el.textContent = text;
    };
    setLabel("vial", `${vialSize} mg`);
    setLabel("diluent", `${diluent} mL`);
    setLabel("dose", `${targetDose} mcg (${(targetDose / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} mg)`);

    const syncField = (fieldName, type, value) => {
      const el = panel.querySelector(`[data-calc-field="${fieldName}"][type="${type}"]`);
      if (el && el !== active) el.value = value;
    };
    syncField("vial", "range", vialSize);
    syncField("vial", "number", vialSize);
    syncField("diluent", "range", diluent);
    syncField("diluent", "number", diluent);
    syncField("dose", "range", targetDose);
    syncField("dose", "number", targetDose);
    syncField("dose-mg", "number", targetDose / 1000);

    const doseRange = panel.querySelector('[data-calc-field="dose"][type="range"]');
    if (doseRange) doseRange.max = Math.min(vialSize * 1000, 20000);

    const dynamic = panel.querySelector("[data-calc-dynamic]");
    if (dynamic) dynamic.innerHTML = calcOutputsHTML(vialSize, diluent, targetDose);
  }

  function paintAllOpenCalculators() {
    $all("[data-calc-panel]").forEach((panel) => {
      const p = PRODUCTS.find((x) => x.id === panel.dataset.calcPanel);
      if (p) paintCalculator(panel, p);
    });
  }

  // ---- Render: página do catálogo ----------------------------------------
  function renderCatalog() {
    const grid = $("#products-grid");
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    $("#result-count").textContent = filtered.length === PRODUCTS.length
      ? `${filtered.length} peptídeos no catálogo`
      : `${filtered.length} resultado${filtered.length === 1 ? "" : "s"} para a busca`;

    if (pageItems.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:24px 0;">Nenhum peptídeo encontrado para "${query}".</p>`;
    } else {
      grid.innerHTML = pageItems.map(renderCard).join("");
      paintAllOpenCalculators();
    }

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const el = $("#pagination");
    if (totalPages <= 1) { el.innerHTML = ""; return; }
    let html = `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="Página anterior">‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="Próxima página">›</button>`;
    el.innerHTML = html;
  }

  // ---- Eventos: catálogo (delegados, um único listener) ------------------
  function bindCatalogEvents() {
    const section = $("#produtos");

    $("#search-input").addEventListener("input", debounce((e) => {
      query = e.target.value.trim();
      currentPage = 1;
      renderCatalog();
    }, 200));

    section.addEventListener("click", (e) => {
      const calcBtn = e.target.closest("[data-calc-toggle]");
      if (calcBtn) {
        const id = calcBtn.dataset.calcToggle;
        openCalcId = openCalcId === id ? null : id;
        renderCatalog();
        if (openCalcId) {
          setTimeout(() => {
            document.getElementById(`peptide-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 120);
        }
        return;
      }

      const quoteBtn = e.target.closest("[data-quote]");
      if (quoteBtn) {
        const p = PRODUCTS.find((x) => x.id === quoteBtn.dataset.quote);
        if (p) openWhatsApp(`Olá, gostaria de solicitar um orçamento para o peptídeo ${p.name}.`);
        return;
      }

      const resetBtn = e.target.closest("[data-calc-reset]");
      if (resetBtn) {
        const p = PRODUCTS.find((x) => x.id === resetBtn.dataset.calcReset);
        const panel = $(`[data-calc-panel="${p.id}"]`);
        const d0 = calcDefaults(p);
        panel.dataset.vial = d0.vialSize;
        panel.dataset.diluent = d0.diluent;
        panel.dataset.dose = d0.targetDose;
        paintCalculator(panel, p);
        return;
      }

      const pageBtn = e.target.closest("[data-page]");
      if (pageBtn && !pageBtn.disabled) {
        currentPage = parseInt(pageBtn.dataset.page, 10);
        renderCatalog();
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    // Arrastar o slider (ou digitar) dispara "input" muitas vezes por
    // segundo. Só atualizamos uma vez por frame (requestAnimationFrame), e
    // refreshCalcOutputs() nunca recria os <input> — só os números ao redor
    // e os campos que não estão em uso no momento. Isso corrige os dois bugs
    // relatados: slider travando no arrasto e teclado fechando a cada tecla
    // (ambos vinham de recriar o campo em uso a cada atualização).
    let pendingCalcRepaint = null;
    section.addEventListener("input", (e) => {
      const field = e.target.closest("[data-calc-field]");
      if (!field) return;
      const id = field.dataset.calcId;
      const fieldName = field.dataset.calcField;
      const panel = $(`[data-calc-panel="${id}"]`);
      let value = parseFloat(e.target.value) || 0;

      if (fieldName === "vial") panel.dataset.vial = value;
      else if (fieldName === "diluent") panel.dataset.diluent = value;
      else if (fieldName === "dose") panel.dataset.dose = value;
      else if (fieldName === "dose-mg") panel.dataset.dose = Math.round(value * 1000);

      if (pendingCalcRepaint) cancelAnimationFrame(pendingCalcRepaint);
      pendingCalcRepaint = requestAnimationFrame(() => {
        pendingCalcRepaint = null;
        const p = PRODUCTS.find((x) => x.id === id);
        refreshCalcOutputs(panel, p);
      });
    });
  }

  // ---- CTA band ----------------------------------------------------
  function bindCtaBand() {
    const cta = $("#cta-whatsapp");
    if (!cta) return;
    cta.addEventListener("click", (e) => {
      e.preventDefault();
      openWhatsApp("Olá, gostaria de saber mais sobre os peptídeos disponíveis.");
    });
  }

  // ---- Menu mobile ----------------------------------------------------
  function bindNav() {
    const toggle = $("#nav-toggle");
    const links = $("#header-links");
    const scrim = $("#nav-scrim");
    const close = () => { links.classList.remove("open"); scrim.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); };
    const open = () => { links.classList.add("open"); scrim.classList.add("open"); toggle.setAttribute("aria-expanded", "true"); };
    toggle.addEventListener("click", () => (links.classList.contains("open") ? close() : open()));
    scrim.addEventListener("click", close);
    $all("#header-links a").forEach((a) => a.addEventListener("click", close));
  }

  // ---- WhatsApp flutuante ----------------------------------------------
  function bindWhatsappWidget() {
    const container = $("#wa-window");
    const toggleBtn = $("#wa-toggle");
    toggleBtn.addEventListener("click", () => container.classList.toggle("open"));
    $all("[data-wa-topic]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openWhatsApp(`Olá, gostaria de saber mais sobre: ${btn.dataset.waTopic}.`);
        container.classList.remove("open");
      });
    });
  }

  // ---- Formulário de contato ---------------------------------------------
  function bindContactForm() {
    const form = $("#contact-form");
    const status = $("#form-status");
    const submitBtn = $("#form-submit");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#name").value.trim();
      const email = $("#email").value.trim();
      const message = $("#message").value.trim();
      if (!name || !email || !message) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando...";
      status.className = "form-status";

      const usingPlaceholder = CONTACT_ENDPOINT.includes("YOUR_FORM_ID");

      if (usingPlaceholder) {
        const body = `Nome: ${name}%0AE-mail: ${email}%0A%0A${message}`;
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Contato via site — Peptídeo é Vida!")}&body=${body}`;
        status.textContent = "Abrimos seu aplicativo de e-mail com a mensagem pronta — é o modo provisório até o formulário ser conectado (veja o README).";
        status.classList.add("show", "ok");
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Mensagem";
        return;
      }

      try {
        const res = await fetch(CONTACT_ENDPOINT, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });
        if (res.ok) {
          status.textContent = "Mensagem enviada com sucesso! Entraremos em contato em breve.";
          status.classList.add("show", "ok");
          form.reset();
        } else {
          throw new Error("Falha no envio");
        }
      } catch (err) {
        status.textContent = "Não foi possível enviar agora. Tente novamente ou fale com a gente pelo WhatsApp.";
        status.classList.add("show", "err");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Mensagem";
      }
    });
  }

  // ---- Init ----------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    $("#year").textContent = new Date().getFullYear();
    bindNav();
    bindCatalogEvents();
    bindWhatsappWidget();
    bindCtaBand();
    bindContactForm();
    renderCatalog();
  });
})();

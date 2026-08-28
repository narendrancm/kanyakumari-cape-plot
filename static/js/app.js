// Edu-Explore Cape 3.0 — Real Polygon Map, List <-> Map Linking & Tamil Engine

(function () {
  'use strict';

  const LANG_STORAGE_KEY = 'edu_explore_lang';

  // Tamil Translations Dictionary
  const I18N = {
    en: {
      brandTitle: "Edu-Explore Cape",
      brandSubtitle: "Kanyakumari Educational Directory",
      pillAll: "All (1,296)",
      pillSchools: "Schools (1,213)",
      pillColleges: "Colleges (83)",
      searchPlaceholder: "Search 1,296 schools, colleges, leadership, locations...",
      viewMap: "Map",
      viewList: "List"
    },
    ta: {
      brandTitle: "எடு-எக்ஸ்ப்ளோர் கேப்",
      brandSubtitle: "கன்னியாகுமரி மாவட்ட கல்வி வழிகாட்டி",
      pillAll: "அனைத்தும் (1,296)",
      pillSchools: "பள்ளிகள் (1,213)",
      pillColleges: "கல்லூரிகள் (83)",
      searchPlaceholder: "1,296 பள்ளிகள், கல்லூரிகள், நிர்வாகிகளைத் தேடுக...",
      viewMap: "வரைபடம்",
      viewList: "பட்டியல்"
    }
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed === 'NA' || trimmed === 'Not Available') return null;
    let url = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    } catch (e) { return null; }
    return null;
  }

  function copyTextToClipboard(text, successMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => showToast(successMsg)).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (err) {
      showToast('Could not copy to clipboard');
    }
    document.body.removeChild(textArea);
  }

  let toastTimer = null;
  function showToast(msg) {
    const elToast = document.getElementById('toast-notification');
    if (!elToast) return;
    clearTimeout(toastTimer);
    elToast.textContent = msg;
    elToast.classList.remove('hidden');
    toastTimer = setTimeout(() => elToast.classList.add('hidden'), 2800);
  }

  const state = {
    view: 'plot',
    lang: localStorage.getItem(LANG_STORAGE_KEY) || 'en',
    selectedBlock: null,
    selectedId: null,
    filterType: 'all',
    kpiFilter: 'all',
    searchQuery: '',
    currentInstitution: null,
    blocks: [],
    institutions: [],
    institutionsMap: new Map(),
    camera: {
      x: 0, y: 0, w: 1000, h: 1000,
      targetX: 0, targetY: 0, targetW: 1000, targetH: 1000,
      isPanning: false, startX: 0, startY: 0
    }
  };

  const el = {
    surfacePlot: document.getElementById('surface-plot'),
    surfaceIndex: document.getElementById('surface-index'),
    viewPlotBtn: document.getElementById('view-plot-btn'),
    viewIndexBtn: document.getElementById('view-index-btn'),
    btnLangToggle: document.getElementById('btn-lang-toggle'),
    
    lblBrandTitle: document.getElementById('lbl-brand-title'),
    lblBrandSubtitle: document.getElementById('lbl-brand-subtitle'),
    pillAll: document.getElementById('pill-all'),
    pillSchools: document.getElementById('pill-schools'),
    pillColleges: document.getElementById('pill-colleges'),

    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    pillBtns: document.querySelectorAll('.pill-btn'),
    kpiPills: document.querySelectorAll('.kpi-pill'),
    exportBtn: document.getElementById('export-btn'),
    exportMenu: document.getElementById('export-menu'),

    plotSvg: document.getElementById('plot-svg'),
    svgContainer: document.getElementById('svg-container'),
    layerPolygons: document.getElementById('layer-polygons'),
    layerBlockLabels: document.getElementById('layer-block-labels'),
    layerNodes: document.getElementById('layer-nodes'),
    layerOverlays: document.getElementById('layer-overlays'),

    activeBlockPill: document.getElementById('active-block-pill'),
    activeBlockName: document.getElementById('active-block-name'),
    btnExitBlock: document.getElementById('btn-exit-block'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    zoomReset: document.getElementById('zoom-reset'),

    indexContent: document.getElementById('index-content'),
    indexEmptyState: document.getElementById('index-empty-state'),
    emptyStateMsg: document.getElementById('empty-state-msg'),
    btnResetFilters: document.getElementById('btn-reset-filters'),

    detailDock: document.getElementById('detail-dock'),
    dockClose: document.getElementById('dock-close'),
    dockTypeBadge: document.getElementById('dock-type-badge'),
    dockStatusBadge: document.getElementById('dock-status-badge'),
    dockTitle: document.getElementById('dock-title'),
    dockCatLine: document.getElementById('dock-category-line'),
    dockId: document.getElementById('dock-id'),
    dockBlock: document.getElementById('dock-block'),
    dockMgmt: document.getElementById('dock-mgmt'),
    dockMedium: document.getElementById('dock-medium'),
    dockLocation: document.getElementById('dock-location'),
    dockHm: document.getElementById('dock-hm'),
    dockPhone: document.getElementById('dock-phone'),
    dockEmail: document.getElementById('dock-email'),
    dockWebsite: document.getElementById('dock-website'),
    dockStrength: document.getElementById('dock-strength'),
    dockCoursesRow: document.getElementById('dock-courses-row'),
    dockCourses: document.getElementById('dock-courses'),
    dockDeptsRow: document.getElementById('dock-depts-row'),
    dockDepts: document.getElementById('dock-depts'),
    dockNotes: document.getElementById('dock-notes'),

    btnActCall: document.getElementById('btn-act-call'),
    btnActWeb: document.getElementById('btn-act-web'),
    btnActCopy: document.getElementById('btn-act-copy'),
    btnActShare: document.getElementById('btn-act-share'),
    btnOpenCorrection: document.getElementById('btn-open-correction'),

    footerStats: document.getElementById('footer-stats-text'),
    linkPrivacy: document.getElementById('link-privacy'),
    linkTerms: document.getElementById('link-terms'),

    modalPrivacy: document.getElementById('modal-privacy'),
    modalTerms: document.getElementById('modal-terms'),
    modalCorrection: document.getElementById('modal-correction'),
    formCorrection: document.getElementById('form-correction'),
    corrInstName: document.getElementById('corr-inst-name'),
    corrSuccess: document.getElementById('corr-success')
  };

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view')) state.view = params.get('view');
    if (params.get('block')) state.selectedBlock = params.get('block');
    if (params.get('id')) state.selectedId = params.get('id');
    if (params.get('type')) state.filterType = params.get('type');
    if (params.get('q')) state.searchQuery = params.get('q');
    if (params.get('lang')) state.lang = params.get('lang');
  }

  function updateUrlParams() {
    const params = new URLSearchParams();
    if (state.view !== 'plot' && window.innerWidth < 900) params.set('view', state.view);
    if (state.selectedBlock) params.set('block', state.selectedBlock);
    if (state.selectedId) params.set('id', state.selectedId);
    if (state.filterType !== 'all') params.set('type', state.filterType);
    if (state.searchQuery) params.set('q', state.searchQuery);
    if (state.lang !== 'en') params.set('lang', state.lang);

    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  function updateLanguage() {
    const dict = I18N[state.lang] || I18N.en;
    if (el.lblBrandTitle) el.lblBrandTitle.textContent = dict.brandTitle;
    if (el.lblBrandSubtitle) el.lblBrandSubtitle.textContent = dict.brandSubtitle;
    if (el.pillAll) el.pillAll.textContent = dict.pillAll;
    if (el.pillSchools) el.pillSchools.textContent = dict.pillSchools;
    if (el.pillColleges) el.pillColleges.textContent = dict.pillColleges;
    if (el.searchInput) el.searchInput.placeholder = dict.searchPlaceholder;
    if (el.viewPlotBtn) el.viewPlotBtn.textContent = dict.viewMap;
    if (el.viewIndexBtn) el.viewIndexBtn.textContent = dict.viewList;

    renderPlotBlockLabels();
    renderIndexView();
  }

  async function initData() {
    try {
      const resBlocks = await fetch('/api/blocks');
      if (!resBlocks.ok) throw new Error('Blocks API failure');
      const dataBlocks = await resBlocks.json();
      state.blocks = dataBlocks.blocks;

      const resInst = await fetch('/api/institutions?limit=1500');
      if (!resInst.ok) throw new Error('Institutions API failure');
      const dataInst = await resInst.json();
      state.institutions = dataInst.institutions;

      state.institutions.forEach(inst => {
        state.institutionsMap.set(inst.id, inst);
      });

      renderRealBlockPolygons();
      renderPlotBlockLabels();
      renderPlotNodes();
      renderIndexView();
      updateLanguage();
      applyUrlState();

      const schoolCnt = state.institutions.filter(i => i.institution_type === 'school').length;
      const collegeCnt = state.institutions.filter(i => i.institution_type === 'college').length;
      el.footerStats.textContent = `${schoolCnt.toLocaleString()} schools · ${collegeCnt.toLocaleString()} colleges · 9 blocks`;
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  function switchMobileView(viewName) {
    state.view = viewName;
    if (viewName === 'plot') {
      el.surfacePlot.classList.add('active');
      el.surfaceIndex.classList.remove('active');
      el.viewPlotBtn.classList.add('active');
      el.viewIndexBtn.classList.remove('active');
    } else {
      el.surfaceIndex.classList.add('active');
      el.surfacePlot.classList.remove('active');
      el.viewIndexBtn.classList.add('active');
      el.viewPlotBtn.classList.remove('active');
      renderIndexView();
    }
    updateUrlParams();
  }

  // Render Real Vector Block Polygons
  function renderRealBlockPolygons() {
    el.layerPolygons.innerHTML = '';

    state.blocks.forEach(b => {
      if (!b.svg_path) return;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', b.svg_path);
      path.setAttribute('class', 'block-polygon');
      path.setAttribute('data-block', b.name);
      path.setAttribute('id', `poly-${b.name}`);
      path.setAttribute('role', 'region');
      path.setAttribute('aria-label', `${b.name} Block, ${b.total_count} institutions`);

      // Block hover: show block wash & tooltip
      path.addEventListener('mouseenter', () => handleBlockHover(b));
      path.addEventListener('mouseleave', () => handleBlockLeave());

      // Click to zoom into block
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomToBlock(b.name);
      });

      el.layerPolygons.appendChild(path);
    });
  }

  function renderPlotBlockLabels() {
    el.layerBlockLabels.innerHTML = '';

    state.blocks.forEach(b => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'block-label-group');

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.setAttribute('x', b.cx);
      title.setAttribute('y', b.cy);
      title.setAttribute('class', 'block-label-text');
      title.textContent = state.lang === 'ta' && b.name_ta ? b.name_ta : b.name.toUpperCase();

      const count = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      count.setAttribute('x', b.cx);
      count.setAttribute('y', b.cy + 13);
      count.setAttribute('class', 'block-count-text');
      count.textContent = `${b.total_count} inst`;

      g.appendChild(title);
      g.appendChild(count);
      el.layerBlockLabels.appendChild(g);
    });
  }

  function handleBlockHover(block) {
    const poly = document.getElementById(`poly-${block.name}`);
    if (poly) poly.classList.add('hovered');

    el.layerOverlays.innerHTML = '';
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'svg-hover-card');

    const bName = state.lang === 'ta' && block.name_ta ? block.name_ta : block.name;
    const labelStr = `${bName} · ${block.total_count} Institutions`;
    const cardWidth = Math.max(160, labelStr.length * 6.8 + 20);
    const cardHeight = 26;
    const cardX = block.cx - cardWidth / 2;
    const cardY = block.cy - 30;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', cardX);
    rect.setAttribute('y', cardY);
    rect.setAttribute('width', cardWidth);
    rect.setAttribute('height', cardHeight);
    rect.setAttribute('class', 'svg-hover-card-bg');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cardX + cardWidth / 2);
    text.setAttribute('y', cardY + 17);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'svg-hover-card-text');
    text.textContent = labelStr;

    g.appendChild(rect);
    g.appendChild(text);
    el.layerOverlays.appendChild(g);
  }

  function handleBlockLeave() {
    document.querySelectorAll('.block-polygon').forEach(p => p.classList.remove('hovered'));
    el.layerOverlays.innerHTML = '';
  }

  // Plot All 1,296 Institution Points Inside Real Polygons
  function renderPlotNodes() {
    el.layerNodes.innerHTML = '';
    const filtered = getFilteredInstitutions();

    filtered.forEach(inst => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `inst-node type-${inst.institution_type}`);
      g.setAttribute('data-id', inst.id);
      g.setAttribute('data-block', inst.block);
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', `${inst.name}, ${inst.category} in ${inst.block}`);

      let mark;
      const isCentroid = (inst.geocode_confidence === 'Geocoded-Block-Centroid');

      if (inst.institution_type === 'school') {
        mark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        mark.setAttribute('cx', inst.schematic_x);
        mark.setAttribute('cy', inst.schematic_y);
        mark.setAttribute('r', '3.4');
        mark.setAttribute('class', `node-mark school ${isCentroid ? 'centroid-fallback' : ''}`);
      } else {
        mark = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        mark.setAttribute('x', inst.schematic_x - 3.5);
        mark.setAttribute('y', inst.schematic_y - 3.5);
        mark.setAttribute('width', '7');
        mark.setAttribute('height', '7');
        mark.setAttribute('rx', '1.5');
        mark.setAttribute('class', 'node-mark college');
      }

      g.appendChild(mark);

      // Instant Single-Card Hover
      g.addEventListener('mouseenter', () => handleNodeHover(inst, g));
      g.addEventListener('mouseleave', () => handleNodeLeave());

      // Focus & Click
      g.addEventListener('focus', () => handleNodeHover(inst, g));
      g.addEventListener('blur', () => handleNodeLeave());

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        selectInstitution(inst.id);
        highlightIndexRow(inst.id);
      });

      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectInstitution(inst.id);
          highlightIndexRow(inst.id);
        }
      });

      el.layerNodes.appendChild(g);
    });
  }

  function handleNodeHover(inst, nodeGroup) {
    el.layerOverlays.innerHTML = '';
    el.layerNodes.style.opacity = '0.45';
    nodeGroup.style.opacity = '1.0';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'svg-hover-card');

    const approxTag = (inst.geocode_confidence === 'Geocoded-Block-Centroid') ? ' (~approx)' : '';
    const labelStr = `${inst.name} (${inst.category})${approxTag}`;
    const cardWidth = Math.max(140, labelStr.length * 6.4 + 18);
    const cardHeight = 24;
    const cardX = inst.schematic_x + 9;
    const cardY = inst.schematic_y - 12;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', cardX);
    rect.setAttribute('y', cardY);
    rect.setAttribute('width', cardWidth);
    rect.setAttribute('height', cardHeight);
    rect.setAttribute('class', 'svg-hover-card-bg');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cardX + 9);
    text.setAttribute('y', cardY + 16);
    text.setAttribute('class', 'svg-hover-card-text');
    text.textContent = labelStr;

    g.appendChild(rect);
    g.appendChild(text);
    el.layerOverlays.appendChild(g);

    highlightIndexRow(inst.id, false);
  }

  function handleNodeLeave() {
    el.layerOverlays.innerHTML = '';
    el.layerNodes.style.opacity = '1.0';
    document.querySelectorAll('.index-row').forEach(r => r.classList.remove('highlight-pulse'));
  }

  function highlightIndexRow(instId, scrollTo = true) {
    document.querySelectorAll('.index-row').forEach(r => {
      const match = (r.getAttribute('data-id') === instId);
      r.classList.toggle('highlight-pulse', match);
      if (match && scrollTo) {
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function pulseMapNode(instId) {
    document.querySelectorAll('.inst-node').forEach(n => {
      const match = (n.getAttribute('data-id') === instId);
      n.classList.toggle('pulsing', match);
      if (match) {
        const inst = state.institutionsMap.get(instId);
        if (inst) {
          handleNodeHover(inst, n);
        }
      }
    });
  }

  function unpulseMapNodes() {
    document.querySelectorAll('.inst-node').forEach(n => n.classList.remove('pulsing'));
    handleNodeLeave();
  }

  function setViewBox(x, y, w, h, animated = true) {
    state.camera.targetX = x;
    state.camera.targetY = y;
    state.camera.targetW = w;
    state.camera.targetH = h;

    if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state.camera.x = x;
      state.camera.y = y;
      state.camera.w = w;
      state.camera.h = h;
      el.plotSvg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
      return;
    }
    animateCamera();
  }

  let animationFrameId = null;
  function animateCamera() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    const factor = 0.20;
    const dx = (state.camera.targetX - state.camera.x) * factor;
    const dy = (state.camera.targetY - state.camera.y) * factor;
    const dw = (state.camera.targetW - state.camera.w) * factor;
    const dh = (state.camera.targetH - state.camera.h) * factor;

    state.camera.x += dx;
    state.camera.y += dy;
    state.camera.w += dw;
    state.camera.h += dh;

    el.plotSvg.setAttribute('viewBox', `${state.camera.x} ${state.camera.y} ${state.camera.w} ${state.camera.h}`);

    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || Math.abs(dw) > 0.1 || Math.abs(dh) > 0.1) {
      animationFrameId = requestAnimationFrame(animateCamera);
    }
  }

  function resetDistrictView() {
    state.selectedBlock = null;
    el.activeBlockPill.classList.add('hidden');
    const sidebarBanner = document.getElementById('sidebar-block-banner');
    if (sidebarBanner) sidebarBanner.classList.add('hidden');

    document.querySelectorAll('.block-polygon').forEach(p => p.classList.remove('active'));
    setViewBox(0, 0, 1000, 1000, true);
    renderPlotNodes();
    renderIndexView();
    updateUrlParams();
  }

  function zoomToBlock(blockName) {
    const b = state.blocks.find(bl => bl.name === blockName);
    if (!b) return;

    state.selectedBlock = blockName;
    const bName = state.lang === 'ta' && b.name_ta ? b.name_ta : b.name;
    el.activeBlockName.textContent = `${bName} (${b.total_count} institutions)`;
    el.activeBlockPill.classList.remove('hidden');

    // Update Sidebar Region Banner
    const sidebarBanner = document.getElementById('sidebar-block-banner');
    const sidebarTitle = document.getElementById('sidebar-block-title');
    if (sidebarBanner && sidebarTitle) {
      sidebarTitle.textContent = `${bName} (${b.total_count} institutions)`;
      sidebarBanner.classList.remove('hidden');
    }

    document.querySelectorAll('.block-polygon').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-block') === blockName);
    });

    const spanX = (b.bbox_max_x - b.bbox_min_x) * 1.5 || 320;
    const spanY = (b.bbox_max_y - b.bbox_min_y) * 1.5 || 320;
    const span = Math.max(spanX, spanY);
    const x = Math.max(0, b.cx - span / 2);
    const y = Math.max(0, b.cy - span / 2);

    setViewBox(x, y, span, span, true);
    renderPlotNodes();
    renderIndexView();
    updateUrlParams();
  }

  // Pan Canvas Handlers
  el.svgContainer.addEventListener('mousedown', (e) => {
    if (e.target.closest('.inst-node')) return;
    state.camera.isPanning = true;
    state.camera.startX = e.clientX;
    state.camera.startY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.camera.isPanning) return;
    const dx = (e.clientX - state.camera.startX) * (state.camera.w / el.svgContainer.clientWidth);
    const dy = (e.clientY - state.camera.startY) * (state.camera.h / el.svgContainer.clientHeight);

    state.camera.targetX -= dx;
    state.camera.targetY -= dy;
    state.camera.x -= dx;
    state.camera.y -= dy;
    el.plotSvg.setAttribute('viewBox', `${state.camera.x} ${state.camera.y} ${state.camera.w} ${state.camera.h}`);

    state.camera.startX = e.clientX;
    state.camera.startY = e.clientY;
  });

  window.addEventListener('mouseup', () => { state.camera.isPanning = false; });

  el.svgContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    const newW = Math.min(1600, Math.max(150, state.camera.w * zoomFactor));
    const newH = Math.min(1600, Math.max(150, state.camera.h * zoomFactor));

    const cx = state.camera.x + state.camera.w / 2;
    const cy = state.camera.y + state.camera.h / 2;
    setViewBox(cx - newW / 2, cy - newH / 2, newW, newH, true);
  }, { passive: false });

  function updateKpiBadgeCounts(subset) {
    const totalCount = subset.length;
    const schoolsCount = subset.filter(i => i.institution_type === 'school').length;
    const collegesCount = subset.filter(i => i.institution_type === 'college').length;
    const govtCount = subset.filter(i => i.management_type && i.management_type.toLowerCase().includes('government')).length;
    const aidedCount = subset.filter(i => i.management_type && i.management_type.toLowerCase().includes('aided')).length;
    const verifiedCount = subset.filter(i => i.verification_status && i.verification_status.includes('Verified')).length;

    const countMap = {
      'all': totalCount, 'schools': schoolsCount, 'colleges': collegesCount,
      'govt': govtCount, 'aided': aidedCount, 'verified': verifiedCount
    };

    el.kpiPills.forEach(pill => {
      const filterKey = pill.getAttribute('data-filter');
      const countEl = pill.querySelector('.kpi-count');
      if (countEl && countMap[filterKey] !== undefined) {
        countEl.textContent = countMap[filterKey].toLocaleString();
      }
    });
  }

  
  function getFilteredInstitutions() {
    let list = state.institutions;

    // Filter by Selected Region / Block (When clicked on map)
    if (state.selectedBlock) {
      list = list.filter(i => i.block === state.selectedBlock);
    }

    // Filter by Top Filter Bar (all, schools, colleges, govt, aided, verified)
    if (state.filterType === 'schools') list = list.filter(i => i.institution_type === 'school');
    else if (state.filterType === 'colleges') list = list.filter(i => i.institution_type === 'college');
    else if (state.filterType === 'govt') list = list.filter(i => i.management_type === 'Government');
    else if (state.filterType === 'aided') list = list.filter(i => i.management_type === 'Private-Aided');
    else if (state.filterType === 'verified') list = list.filter(i => i.verification_status && i.verification_status.includes('Verified'));

    // Filter by Search Query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      list = list.filter(i => 
        i.name.toLowerCase().includes(q) ||
        i.block.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.principal_name && i.principal_name.toLowerCase().includes(q)) ||
        (i.identifier && i.identifier.includes(q))
      );
    }
    return list;
  }


  function renderIndexView() {
    el.indexContent.innerHTML = '';
    const filtered = getFilteredInstitutions();
    updateKpiBadgeCounts(filtered);

    if (filtered.length === 0) {
      el.indexEmptyState.classList.remove('hidden');
      return;
    } else {
      el.indexEmptyState.classList.add('hidden');
    }

    
    const sidebarTotalLabel = document.getElementById('sidebar-total-label');
    if (sidebarTotalLabel) {
      const regionText = state.selectedBlock ? ` in ${state.selectedBlock}` : ' in Kanyakumari';
      sidebarTotalLabel.textContent = `Showing ${filtered.length.toLocaleString()} institutions${regionText}`;
    }

    const grouped = {};
    state.blocks.forEach(b => { grouped[b.name] = []; });
    filtered.forEach(inst => {
      if (!grouped[inst.block]) grouped[inst.block] = [];
      grouped[inst.block].push(inst);
    });

    state.blocks.forEach(b => {
      const items = grouped[b.name] || [];
      if (items.length === 0) return;

      const groupDiv = document.createElement('div');
      groupDiv.setAttribute('class', 'index-block-group');

      const bName = state.lang === 'ta' && b.name_ta ? b.name_ta : b.name.toUpperCase();
      const heading = document.createElement('div');
      heading.setAttribute('class', 'index-block-heading');
      heading.innerHTML = `<span>${escapeHtml(bName)}</span> <span class="index-block-count">${items.length} institutions</span>`;
      groupDiv.appendChild(heading);

      items.forEach(inst => {
        const row = document.createElement('div');
        row.setAttribute('class', `index-row ${state.selectedId === inst.id ? 'selected' : ''}`);
        row.setAttribute('data-id', inst.id);
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-label', `${inst.name}, ${inst.category}`);

        const instName = state.lang === 'ta' && inst.name_ta ? inst.name_ta : inst.name;
        row.innerHTML = `
          <div class="row-top">
            <span class="row-name">${escapeHtml(instName)}</span>
            <span class="row-badge type-${escapeHtml(inst.institution_type)}">${escapeHtml(inst.institution_type)}</span>
          </div>
          <div class="row-meta">
            <span>${escapeHtml(inst.category)}</span>
            <span>·</span>
            <span>${escapeHtml(inst.location || inst.block)}</span>
          </div>
        `;

        // List -> Map Bi-directional Linking (Desktop hover & Mobile tap)
        row.addEventListener('mouseenter', () => pulseMapNode(inst.id));
        row.addEventListener('mouseleave', () => unpulseMapNodes());
        row.addEventListener('focus', () => pulseMapNode(inst.id));
        row.addEventListener('blur', () => unpulseMapNodes());

        row.addEventListener('click', () => {
          selectInstitution(inst.id);
          // If on mobile, switch to map and zoom to point
          if (window.innerWidth < 900) {
            switchMobileView('plot');
            zoomToBlock(inst.block);
            pulseMapNode(inst.id);
          }
        });

        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectInstitution(inst.id);
            if (window.innerWidth < 900) {
              switchMobileView('plot');
              zoomToBlock(inst.block);
              pulseMapNode(inst.id);
            }
          }
        });

        groupDiv.appendChild(row);
      });

      el.indexContent.appendChild(groupDiv);
    });
  }

  async function selectInstitution(instId) {
    if (!instId) return;
    state.selectedId = instId;

    try {
      const res = await fetch(`/api/institutions/${instId}`);
      if (!res.ok) throw new Error('Detail API failure');
      const data = await res.json();
      state.currentInstitution = data;

      const instName = state.lang === 'ta' && data.name_ta ? data.name_ta : data.name;
      el.dockTitle.textContent = instName;
      el.dockTypeBadge.textContent = data.institution_type.toUpperCase();
      el.dockCatLine.textContent = `${data.category} · ${data.management_type}`;
      el.dockId.textContent = data.udise_code || data.identifier || data.id;
      el.dockBlock.textContent = `${data.block} (${data.taluk || 'NA'})`;
      el.dockMgmt.textContent = data.management_type || 'NA';
      el.dockMedium.textContent = data.medium || 'NA';
      el.dockLocation.textContent = data.location || 'NA';
      
      const hmVal = data.principal_name || data.hm_name;
      el.dockHm.textContent = (hmVal && hmVal !== 'NA') ? hmVal : 'NA';

      if (data.phone && data.phone !== 'NA') {
        const cleanPhone = data.phone.split('/')[0].trim();
        el.dockPhone.innerHTML = `<a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(data.phone)}</a>`;
        if (el.btnActCall) {
          el.btnActCall.href = `tel:${cleanPhone}`;
          el.btnActCall.classList.remove('disabled');
        }
      } else {
        el.dockPhone.textContent = 'NA';
        if (el.btnActCall) el.btnActCall.classList.add('disabled');
      }

      const safeWebUrl = sanitizeUrl(data.website);
      if (safeWebUrl) {
        el.dockWebsite.innerHTML = `<a href="${escapeHtml(safeWebUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.website)} ↗</a>`;
        if (el.btnActWeb) {
          el.btnActWeb.href = safeWebUrl;
          el.btnActWeb.classList.remove('disabled');
        }
      } else {
        el.dockWebsite.textContent = 'NA';
        if (el.btnActWeb) el.btnActWeb.classList.add('disabled');
      }

      el.dockStrength.textContent = (data.student_strength && data.student_strength !== 'NA') ? data.student_strength : 'NA';

      if (data.courses_offered && data.courses_offered !== 'NA') {
        el.dockCoursesRow.classList.remove('hidden');
        el.dockCourses.textContent = data.courses_offered;
      } else {
        el.dockCoursesRow.classList.add('hidden');
      }

      if ((data.departments || data.dept_breakdown) && data.departments !== 'NA') {
        el.dockDeptsRow.classList.remove('hidden');
        el.dockDepts.textContent = data.dept_breakdown || data.departments;
      } else {
        el.dockDeptsRow.classList.add('hidden');
      }

      el.dockStatusBadge.textContent = data.verification_status || 'Verified';
      el.dockStatusBadge.className = (data.verification_status && data.verification_status.includes('Verified')) ? 'status-badge verified' : 'status-badge';
      el.dockNotes.textContent = data.sources_notes || 'Official institution record';

      if (el.corrInstName) {
        el.corrInstName.value = `${data.name} (${data.udise_code || data.identifier || data.id})`;
      }

      el.detailDock.classList.remove('hidden');
      document.querySelectorAll('.index-row').forEach(r => r.classList.toggle('selected', r.getAttribute('data-id') === instId));
      updateUrlParams();
    } catch (err) {
      console.error('Error loading detail:', err);
    }
  }

  function closeDetailDock() {
    state.selectedId = null;
    state.currentInstitution = null;
    el.detailDock.classList.add('hidden');
    document.querySelectorAll('.index-row').forEach(r => r.classList.remove('selected'));
    unpulseMapNodes();
    updateUrlParams();
  }

  // Quick Actions
  if (el.btnActCopy) {
    el.btnActCopy.addEventListener('click', () => {
      if (!state.currentInstitution) return;
      const d = state.currentInstitution;
      const textCard = `🏛️ ${d.name} (${d.institution_type.toUpperCase()})
📍 ${d.location || 'NA'}, ${d.block} Block
🆔 UDISE/ID: ${d.udise_code || d.identifier || d.id}
👤 Leadership: ${d.principal_name || 'NA'}
📞 Phone: ${d.phone || 'NA'}
✉️ Email: ${d.email || 'NA'}
🌐 Website: ${d.website || 'NA'}
🔗 View: https://capeedudetails.me/?id=${d.id}`;
      copyTextToClipboard(textCard, '✓ Contact card copied to clipboard!');
    });
  }

  if (el.btnActShare) {
    el.btnActShare.addEventListener('click', () => {
      if (!state.currentInstitution) return;
      const d = state.currentInstitution;
      const shareUrl = `https://capeedudetails.me/?id=${d.id}`;
      if (navigator.share) {
        navigator.share({ title: d.name, text: `Verified details for ${d.name}`, url: shareUrl }).catch(() => {
          copyTextToClipboard(shareUrl, '🔗 Direct link copied to clipboard!');
        });
      } else {
        copyTextToClipboard(shareUrl, '🔗 Direct link copied to clipboard!');
      }
    });
  }

  // Tamil Toggle
  if (el.btnLangToggle) {
    el.btnLangToggle.addEventListener('click', () => {
      state.lang = (state.lang === 'en') ? 'ta' : 'en';
      localStorage.setItem(LANG_STORAGE_KEY, state.lang);
      updateLanguage();
      updateUrlParams();
    });
  }

  function applyUrlState() {
    if (state.filterType) {
      el.pillBtns.forEach(btn => {
        const isMatch = (btn.getAttribute('data-type') === state.filterType);
        btn.classList.toggle('active', isMatch);
      });
    }
    if (state.searchQuery) {
      el.searchInput.value = state.searchQuery;
      el.searchClear.classList.remove('hidden');
    }
    if (state.selectedBlock) {
      zoomToBlock(state.selectedBlock);
    }
    if (state.selectedId) {
      selectInstitution(state.selectedId);
    }
    if (state.view === 'index' && window.innerWidth < 900) {
      switchMobileView('index');
    }
  }

  el.viewPlotBtn.addEventListener('click', () => switchMobileView('plot'));
  el.viewIndexBtn.addEventListener('click', () => switchMobileView('index'));

  el.btnExitBlock.addEventListener('click', resetDistrictView);
  el.zoomReset.addEventListener('click', resetDistrictView);
  el.zoomIn.addEventListener('click', () => {
    setViewBox(state.camera.x + state.camera.w * 0.1, state.camera.y + state.camera.h * 0.1, state.camera.w * 0.8, state.camera.h * 0.8);
  });
  el.zoomOut.addEventListener('click', () => {
    setViewBox(state.camera.x - state.camera.w * 0.1, state.camera.y - state.camera.h * 0.1, state.camera.w * 1.2, state.camera.h * 1.2);
  });

  el.dockClose.addEventListener('click', closeDetailDock);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el.detailDock.classList.contains('hidden')) closeDetailDock();
      else if (state.selectedBlock) resetDistrictView();
      closeAllModals();
    }
  });

  el.pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.pillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterType = btn.getAttribute('data-type');
      renderPlotNodes();
      renderIndexView();
      updateUrlParams();
    });
  });

  el.kpiPills.forEach(pill => {
    pill.addEventListener('click', () => {
      el.kpiPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.kpiFilter = pill.getAttribute('data-filter');
      renderIndexView();
    });
  });

  let searchTimer = null;
  el.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value;
    el.searchClear.classList.toggle('hidden', !val);

    searchTimer = setTimeout(() => {
      state.searchQuery = val;
      renderPlotNodes();
      renderIndexView();
      updateUrlParams();
    }, 180);
  });

  el.searchClear.addEventListener('click', () => {
    el.searchInput.value = '';
    el.searchClear.classList.add('hidden');
    state.searchQuery = '';
    renderPlotNodes();
    renderIndexView();
    updateUrlParams();
  });

  if (el.btnResetFilters) {
    el.btnResetFilters.addEventListener('click', () => {
      el.searchInput.value = '';
      el.searchClear.classList.add('hidden');
      state.searchQuery = '';
      state.filterType = 'all';
      state.kpiFilter = 'all';
      el.pillBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === 'all'));
      el.kpiPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-filter') === 'all'));
      renderPlotNodes();
      renderIndexView();
      updateUrlParams();
      showToast('Filters reset to show all 1,296 institutions');
    });
  }

  el.exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    el.exportMenu.classList.toggle('hidden');
  });
  window.addEventListener('click', () => el.exportMenu.classList.add('hidden'));

  function closeAllModals() {
    [el.modalPrivacy, el.modalTerms, el.modalCorrection].forEach(m => { if (m) m.classList.add('hidden'); });
  }

  if (el.linkPrivacy) el.linkPrivacy.addEventListener('click', (e) => { e.preventDefault(); closeAllModals(); el.modalPrivacy.classList.remove('hidden'); });
  if (el.linkTerms) el.linkTerms.addEventListener('click', (e) => { e.preventDefault(); closeAllModals(); el.modalTerms.classList.remove('hidden'); });
  if (el.btnOpenCorrection) el.btnOpenCorrection.addEventListener('click', () => { closeAllModals(); el.corrSuccess.classList.add('hidden'); el.modalCorrection.classList.remove('hidden'); });

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const target = document.getElementById(modalId);
      if (target) target.classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });

  if (el.formCorrection) {
    el.formCorrection.addEventListener('submit', (e) => {
      e.preventDefault();
      el.corrSuccess.classList.remove('hidden');
      setTimeout(() => {
        el.modalCorrection.classList.add('hidden');
        showToast('✓ Correction submitted for verification review!');
      }, 2000);
    });
  }

  
  
  // Top Primary Filter Bar Listener (Clean & Professional, No Emojis)
  document.querySelectorAll('.top-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.top-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterType = btn.getAttribute('data-filter') || 'all';
      renderPlotNodes();
      renderIndexView();
      updateUrlParams();
    });
  });
readUrlParams();
  initData();
})();

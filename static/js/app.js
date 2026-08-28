// Edu-Explore Cape v4.0 — Canonical State, Vector Map & Bi-directional Sync
(function () {
  'use strict';

  const LANG_STORAGE_KEY = 'edu_explore_lang';

  const I18N = {
    en: {
      brandTitle: "EDU-EXPLORE CAPE",
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
    if (!trimmed || trimmed === 'NA' || trimmed === 'Not Available' || trimmed === 'None') return null;
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
    searchQuery: '',
    currentInstitution: null,
    blocks: [],
    institutions: [],
    institutionsMap: new Map(),
    isLoaded: false,
    camera: {
      x: 0, y: 0, w: 1000, h: 1000,
      isPanning: false,
      hasDragged: false,
      startX: 0, startY: 0,
      startVbX: 0, startVbY: 0,
      startVbW: 1000, startVbH: 1000,
      touchStartDist: 0,
      touchStartW: 1000, touchStartH: 1000
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
    filterAll: document.getElementById('filter-all'),
    filterSchools: document.getElementById('filter-schools'),
    filterColleges: document.getElementById('filter-colleges'),
    filterGovt: document.getElementById('filter-govt'),
    filterAided: document.getElementById('filter-aided'),
    filterVerified: document.getElementById('filter-verified'),

    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),

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

    sidebarBlockBanner: document.getElementById('sidebar-block-banner'),
    sidebarBlockTitle: document.getElementById('sidebar-block-title'),
    btnClearBlockFilter: document.getElementById('btn-clear-block-filter'),
    sidebarTotalLabel: document.getElementById('sidebar-total-label'),
    indexLoadingState: document.getElementById('index-loading-state'),
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

  // URL Parameter Sync
  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('block')) state.selectedBlock = params.get('block');
    if (params.has('id')) state.selectedId = params.get('id');
    if (params.has('type')) state.filterType = params.get('type');
    if (params.has('q')) state.searchQuery = params.get('q');
    if (params.has('lang')) state.lang = params.get('lang');
  }

  function updateUrlParams() {
    const params = new URLSearchParams();
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
    if (el.filterAll) el.filterAll.textContent = dict.pillAll;
    if (el.filterSchools) el.filterSchools.textContent = dict.pillSchools;
    if (el.filterColleges) el.filterColleges.textContent = dict.pillColleges;
    if (el.searchInput) el.searchInput.placeholder = dict.searchPlaceholder;
    if (el.viewPlotBtn) el.viewPlotBtn.textContent = dict.viewMap;
    if (el.viewIndexBtn) el.viewIndexBtn.textContent = dict.viewList;

    renderPlotBlockLabels();
    if (state.isLoaded) renderIndexView();
  }

  async function initData() {
    try {
      const [resBlocks, resInst] = await Promise.all([
        fetch('/api/blocks'),
        fetch('/api/institutions?limit=1500')
      ]);

      if (!resBlocks.ok) throw new Error('Blocks API failure');
      if (!resInst.ok) throw new Error('Institutions API failure');

      const dataBlocks = await resBlocks.json();
      const dataInst = await resInst.json();

      state.blocks = dataBlocks.blocks || [];
      state.institutions = dataInst.institutions || [];

      state.institutions.forEach(inst => {
        state.institutionsMap.set(inst.id, inst);
      });

      state.isLoaded = true;
      if (el.indexLoadingState) el.indexLoadingState.classList.add('hidden');
      if (el.indexContent) el.indexContent.classList.remove('hidden');

      renderRealBlockPolygons();
      renderPlotBlockLabels();
      renderPlotNodes();
      renderIndexView();
      updateLanguage();

      // Apply initial URL filter highlight
      document.querySelectorAll('.filter-segment').forEach(btn => {
        if (btn.getAttribute('data-filter') === state.filterType) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      if (state.searchQuery && el.searchInput) {
        el.searchInput.value = state.searchQuery;
        if (el.searchClear) el.searchClear.classList.remove('hidden');
      }

      if (state.selectedBlock) {
        zoomToBlock(state.selectedBlock);
      }

      if (state.selectedId) {
        selectInstitution(state.selectedId);
      }

      const schoolCnt = state.institutions.filter(i => i.institution_type === 'school').length;
      const collegeCnt = state.institutions.filter(i => i.institution_type === 'college').length;
      if (el.footerStats) {
        el.footerStats.textContent = `${schoolCnt.toLocaleString()} schools · ${collegeCnt.toLocaleString()} colleges · 9 blocks`;
      }
    } catch (err) {
      console.error('Initialization error:', err);
      if (el.indexLoadingState) {
        el.indexLoadingState.innerHTML = '<span style="color:#C62828;">Unable to load institutions. Please refresh page.</span>';
      }
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
      path.setAttribute('class', `block-polygon ${state.selectedBlock === b.name ? 'selected' : ''}`);
      path.setAttribute('data-block', b.name);
      path.setAttribute('id', `poly-${b.name}`);
      path.setAttribute('role', 'region');
      path.setAttribute('aria-label', `${b.name} Block, ${b.total_count} institutions`);

      path.addEventListener('mouseenter', () => handleBlockHover(b));
      path.addEventListener('mouseleave', () => handleBlockLeave());
      path.addEventListener('click', (e) => {
        if (state.camera.hasDragged) {
          state.camera.hasDragged = false;
          return;
        }
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

  function handleBlockHover(b) {
    if (state.selectedBlock) return;
    const poly = document.getElementById(`poly-${b.name}`);
    if (poly) poly.classList.add('hovered');
  }

  function handleBlockLeave() {
    document.querySelectorAll('.block-polygon').forEach(p => p.classList.remove('hovered'));
  }

  // CANONICAL FILTERING PIPELINE (Phase 3)
  function getFilteredInstitutions() {
    let list = state.institutions;

    // Filter by Selected Block
    if (state.selectedBlock) {
      list = list.filter(i => i.block === state.selectedBlock);
    }

    // Filter by Category / Type
    if (state.filterType === 'schools') {
      list = list.filter(i => i.institution_type === 'school');
    } else if (state.filterType === 'colleges') {
      list = list.filter(i => i.institution_type === 'college');
    } else if (state.filterType === 'govt') {
      list = list.filter(i => i.management_type && i.management_type.toLowerCase().includes('government'));
    } else if (state.filterType === 'aided') {
      list = list.filter(i => i.management_type && i.management_type.toLowerCase().includes('aided') && !i.management_type.toLowerCase().includes('unaided'));
    } else if (state.filterType === 'verified') {
      list = list.filter(i => i.verification_status && i.verification_status.includes('Verified'));
    }

    // Filter by Search Query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      list = list.filter(i => 
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.block && i.block.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q)) ||
        (i.principal_name && i.principal_name.toLowerCase().includes(q)) ||
        (i.identifier && i.identifier.includes(q))
      );
    }
    return list;
  }

  // Render Institution Nodes on Map (Schools = Circles, Colleges = Squares)
  function renderPlotNodes() {
    if (!el.layerNodes) return;
    el.layerNodes.innerHTML = '';
    const filtered = getFilteredInstitutions();

    let renderedCount = 0;
    filtered.forEach(inst => {
      const x = Number(inst.svg_x !== undefined && inst.svg_x !== null ? inst.svg_x : inst.schematic_x);
      const y = Number(inst.svg_y !== undefined && inst.svg_y !== null ? inst.svg_y : inst.schematic_y);

      if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) {
        return; // Skip invalid coordinates
      }

      const isSelected = state.selectedId === inst.id;
      let shape;

      if (inst.institution_type === 'college') {
        // Colleges: Small square marker
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const size = isSelected ? 8 : 6;
        shape.setAttribute('x', String(x - size / 2));
        shape.setAttribute('y', String(y - size / 2));
        shape.setAttribute('width', String(size));
        shape.setAttribute('height', String(size));
        shape.setAttribute('rx', '1.2');
      } else {
        // Schools: Small circular marker
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shape.setAttribute('cx', String(x));
        shape.setAttribute('cy', String(y));
        shape.setAttribute('r', isSelected ? '4.5' : '2.6');
      }

      shape.setAttribute('class', `node-dot type-${inst.institution_type} ${isSelected ? 'selected pulsing' : ''}`);
      shape.setAttribute('data-id', inst.id);
      shape.setAttribute('id', `node-${inst.id}`);
      shape.setAttribute('role', 'button');
      shape.setAttribute('tabindex', '0');
      shape.setAttribute('aria-label', `${inst.name}, ${inst.institution_type}`);

      shape.addEventListener('mouseenter', () => showNodeHoverCard(inst, x, y));
      shape.addEventListener('mouseleave', () => hideNodeHoverCard());
      shape.addEventListener('click', (e) => {
        if (state.camera.hasDragged) {
          state.camera.hasDragged = false;
          return;
        }
        e.stopPropagation();
        selectInstitution(inst.id);
      });

      el.layerNodes.appendChild(shape);
      renderedCount++;
    });

    // Diagnostic logging for QA
    console.log(`[Edu-Explore Cape Map Diagnostics]
Total institutions: ${state.institutions.length}
Filtered institutions: ${filtered.length}
Visible map markers rendered: ${renderedCount}`);
  }

  function showNodeHoverCard(inst, x, y) {
    if (!el.layerOverlays) return;
    el.layerOverlays.innerHTML = '';
    const posX = x !== undefined ? x : Number(inst.svg_x || inst.schematic_x);
    const posY = y !== undefined ? y : Number(inst.svg_y || inst.schematic_y);

    const card = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    card.setAttribute('class', 'node-hover-tooltip');
    card.setAttribute('pointer-events', 'none');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(posX - 100));
    rect.setAttribute('y', String(posY - 45));
    rect.setAttribute('width', '200');
    rect.setAttribute('height', '38');
    rect.setAttribute('rx', '5');
    rect.setAttribute('fill', '#1A1916');
    rect.setAttribute('opacity', '0.94');

    const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text1.setAttribute('x', String(posX));
    text1.setAttribute('y', String(posY - 28));
    text1.setAttribute('fill', '#FFFFFF');
    text1.setAttribute('font-size', '10.5');
    text1.setAttribute('font-weight', '700');
    text1.setAttribute('text-anchor', 'middle');
    const name = state.lang === 'ta' && inst.name_ta ? inst.name_ta : inst.name;
    text1.textContent = name.length > 28 ? name.substring(0, 26) + '...' : name;

    const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text2.setAttribute('x', String(posX));
    text2.setAttribute('y', String(posY - 15));
    text2.setAttribute('fill', '#B0AFA8');
    text2.setAttribute('font-size', '9');
    text2.setAttribute('text-anchor', 'middle');
    text2.textContent = `${inst.category} · ${inst.block}`;

    card.appendChild(rect);
    card.appendChild(text1);
    card.appendChild(text2);
    el.layerOverlays.appendChild(card);
  }

  function hideNodeHoverCard() {
    el.layerOverlays.innerHTML = '';
  }

  // RENDER INSTITUTION SIDEBAR FEED (Phase 2 & Phase 22)
  function renderIndexView() {
    if (!el.indexContent) return;
    el.indexContent.innerHTML = '';

    const filtered = getFilteredInstitutions();

    // Zero false empty state (Phase 2)
    if (filtered.length === 0) {
      if (el.indexEmptyState) el.indexEmptyState.classList.remove('hidden');
      if (el.sidebarTotalLabel) el.sidebarTotalLabel.textContent = '0 institutions found';
      return;
    } else {
      if (el.indexEmptyState) el.indexEmptyState.classList.add('hidden');
    }

    if (el.sidebarTotalLabel) {
      const regionText = state.selectedBlock ? ` in ${state.selectedBlock}` : ' in Kanyakumari';
      el.sidebarTotalLabel.textContent = `Showing ${filtered.length.toLocaleString()} institutions${regionText}`;
    }

    // Group items by block
    const grouped = {};
    state.blocks.forEach(b => { grouped[b.name] = []; });
    filtered.forEach(inst => {
      const bKey = inst.block || 'Other';
      if (!grouped[bKey]) grouped[bKey] = [];
      grouped[bKey].push(inst);
    });

    const blockList = state.blocks.map(b => b.name);
    Object.keys(grouped).forEach(k => {
      if (!blockList.includes(k)) blockList.push(k);
    });

    blockList.forEach(bNameKey => {
      const items = grouped[bNameKey] || [];
      if (items.length === 0) return;

      const groupDiv = document.createElement('div');
      groupDiv.setAttribute('class', 'index-block-group');

      const bObj = state.blocks.find(b => b.name === bNameKey);
      const bTitle = state.lang === 'ta' && bObj && bObj.name_ta ? bObj.name_ta : bNameKey.toUpperCase();

      const heading = document.createElement('div');
      heading.setAttribute('class', 'index-block-heading');
      heading.innerHTML = `<span>${escapeHtml(bTitle)}</span> <span class="index-block-count">${items.length}</span>`;
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

        row.addEventListener('mouseenter', () => pulseMapNode(inst.id));
        row.addEventListener('mouseleave', () => unpulseMapNodes());
        row.addEventListener('focus', () => pulseMapNode(inst.id));
        row.addEventListener('blur', () => unpulseMapNodes());

        row.addEventListener('click', () => {
          selectInstitution(inst.id);
          if (window.innerWidth < 900) {
            switchMobileView('plot');
            zoomToBlock(inst.block);
            pulseMapNode(inst.id);
          }
        });

        groupDiv.appendChild(row);
      });

      el.indexContent.appendChild(groupDiv);
    });
  }

  function pulseMapNode(id) {
    unpulseMapNodes();
    const node = document.getElementById(`node-${id}`);
    if (node) node.classList.add('pulsing');
  }

  function unpulseMapNodes() {
    document.querySelectorAll('.node-dot.pulsing').forEach(n => {
      if (n.getAttribute('data-id') !== state.selectedId) {
        n.classList.remove('pulsing');
      }
    });
  }

  // SELECT INSTITUTION & POPULATE DOCK (Phase 24 & 25)
  function selectInstitution(id) {
    state.selectedId = id;
    const inst = state.institutionsMap.get(id);
    if (!inst) return;

    state.currentInstitution = inst;

    // Highlight row in list
    document.querySelectorAll('.index-row').forEach(r => {
      if (r.getAttribute('data-id') === id) {
        r.classList.add('selected');
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        r.classList.remove('selected');
      }
    });

    pulseMapNode(id);

    // Populate Slide-In Dock
    const name = state.lang === 'ta' && inst.name_ta ? inst.name_ta : inst.name;
    if (el.dockTitle) el.dockTitle.textContent = name;
    if (el.dockCatLine) el.dockCatLine.textContent = `${inst.category} · ${inst.management_type || 'Institution'}`;
    if (el.dockTypeBadge) el.dockTypeBadge.textContent = (inst.institution_type || 'SCHOOL').toUpperCase();
    if (el.dockStatusBadge) el.dockStatusBadge.textContent = inst.verification_status || 'Verified';

    if (el.dockId) el.dockId.textContent = inst.identifier || '—';
    if (el.dockBlock) el.dockBlock.textContent = `${inst.block || '—'} (${inst.taluk || inst.block || '—'})`;
    if (el.dockMgmt) el.dockMgmt.textContent = inst.management_type || '—';
    if (el.dockMedium) el.dockMedium.textContent = inst.medium || 'English / Tamil';
    if (el.dockLocation) el.dockLocation.textContent = `${inst.location || '—'}${inst.pincode ? ` - ${inst.pincode}` : ''}`;
    
    const hmVal = inst.principal_name && inst.principal_name !== 'NA' ? inst.principal_name : 'Not available';
    if (el.dockHm) el.dockHm.textContent = hmVal;

    const phoneVal = inst.phone && inst.phone !== 'NA' ? inst.phone : 'Not available';
    if (el.dockPhone) el.dockPhone.textContent = phoneVal;

    const emailVal = inst.email && inst.email !== 'NA' ? inst.email : 'Not available';
    if (el.dockEmail) el.dockEmail.textContent = emailVal;

    const siteUrl = sanitizeUrl(inst.website);
    if (el.dockWebsite) {
      if (siteUrl) {
        el.dockWebsite.innerHTML = `<a href="${siteUrl}" target="_blank" rel="noopener noreferrer" style="color:#1F5C57; text-decoration:underline;">${escapeHtml(inst.website)}</a>`;
      } else {
        el.dockWebsite.textContent = 'Not available';
      }
    }

    if (el.dockStrength) {
      el.dockStrength.textContent = inst.student_count ? `${inst.student_count.toLocaleString()} students` : 'Not available';
    }

    if (el.btnActCall) {
      if (inst.phone && inst.phone !== 'NA') {
        el.btnActCall.href = `tel:${inst.phone}`;
        el.btnActCall.classList.remove('hidden');
      } else {
        el.btnActCall.classList.add('hidden');
      }
    }

    if (el.btnActWeb) {
      if (siteUrl) {
        el.btnActWeb.href = siteUrl;
        el.btnActWeb.classList.remove('hidden');
      } else {
        el.btnActWeb.classList.add('hidden');
      }
    }

    if (el.detailDock) el.detailDock.classList.remove('hidden');
    updateUrlParams();
  }

  function closeDetailDock() {
    state.selectedId = null;
    state.currentInstitution = null;
    if (el.detailDock) el.detailDock.classList.add('hidden');
    unpulseMapNodes();
    document.querySelectorAll('.index-row.selected').forEach(r => r.classList.remove('selected'));
    updateUrlParams();
  }

  // ZOOM & REGION INTERACTIONS (Phase 11 & 14)
  function zoomToBlock(blockName) {
    state.selectedBlock = blockName;
    const b = state.blocks.find(x => x.name === blockName);

    if (b && b.min_x !== undefined) {
      const pad = 40;
      const w = Math.max(b.max_x - b.min_x + pad * 2, 200);
      const h = Math.max(b.max_y - b.min_y + pad * 2, 200);
      const x = b.min_x - pad;
      const y = b.min_y - pad;
      animateViewBox(x, y, w, h);
    }

    if (el.activeBlockPill) {
      el.activeBlockPill.classList.remove('hidden');
      if (el.activeBlockName) {
        el.activeBlockName.textContent = state.lang === 'ta' && b && b.name_ta ? b.name_ta : blockName;
      }
    }

    if (el.sidebarBlockBanner) {
      el.sidebarBlockBanner.classList.remove('hidden');
      if (el.sidebarBlockTitle) {
        el.sidebarBlockTitle.textContent = state.lang === 'ta' && b && b.name_ta ? b.name_ta : blockName;
      }
    }

    document.querySelectorAll('.block-polygon').forEach(p => {
      if (p.getAttribute('data-block') === blockName) {
        p.classList.add('selected');
      } else {
        p.classList.remove('selected');
      }
    });

    renderPlotNodes();
    renderIndexView();
    updateUrlParams();
  }

  function resetDistrictView() {
    state.selectedBlock = null;
    if (el.activeBlockPill) el.activeBlockPill.classList.add('hidden');
    if (el.sidebarBlockBanner) el.sidebarBlockBanner.classList.add('hidden');
    document.querySelectorAll('.block-polygon').forEach(p => p.classList.remove('selected'));

    animateViewBox(0, 0, 1000, 1000);
    renderPlotNodes();
    renderIndexView();
    updateUrlParams();
  }

  function setViewBox(x, y, w, h) {
    state.camera.x = x;
    state.camera.y = y;
    state.camera.w = w;
    state.camera.h = h;
    if (el.plotSvg) {
      el.plotSvg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    }
  }

  function animateViewBox(targetX, targetY, targetW, targetH) {
    setViewBox(targetX, targetY, targetW, targetH);
  }

  // EVENT LISTENERS & SETUP
  function setupEventListeners() {
    // Header Filter Segments
    document.querySelectorAll('.filter-segment').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-segment').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filterType = btn.getAttribute('data-filter') || 'all';
        renderPlotNodes();
        renderIndexView();
        updateUrlParams();
      });
    });

    // Search Input
    if (el.searchInput) {
      el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery) {
          if (el.searchClear) el.searchClear.classList.remove('hidden');
        } else {
          if (el.searchClear) el.searchClear.classList.add('hidden');
        }
        renderPlotNodes();
        renderIndexView();
        updateUrlParams();
      });
    }

    if (el.searchClear) {
      el.searchClear.addEventListener('click', () => {
        if (el.searchInput) el.searchInput.value = '';
        state.searchQuery = '';
        el.searchClear.classList.add('hidden');
        renderPlotNodes();
        renderIndexView();
        updateUrlParams();
      });
    }

    // Language Toggle
    if (el.btnLangToggle) {
      el.btnLangToggle.addEventListener('click', () => {
        state.lang = state.lang === 'en' ? 'ta' : 'en';
        localStorage.setItem(LANG_STORAGE_KEY, state.lang);
        updateLanguage();
        renderIndexView();
        updateUrlParams();
      });
    }

    // Mobile View Toggle
    if (el.viewPlotBtn) el.viewPlotBtn.addEventListener('click', () => switchMobileView('plot'));
    if (el.viewIndexBtn) el.viewIndexBtn.addEventListener('click', () => switchMobileView('index'));

    
  // FULL MAP PAN, DRAG & ZOOM ENGINE (Desktop Pointer + Mobile Touch + Wheel)
  function setupMapPanAndZoom() {
    if (!el.svgContainer || !el.plotSvg) return;

    // Pointer Down (Mouse, Touch, Pen)
    el.svgContainer.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('.ctrl-btn') || e.target.closest('.active-block-pill button') || e.target.closest('.map-legend')) {
        return;
      }

      const vb = el.plotSvg.viewBox.baseVal;
      state.camera.isPanning = true;
      state.camera.hasDragged = false;
      state.camera.startX = e.clientX;
      state.camera.startY = e.clientY;
      state.camera.startVbX = vb.x;
      state.camera.startVbY = vb.y;
      state.camera.startVbW = vb.width;
      state.camera.startVbH = vb.height;
    });

    // Pointer Move
    el.svgContainer.addEventListener('pointermove', (e) => {
      if (!state.camera.isPanning) return;

      const dx = e.clientX - state.camera.startX;
      const dy = e.clientY - state.camera.startY;

      if (!state.camera.hasDragged && Math.hypot(dx, dy) > 4) {
        state.camera.hasDragged = true;
        el.svgContainer.classList.add('is-panning');
        try {
          el.svgContainer.setPointerCapture(e.pointerId);
        } catch (err) {}
      }

      if (state.camera.hasDragged) {
        const rect = el.svgContainer.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const scaleX = state.camera.startVbW / rect.width;
        const scaleY = state.camera.startVbH / rect.height;

        const newX = state.camera.startVbX - dx * scaleX;
        const newY = state.camera.startVbY - dy * scaleY;

        setViewBox(newX, newY, state.camera.startVbW, state.camera.startVbH);
      }
    });

    // Pointer Up / Cancel / Leave
    const endPan = (e) => {
      if (state.camera.isPanning) {
        state.camera.isPanning = false;
        el.svgContainer.classList.remove('is-panning');
        try {
          if (e && e.pointerId !== undefined && el.svgContainer.hasPointerCapture(e.pointerId)) {
            el.svgContainer.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}
        
        // Reset hasDragged after the immediate synthetic click event has passed
        if (state.camera.hasDragged) {
          setTimeout(() => {
            state.camera.hasDragged = false;
          }, 60);
        }
      }
    };

    el.svgContainer.addEventListener('pointerup', endPan);
    el.svgContainer.addEventListener('pointercancel', endPan);
    el.svgContainer.addEventListener('pointerleave', (e) => {
      if (state.camera.isPanning && e && e.pointerId !== undefined) {
        try {
          if (!el.svgContainer.hasPointerCapture(e.pointerId)) {
            endPan(e);
          }
        } catch (err) { endPan(e); }
      }
    });

    // Wheel Zoom (Anchored to mouse cursor coordinate in SVG space)
    el.svgContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = el.svgContainer.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const vb = el.plotSvg.viewBox.baseVal;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      const zoomFactor = e.deltaY < 0 ? 0.85 : 1.18;
      const newW = Math.max(Math.min(vb.width * zoomFactor, 3000), 50);
      const newH = Math.max(Math.min(vb.height * zoomFactor, 3000), 50);

      const svgMouseX = vb.x + px * vb.width;
      const svgMouseY = vb.y + py * vb.height;

      const newX = svgMouseX - px * newW;
      const newY = svgMouseY - py * newH;

      setViewBox(newX, newY, newW, newH);
    }, { passive: false });

    // Touch Pinch Zoom & Pan on mobile
    let initialTouchDist = 0;
    let initialTouchW = 1000;
    let initialTouchH = 1000;
    let initialTouchMidX = 0;
    let initialTouchMidY = 0;
    let initialVbX = 0;
    let initialVbY = 0;

    el.svgContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        state.camera.isPanning = false; // Disable single pointer pan during pinch
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const vb = el.plotSvg.viewBox.baseVal;
        initialTouchW = vb.width;
        initialTouchH = vb.height;
        initialVbX = vb.x;
        initialVbY = vb.y;
        initialTouchMidX = (t1.clientX + t2.clientX) / 2;
        initialTouchMidY = (t1.clientY + t2.clientY) / 2;
      }
    }, { passive: false });

    el.svgContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialTouchDist > 0) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = initialTouchDist / Math.max(dist, 1);

        const rect = el.svgContainer.getBoundingClientRect();
        const px = (initialTouchMidX - rect.left) / rect.width;
        const py = (initialTouchMidY - rect.top) / rect.height;

        const newW = Math.max(Math.min(initialTouchW * factor, 3000), 50);
        const newH = Math.max(Math.min(initialTouchH * factor, 3000), 50);

        const svgMouseX = initialVbX + px * initialTouchW;
        const svgMouseY = initialVbY + py * initialTouchH;

        const newX = svgMouseX - px * newW;
        const newY = svgMouseY - py * newH;

        setViewBox(newX, newY, newW, newH);
      }
    }, { passive: false });
  }


    setupMapPanAndZoom();

    // Map Controls
    if (el.zoomIn) {
      el.zoomIn.addEventListener('click', () => {
        const vb = el.plotSvg.viewBox.baseVal;
        const newW = vb.width * 0.8;
        const newH = vb.height * 0.8;
        const newX = vb.x + (vb.width - newW) / 2;
        const newY = vb.y + (vb.height - newH) / 2;
        animateViewBox(newX, newY, newW, newH);
      });
    }

    if (el.zoomOut) {
      el.zoomOut.addEventListener('click', () => {
        const vb = el.plotSvg.viewBox.baseVal;
        const newW = Math.min(vb.width * 1.25, 1000);
        const newH = Math.min(vb.height * 1.25, 1000);
        const newX = Math.max(vb.x - (newW - vb.width) / 2, 0);
        const newY = Math.max(vb.y - (newH - vb.height) / 2, 0);
        animateViewBox(newX, newY, newW, newH);
      });
    }

    if (el.zoomReset) el.zoomReset.addEventListener('click', resetDistrictView);
    if (el.btnExitBlock) el.btnExitBlock.addEventListener('click', resetDistrictView);
    if (el.btnClearBlockFilter) el.btnClearBlockFilter.addEventListener('click', resetDistrictView);

    if (el.btnResetFilters) {
      el.btnResetFilters.addEventListener('click', () => {
        state.filterType = 'all';
        state.searchQuery = '';
        state.selectedBlock = null;
        if (el.searchInput) el.searchInput.value = '';
        if (el.searchClear) el.searchClear.classList.add('hidden');
        document.querySelectorAll('.filter-segment').forEach(b => {
          if (b.getAttribute('data-filter') === 'all') b.classList.add('active');
          else b.classList.remove('active');
        });
        resetDistrictView();
      });
    }

    // Detail Dock Actions
    if (el.dockClose) el.dockClose.addEventListener('click', closeDetailDock);

    if (el.btnActCopy) {
      el.btnActCopy.addEventListener('click', () => {
        if (!state.currentInstitution) return;
        const i = state.currentInstitution;
        const text = `${i.name}\nBlock: ${i.block}\nCategory: ${i.category}\nPhone: ${i.phone || 'NA'}\nEmail: ${i.email || 'NA'}\nWebsite: ${i.website || 'NA'}`;
        copyTextToClipboard(text, '✓ Contact details copied to clipboard!');
      });
    }

    if (el.btnActShare) {
      el.btnActShare.addEventListener('click', () => {
        const url = window.location.href;
        copyTextToClipboard(url, '✓ Link copied to clipboard!');
      });
    }

    // Modals
    if (el.linkPrivacy) el.linkPrivacy.addEventListener('click', (e) => { e.preventDefault(); el.modalPrivacy.classList.remove('hidden'); });
    if (el.linkTerms) el.linkTerms.addEventListener('click', (e) => { e.preventDefault(); el.modalTerms.classList.remove('hidden'); });
    if (el.btnOpenCorrection) {
      el.btnOpenCorrection.addEventListener('click', () => {
        if (state.currentInstitution && el.corrInstName) {
          el.corrInstName.value = state.currentInstitution.name;
        }
        if (el.modalCorrection) el.modalCorrection.classList.remove('hidden');
      });
    }

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      });
    });

    if (el.formCorrection) {
      el.formCorrection.addEventListener('submit', (e) => {
        e.preventDefault();
        if (el.corrSuccess) el.corrSuccess.classList.remove('hidden');
        setTimeout(() => {
          if (el.modalCorrection) el.modalCorrection.classList.add('hidden');
          if (el.corrSuccess) el.corrSuccess.classList.add('hidden');
          el.formCorrection.reset();
        }, 1800);
      });
    }
  }

  // Initialization
  readUrlParams();
  setupEventListeners();
  initData();

})();

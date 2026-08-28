// Edu-Explore Cape — Kanyakumari Educational Directory & Spatial Explorer Client Engine
// Measured Trousdale Interaction Model — Unconstrained 1:1 Direct-Track Block Dragging & Production Hardening

(function () {
  'use strict';

  const STORAGE_KEY = 'cape_plot_block_positions_v3';

  // Security: Strict HTML Entity Escaping against XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Security: Safe URL Protocol Validation
  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed === 'NA' || trimmed === 'Not Available') return null;
    let url = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  const state = {
    view: 'plot',
    selectedBlock: null,
    selectedId: null,
    filterType: 'all',
    searchQuery: '',
    blocks: [],
    defaultBlocks: [],
    institutions: [],
    institutionsMap: new Map(),
    camera: {
      x: 0,
      y: 0,
      w: 1100,
      h: 1100,
      targetX: 0,
      targetY: 0,
      targetW: 1100,
      targetH: 1100,
      isPanning: false,
      startX: 0,
      startY: 0
    },
    drag: {
      isDragging: false,
      blockName: null,
      offsetX: 0,
      offsetY: 0,
      hasMoved: false,
      nodesOffset: new Map()
    }
  };

  const el = {
    surfacePlot: document.getElementById('surface-plot'),
    surfaceIndex: document.getElementById('surface-index'),
    viewPlotBtn: document.getElementById('view-plot-btn'),
    viewIndexBtn: document.getElementById('view-index-btn'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    pillBtns: document.querySelectorAll('.pill-btn'),
    exportBtn: document.getElementById('export-btn'),
    exportMenu: document.getElementById('export-menu'),
    btnResetView: document.getElementById('btn-reset-view'),
    
    plotSvg: document.getElementById('plot-svg'),
    svgContainer: document.getElementById('svg-container'),
    layerBlocks: document.getElementById('layer-blocks'),
    layerLines: document.getElementById('layer-lines'),
    layerNodes: document.getElementById('layer-nodes'),
    layerOverlays: document.getElementById('layer-overlays'),
    activeBlockPill: document.getElementById('active-block-pill'),
    activeBlockName: document.getElementById('active-block-name'),
    btnExitBlock: document.getElementById('btn-exit-block'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    zoomReset: document.getElementById('zoom-reset'),
    btnResetPositions: document.getElementById('btn-reset-positions'),

    indexContent: document.getElementById('index-content'),
    indexEmptyState: document.getElementById('index-empty-state'),
    emptyStateMsg: document.getElementById('empty-state-msg'),
    btnResetFilters: document.getElementById('btn-reset-filters'),

    detailDock: document.getElementById('detail-dock'),
    dockClose: document.getElementById('dock-close'),
    dockTypeBadge: document.getElementById('dock-type-badge'),
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
    dockStatusBadge: document.getElementById('dock-status-badge'),
    dockNotes: document.getElementById('dock-notes'),
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

  // Convert screen coordinates to SVG space
  function screenToSvg(clientX, clientY) {
    const pt = el.plotSvg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = el.plotSvg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    return pt.matrixTransform(ctm.inverse());
  }

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view')) state.view = params.get('view');
    if (params.get('block')) state.selectedBlock = params.get('block');
    if (params.get('id')) state.selectedId = params.get('id');
    if (params.get('type')) state.filterType = params.get('type');
    if (params.get('q')) state.searchQuery = params.get('q');
  }

  function updateUrlParams() {
    const params = new URLSearchParams();
    if (state.view !== 'plot') params.set('view', state.view);
    if (state.selectedBlock) params.set('block', state.selectedBlock);
    if (state.selectedId) params.set('id', state.selectedId);
    if (state.filterType !== 'all') params.set('type', state.filterType);
    if (state.searchQuery) params.set('q', state.searchQuery);

    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  function loadCustomBlockPositions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const posMap = JSON.parse(saved);
      state.blocks.forEach(b => {
        if (posMap[b.name]) {
          const deltaX = posMap[b.name].cx - b.cx;
          const deltaY = posMap[b.name].cy - b.cy;
          b.cx = posMap[b.name].cx;
          b.cy = posMap[b.name].cy;

          state.institutions.forEach(inst => {
            if (inst.block === b.name) {
              inst.schematic_x += deltaX;
              inst.schematic_y += deltaY;
            }
          });
        }
      });
      if (el.btnResetPositions) el.btnResetPositions.classList.remove('hidden');
    } catch (e) {
      console.warn('Could not load custom positions:', e);
    }
  }

  function saveCustomBlockPositions() {
    try {
      const posMap = {};
      state.blocks.forEach(b => {
        posMap[b.name] = { cx: b.cx, cy: b.cy };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posMap));
      if (el.btnResetPositions) el.btnResetPositions.classList.remove('hidden');
    } catch (e) {
      console.warn('Could not save positions:', e);
    }
  }

  function resetBlockPositions() {
    localStorage.removeItem(STORAGE_KEY);
    if (el.btnResetPositions) el.btnResetPositions.classList.add('hidden');
    
    state.blocks = JSON.parse(JSON.stringify(state.defaultBlocks));
    initData(false);
  }

  async function initData(fetchFromApi = true) {
    try {
      if (fetchFromApi) {
        const resBlocks = await fetch('/api/blocks');
        if (!resBlocks.ok) throw new Error('Blocks API failure');
        const dataBlocks = await resBlocks.json();
        state.blocks = dataBlocks.blocks;
        state.defaultBlocks = JSON.parse(JSON.stringify(dataBlocks.blocks));

        const resInst = await fetch('/api/institutions?limit=1500');
        if (!resInst.ok) throw new Error('Institutions API failure');
        const dataInst = await resInst.json();
        state.institutions = dataInst.institutions;

        state.institutions.forEach(inst => {
          inst.base_x = inst.schematic_x;
          inst.base_y = inst.schematic_y;
          state.institutionsMap.set(inst.id, inst);
        });

        loadCustomBlockPositions();
      } else {
        state.institutions.forEach(inst => {
          inst.schematic_x = inst.base_x;
          inst.schematic_y = inst.base_y;
        });
      }

      renderPlotBlocks();
      renderPlotNodes();
      renderIndexView();
      applyUrlState();

      const schoolCnt = state.institutions.filter(i => i.institution_type === 'school').length;
      const collegeCnt = state.institutions.filter(i => i.institution_type === 'college').length;
      el.footerStats.textContent = `${schoolCnt.toLocaleString()} schools · ${collegeCnt.toLocaleString()} colleges · 9 blocks`;
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  function switchView(newView) {
    state.view = newView;
    if (newView === 'plot') {
      el.surfacePlot.classList.remove('hidden');
      el.surfacePlot.classList.add('active');
      el.surfaceIndex.classList.remove('active');
      el.surfaceIndex.classList.add('hidden');
      el.viewPlotBtn.classList.add('active');
      el.viewPlotBtn.setAttribute('aria-pressed', 'true');
      el.viewIndexBtn.classList.remove('active');
      el.viewIndexBtn.setAttribute('aria-pressed', 'false');
    } else {
      el.surfaceIndex.classList.remove('hidden');
      el.surfaceIndex.classList.add('active');
      el.surfacePlot.classList.remove('active');
      el.surfacePlot.classList.add('hidden');
      el.viewIndexBtn.classList.add('active');
      el.viewIndexBtn.setAttribute('aria-pressed', 'true');
      el.viewPlotBtn.classList.remove('active');
      el.viewPlotBtn.setAttribute('aria-pressed', 'false');
      renderIndexView();
    }
    updateUrlParams();
  }

  function renderPlotBlocks() {
    el.layerBlocks.innerHTML = '';
    updateConnectingLines();

    state.blocks.forEach(b => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const isCenter = (b.name === 'Agasteeswaram');
      g.setAttribute('class', `block-cluster-group ${isCenter ? 'center-hub' : ''}`);
      g.setAttribute('data-block', b.name);
      g.setAttribute('id', `block-grp-${b.name}`);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', b.cx);
      circle.setAttribute('cy', b.cy);
      circle.setAttribute('r', b.r);
      circle.setAttribute('class', `block-boundary-ring ${isCenter ? 'ring-center' : ''}`);
      circle.setAttribute('id', `ring-${b.name}`);

      if (isCenter) {
        const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerCircle.setAttribute('cx', b.cx);
        innerCircle.setAttribute('cy', b.cy);
        innerCircle.setAttribute('r', b.r + 8);
        innerCircle.setAttribute('fill', 'none');
        innerCircle.setAttribute('stroke', 'rgba(31, 92, 87, 0.3)');
        innerCircle.setAttribute('stroke-width', '1');
        innerCircle.setAttribute('stroke-dasharray', '2 3');
        innerCircle.setAttribute('id', `inner-ring-${b.name}`);
        g.appendChild(innerCircle);
      }

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', b.cx);
      text.setAttribute('y', b.cy - b.r - 8);
      text.setAttribute('class', `block-label-text ${isCenter ? 'text-center-hub' : ''}`);
      text.setAttribute('id', `label-${b.name}`);
      text.textContent = isCenter ? 'KANYAKUMARI · AGASTEESWARAM' : b.name.toUpperCase();

      const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sub.setAttribute('x', b.cx);
      sub.setAttribute('y', b.cy - b.r + 4);
      sub.setAttribute('class', 'block-sub-count');
      sub.setAttribute('id', `sub-${b.name}`);
      sub.textContent = `${b.total_count} inst · ${b.taluk}`;

      g.appendChild(circle);
      g.appendChild(text);
      g.appendChild(sub);

      g.addEventListener('mousedown', (e) => {
        if (e.target.closest('.inst-node')) return;
        e.preventDefault();
        e.stopPropagation();
        startBlockDrag(b, e);
      });

      g.addEventListener('click', (e) => {
        if (state.drag.hasMoved) return;
        e.stopPropagation();
        zoomToBlock(b.name);
      });

      el.layerBlocks.appendChild(g);
    });
  }

  function updateConnectingLines() {
    el.layerLines.innerHTML = '';
    const centerBlock = state.blocks.find(b => b.name === 'Agasteeswaram') || { cx: 500, cy: 500 };

    state.blocks.forEach(b => {
      if (b.name === 'Agasteeswaram') return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', centerBlock.cx);
      line.setAttribute('y1', centerBlock.cy);
      line.setAttribute('x2', b.cx);
      line.setAttribute('y2', b.cy);
      line.setAttribute('stroke', 'rgba(31, 92, 87, 0.14)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 4');
      line.setAttribute('id', `line-${b.name}`);
      el.layerLines.appendChild(line);
    });
  }

  function startBlockDrag(block, e) {
    state.drag.isDragging = true;
    state.drag.blockName = block.name;
    state.drag.hasMoved = false;

    const svgPt = screenToSvg(e.clientX, e.clientY);
    state.drag.offsetX = svgPt.x - block.cx;
    state.drag.offsetY = svgPt.y - block.cy;

    state.drag.nodesOffset.clear();
    state.institutions.forEach(inst => {
      if (inst.block === block.name) {
        state.drag.nodesOffset.set(inst.id, {
          relX: inst.schematic_x - block.cx,
          relY: inst.schematic_y - block.cy
        });
      }
    });

    const grp = document.getElementById(`block-grp-${block.name}`);
    if (grp) grp.classList.add('is-dragging');
  }

  function onBlockDragMove(e) {
    if (!state.drag.isDragging) return;

    state.drag.hasMoved = true;
    const b = state.blocks.find(bl => bl.name === state.drag.blockName);
    if (!b) return;

    const svgPt = screenToSvg(e.clientX, e.clientY);
    
    b.cx = svgPt.x - state.drag.offsetX;
    b.cy = svgPt.y - state.drag.offsetY;

    const ring = document.getElementById(`ring-${b.name}`);
    if (ring) { ring.setAttribute('cx', b.cx); ring.setAttribute('cy', b.cy); }
    const innerRing = document.getElementById(`inner-ring-${b.name}`);
    if (innerRing) { innerRing.setAttribute('cx', b.cx); innerRing.setAttribute('cy', b.cy); }
    const label = document.getElementById(`label-${b.name}`);
    if (label) { label.setAttribute('x', b.cx); label.setAttribute('y', b.cy - b.r - 8); }
    const sub = document.getElementById(`sub-${b.name}`);
    if (sub) { sub.setAttribute('x', b.cx); sub.setAttribute('y', b.cy - b.r + 4); }

    state.institutions.forEach(inst => {
      if (inst.block === b.name) {
        const offset = state.drag.nodesOffset.get(inst.id);
        if (offset) {
          inst.schematic_x = b.cx + offset.relX;
          inst.schematic_y = b.cy + offset.relY;

          const nodeEl = document.querySelector(`.inst-node[data-id="${inst.id}"]`);
          if (nodeEl) {
            const mark = nodeEl.querySelector('.node-mark');
            if (mark) {
              if (inst.institution_type === 'school') {
                mark.setAttribute('cx', inst.schematic_x);
                mark.setAttribute('cy', inst.schematic_y);
              } else {
                mark.setAttribute('x', inst.schematic_x - 3.5);
                mark.setAttribute('y', inst.schematic_y - 3.5);
              }
            }
          }
        }
      }
    });

    updateConnectingLines();
  }

  function onBlockDragEnd() {
    if (!state.drag.isDragging) return;

    const grp = document.getElementById(`block-grp-${state.drag.blockName}`);
    if (grp) grp.classList.remove('is-dragging');

    if (state.drag.hasMoved) {
      saveCustomBlockPositions();
    }

    state.drag.isDragging = false;
  }

  function renderPlotNodes() {
    el.layerNodes.innerHTML = '';
    const filtered = getFilteredInstitutions();

    filtered.forEach(inst => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `inst-node type-${inst.institution_type}`);
      g.setAttribute('data-id', inst.id);
      g.setAttribute('data-block', inst.block);
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `${inst.name}, ${inst.category} in ${inst.block}`);

      let mark;
      if (inst.institution_type === 'school') {
        mark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        mark.setAttribute('cx', inst.schematic_x);
        mark.setAttribute('cy', inst.schematic_y);
        mark.setAttribute('r', inst.verification_status.includes('Verified') ? '3.8' : '3.2');
        mark.setAttribute('class', `node-mark school ${inst.verification_status.includes('Verified') ? 'verified' : ''}`);
      } else {
        mark = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        mark.setAttribute('x', inst.schematic_x - 3.5);
        mark.setAttribute('y', inst.schematic_y - 3.5);
        mark.setAttribute('width', '7');
        mark.setAttribute('height', '7');
        mark.setAttribute('rx', '1');
        mark.setAttribute('class', 'node-mark college');
      }

      g.appendChild(mark);

      g.addEventListener('mouseenter', () => handleNodeHover(inst, g));
      g.addEventListener('mouseleave', () => handleNodeLeave());

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        selectInstitution(inst.id);
      });

      el.layerNodes.appendChild(g);
    });
  }

  function handleNodeHover(inst, nodeGroup) {
    el.layerOverlays.innerHTML = '';
    el.layerNodes.style.opacity = '0.7';
    nodeGroup.style.opacity = '1.0';

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', inst.schematic_x + 8);
    text.setAttribute('y', inst.schematic_y - 4);
    text.setAttribute('class', 'node-hover-label');
    text.textContent = `${inst.name} (${inst.category})`;

    el.layerOverlays.appendChild(text);
  }

  function handleNodeLeave() {
    el.layerOverlays.innerHTML = '';
    el.layerNodes.style.opacity = '1.0';
  }

  function setViewBox(x, y, w, h, animated = true) {
    state.camera.targetX = x;
    state.camera.targetY = y;
    state.camera.targetW = w;
    state.camera.targetH = h;

    if (!animated) {
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

    const factor = 0.18;
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
    setViewBox(0, 0, 1100, 1100, true);
    updateUrlParams();
  }

  function zoomToBlock(blockName) {
    const b = state.blocks.find(bl => bl.name === blockName);
    if (!b) return;

    state.selectedBlock = blockName;
    el.activeBlockName.textContent = `${b.name} (${b.total_count} institutions)`;
    el.activeBlockPill.classList.remove('hidden');

    const span = b.r * 2.5;
    const x = Math.max(0, b.cx - span / 2);
    const y = Math.max(0, b.cy - span / 2);
    setViewBox(x, y, span, span, true);
    updateUrlParams();
  }

  // Pan Canvas Handlers
  el.svgContainer.addEventListener('mousedown', (e) => {
    if (e.target.closest('.inst-node') || e.target.closest('.block-cluster-group')) return;
    state.camera.isPanning = true;
    state.camera.startX = e.clientX;
    state.camera.startY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (state.drag.isDragging) {
      onBlockDragMove(e);
      return;
    }

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

  window.addEventListener('mouseup', () => {
    if (state.drag.isDragging) {
      onBlockDragEnd();
    }
    state.camera.isPanning = false;
  });

  el.svgContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const targetBlock = e.target.closest('.block-cluster-group');
      if (targetBlock && !e.target.closest('.inst-node')) {
        const blockName = targetBlock.getAttribute('data-block');
        const b = state.blocks.find(bl => bl.name === blockName);
        if (b) {
          e.preventDefault();
          startBlockDrag(b, touch);
          return;
        }
      }

      state.camera.isPanning = true;
      state.camera.startX = touch.clientX;
      state.camera.startY = touch.clientY;
    }
  }, { passive: false });

  el.svgContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (state.drag.isDragging) {
        e.preventDefault();
        onBlockDragMove(touch);
        return;
      }
      if (state.camera.isPanning) {
        const dx = (touch.clientX - state.camera.startX) * (state.camera.w / el.svgContainer.clientWidth);
        const dy = (touch.clientY - state.camera.startY) * (state.camera.h / el.svgContainer.clientHeight);
        state.camera.targetX -= dx;
        state.camera.targetY -= dy;
        state.camera.x -= dx;
        state.camera.y -= dy;
        el.plotSvg.setAttribute('viewBox', `${state.camera.x} ${state.camera.y} ${state.camera.w} ${state.camera.h}`);
        state.camera.startX = touch.clientX;
        state.camera.startY = touch.clientY;
      }
    }
  }, { passive: false });

  el.svgContainer.addEventListener('touchend', () => {
    if (state.drag.isDragging) {
      onBlockDragEnd();
    }
    state.camera.isPanning = false;
  });

  el.svgContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    const newW = Math.min(1600, Math.max(150, state.camera.w * zoomFactor));
    const newH = Math.min(1600, Math.max(150, state.camera.h * zoomFactor));

    const cx = state.camera.x + state.camera.w / 2;
    const cy = state.camera.y + state.camera.h / 2;
    const newX = cx - newW / 2;
    const newY = cy - newH / 2;

    setViewBox(newX, newY, newW, newH, true);
  }, { passive: false });

  
  // Dynamic KPI Count Recalculation (Phase 5)
  function updateKpiBadgeCounts(subset) {
    const totalCount = subset.length;
    const schoolsCount = subset.filter(i => i.institution_type === 'school').length;
    const collegesCount = subset.filter(i => i.institution_type === 'college').length;
    const govtCount = subset.filter(i => i.management_type && i.management_type.toLowerCase().includes('government')).length;
    const aidedCount = subset.filter(i => i.management_type && i.management_type.toLowerCase().includes('aided')).length;
    const verifiedCount = subset.filter(i => i.verification_status && i.verification_status.includes('Verified')).length;

    const countMap = {
      'all': totalCount,
      'schools': schoolsCount,
      'colleges': collegesCount,
      'govt': govtCount,
      'aided': aidedCount,
      'verified': verifiedCount
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
    if (state.filterType !== 'all') {
      list = list.filter(i => i.institution_type === state.filterType);
    }
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

    // Dynamically compute counts against active search & type query
    let baseSubset = state.institutions;
    if (state.filterType !== 'all') {
      baseSubset = baseSubset.filter(i => i.institution_type === state.filterType);
    }
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      baseSubset = baseSubset.filter(i => 
        i.name.toLowerCase().includes(q) ||
        i.block.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.principal_name && i.principal_name.toLowerCase().includes(q)) ||
        (i.identifier && i.identifier.includes(q))
      );
    }
    updateKpiBadgeCounts(baseSubset);

    const filtered = getFilteredInstitutions();

    if (filtered.length === 0) {
      el.indexEmptyState.classList.remove('hidden');
      el.emptyStateMsg.textContent = state.searchQuery 
        ? `No institutions matched your search for "${state.searchQuery}".` 
        : 'No institutions available under the selected filter.';
      return;
    } else {
      el.indexEmptyState.classList.add('hidden');
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

      const heading = document.createElement('div');
      heading.setAttribute('class', 'index-block-heading');
      heading.innerHTML = `<span>${escapeHtml(b.name.toUpperCase())}</span> <span class="index-block-count">${items.length} institutions</span>`;
      groupDiv.appendChild(heading);

      items.forEach(inst => {
        const row = document.createElement('div');
        row.setAttribute('class', `index-row ${state.selectedId === inst.id ? 'selected' : ''}`);
        row.setAttribute('data-id', inst.id);
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-label', `${inst.name}, ${inst.category}`);

        row.innerHTML = `
          <div class="col-name">${escapeHtml(inst.name)}</div>
          <div class="col-type type-${escapeHtml(inst.institution_type)}">${escapeHtml(inst.institution_type)}</div>
          <div class="col-cat">${escapeHtml(inst.category)}</div>
          <div class="col-mgmt">${escapeHtml(inst.management_type)}</div>
          <div class="col-loc">${escapeHtml(inst.location || 'NA')}</div>
        `;

        row.addEventListener('click', () => {
          selectInstitution(inst.id);
        });

        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectInstitution(inst.id);
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

      el.dockTitle.textContent = data.name;
      el.dockTypeBadge.textContent = data.institution_type.toUpperCase();
      el.dockCatLine.textContent = `${data.category} · ${data.management_type}`;
      el.dockId.textContent = data.udise_code || data.identifier || data.id;
      el.dockBlock.textContent = `${data.block} (${data.taluk || 'NA'})`;
      el.dockMgmt.textContent = data.management_type || 'NA';
      el.dockMedium.textContent = data.medium || 'NA';
      el.dockLocation.textContent = data.location || 'NA';
      
      const hmVal = data.principal_name || data.hm_name;
      if (hmVal && hmVal !== 'NA' && hmVal !== 'Not Available') {
        el.dockHm.textContent = hmVal;
        el.dockHm.className = 'fact-val font-medium';
      } else {
        el.dockHm.textContent = 'NA';
        el.dockHm.className = 'fact-val val-na';
      }

      if (data.phone && data.phone !== 'NA' && data.phone !== 'Not Available') {
        const cleanPhone = data.phone.split('/')[0].trim();
        if (data.sources_notes && data.sources_notes.includes('BEO')) {
          el.dockPhone.innerHTML = `<a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(data.phone)}</a> <span class="text-sm font-mono" style="color:var(--color-ink-muted);display:block;margin-top:2px;">(Block BEO helpline)</span>`;
        } else {
          el.dockPhone.innerHTML = `<a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(data.phone)}</a>`;
        }
        el.dockPhone.className = 'fact-val';
      } else {
        el.dockPhone.textContent = 'NA';
        el.dockPhone.className = 'fact-val val-na';
      }

      if (data.email && data.email !== 'NA' && data.email !== 'Not Available') {
        const cleanEmail = data.email.split('/')[0].trim();
        el.dockEmail.innerHTML = `<a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(data.email)}</a>`;
        el.dockEmail.className = 'fact-val';
      } else {
        el.dockEmail.textContent = 'NA';
        el.dockEmail.className = 'fact-val val-na';
      }

      const safeWebUrl = sanitizeUrl(data.website);
      if (safeWebUrl) {
        el.dockWebsite.innerHTML = `<a href="${escapeHtml(safeWebUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.website)} ↗</a>`;
        el.dockWebsite.className = 'fact-val';
      } else {
        el.dockWebsite.textContent = 'NA';
        el.dockWebsite.className = 'fact-val val-na';
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

      el.dockStatusBadge.textContent = data.verification_status;
      if (data.verification_status && data.verification_status.includes('Verified')) {
        el.dockStatusBadge.className = 'status-badge verified';
      } else {
        el.dockStatusBadge.className = 'status-badge';
      }
      el.dockNotes.textContent = data.sources_notes || 'Official institution record';

      // Pre-fill correction modal with current institution
      if (el.corrInstName) {
        el.corrInstName.value = `${data.name} (${data.udise_code || data.identifier || data.id})`;
      }

      el.detailDock.classList.remove('hidden');

      document.querySelectorAll('.index-row').forEach(r => {
        r.classList.toggle('selected', r.getAttribute('data-id') === instId);
      });

      updateUrlParams();
    } catch (err) {
      console.error('Error loading institution detail:', err);
    }
  }

  function closeDetailDock() {
    state.selectedId = null;
    el.detailDock.classList.add('hidden');
    document.querySelectorAll('.index-row').forEach(r => r.classList.remove('selected'));
    updateUrlParams();
  }

  function applyUrlState() {
    if (state.filterType) {
      el.pillBtns.forEach(btn => {
        const isMatch = (btn.getAttribute('data-type') === state.filterType);
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
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

    if (state.view === 'index') {
      switchView('index');
    }
  }

  el.viewPlotBtn.addEventListener('click', () => switchView('plot'));
  el.viewIndexBtn.addEventListener('click', () => switchView('index'));

  el.btnResetView.addEventListener('click', resetDistrictView);
  el.btnExitBlock.addEventListener('click', resetDistrictView);
  el.zoomReset.addEventListener('click', resetDistrictView);
  if (el.btnResetPositions) el.btnResetPositions.addEventListener('click', resetBlockPositions);

  el.zoomIn.addEventListener('click', () => {
    setViewBox(state.camera.x + state.camera.w * 0.1, state.camera.y + state.camera.h * 0.1, state.camera.w * 0.8, state.camera.h * 0.8);
  });
  el.zoomOut.addEventListener('click', () => {
    setViewBox(state.camera.x - state.camera.w * 0.1, state.camera.y - state.camera.h * 0.1, state.camera.w * 1.2, state.camera.h * 1.2);
  });

  el.dockClose.addEventListener('click', closeDetailDock);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el.detailDock.classList.contains('hidden')) {
        closeDetailDock();
      } else if (state.selectedBlock) {
        resetDistrictView();
      }
      closeAllModals();
    }
  });

  el.pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.pillBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      state.filterType = btn.getAttribute('data-type');
      renderPlotNodes();
      renderIndexView();
      updateUrlParams();
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
      el.pillBtns.forEach(b => {
        const isAll = (b.getAttribute('data-type') === 'all');
        b.classList.toggle('active', isAll);
        b.setAttribute('aria-pressed', isAll ? 'true' : 'false');
      });
      renderPlotNodes();
      renderIndexView();
      updateUrlParams();
    });
  }

  el.exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = el.exportMenu.classList.contains('hidden');
    el.exportMenu.classList.toggle('hidden', !isHidden);
    el.exportBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  window.addEventListener('click', (e) => {
    if (!el.exportMenu.classList.contains('hidden')) {
      el.exportMenu.classList.add('hidden');
      el.exportBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Modal Handlers
  function closeAllModals() {
    [el.modalPrivacy, el.modalTerms, el.modalCorrection].forEach(m => {
      if (m) m.classList.add('hidden');
    });
  }

  if (el.linkPrivacy) {
    el.linkPrivacy.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
      if (el.modalPrivacy) el.modalPrivacy.classList.remove('hidden');
    });
  }

  if (el.linkTerms) {
    el.linkTerms.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllModals();
      if (el.modalTerms) el.modalTerms.classList.remove('hidden');
    });
  }

  if (el.btnOpenCorrection) {
    el.btnOpenCorrection.addEventListener('click', () => {
      closeAllModals();
      if (el.modalCorrection) {
        el.corrSuccess.classList.add('hidden');
        el.modalCorrection.classList.remove('hidden');
      }
    });
  }

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const targetModal = document.getElementById(modalId);
      if (targetModal) targetModal.classList.add('hidden');
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });

  if (el.formCorrection) {
    el.formCorrection.addEventListener('submit', (e) => {
      e.preventDefault();
      el.corrSuccess.classList.remove('hidden');
      setTimeout(() => {
        if (el.modalCorrection) el.modalCorrection.classList.add('hidden');
      }, 2500);
    });
  }

  
  // Theme Engine (No FOUC & LocalStorage Persistence)
  function initTheme() {
    const saved = localStorage.getItem('edu_explore_theme');
    const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'paper');
    applyTheme(theme, false);
  }

  function applyTheme(theme, save = true) {
    document.documentElement.className = 'theme-' + theme;
    document.body.className = 'theme-' + theme;
    if (save) {
      localStorage.setItem('edu_explore_theme', theme);
    }
  }

  function toggleTheme() {
    const current = document.documentElement.classList.contains('theme-midnight') ? 'midnight' : 'paper';
    const next = current === 'midnight' ? 'paper' : 'midnight';
    applyTheme(next, true);
  }

  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', toggleTheme);
  }

    
  // Mobile HUD Popover Toggle
  const btnMobileHud = document.getElementById('btn-mobile-hud-toggle');
  const popoverMobileHud = document.getElementById('mobile-hud-popover');
  const btnCloseHudPopover = document.getElementById('btn-close-hud-popover');

  if (btnMobileHud && popoverMobileHud) {
    btnMobileHud.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popoverMobileHud.classList.contains('hidden');
      popoverMobileHud.classList.toggle('hidden', !isHidden);
      btnMobileHud.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });

    if (btnCloseHudPopover) {
      btnCloseHudPopover.addEventListener('click', () => {
        popoverMobileHud.classList.add('hidden');
        btnMobileHud.setAttribute('aria-expanded', 'false');
      });
    }

    window.addEventListener('click', (e) => {
      if (!popoverMobileHud.classList.contains('hidden') && !e.target.closest('#mobile-hud-controls')) {
        popoverMobileHud.classList.add('hidden');
        btnMobileHud.setAttribute('aria-expanded', 'false');
      }
    });
  }

  readUrlParams();
  initData();
})();

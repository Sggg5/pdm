// FRANTA PDM v3 - Runtime B2B data source
// Products loaded directly from B2B project at runtime
// No separate product data maintenance needed

const B2B_DATA_URL = "/api/b2b-products";
const B2B_IMAGE_BASE = "https://sggg.cc.cd";
const LOCAL_FALLBACK = "data/products.json";

let allProducts = [];
let allChanges = [];
let filteredProducts = [];
let currentView = "home";
let currentProductId = null;

// --- Init ---
async function init() {
  try {
    const [pData, cRes] = await Promise.all([
      loadProducts(),
      fetch("data/changes.json")
    ]);
    if (!cRes.ok) throw new Error("Failed to load changes");
    allChanges = await cRes.json();
    allProducts = pData.map(enrichProduct);
    filteredProducts = [...allProducts];
    renderSidebar();
    renderHome();
    bindSearch();
  } catch (err) {
    document.getElementById("content").innerHTML =
      `<div style="padding:60px 20px;text-align:center;color:var(--muted)">
        <p style="font-size:18px;font-weight:600;color:var(--ink)">数据加载失败</p>
        <p>${err.message}</p>
      </div>`;
  }
}

// --- Load B2B products with fallback ---
async function loadProducts() {
  try {
    const res = await fetch(B2B_DATA_URL);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log("PDM: loaded", data.length, "products from B2B");
        return data;
      }
    }
  } catch (e) {
    console.log("PDM: B2B unavailable, using fallback");
  }
  const res = await fetch(LOCAL_FALLBACK);
  if (!res.ok) throw new Error("All data sources failed");
  const data = await res.json();
  console.log("PDM: loaded", data.length, "products from local fallback");
  return data;
}

// --- Enrich B2B product with PDM-specific fields ---
function enrichProduct(bp) {
  return {
    id: bp.id,
    code: bp.id,
    name: bp.name,
    category: mapCategory(bp.category, bp.name),
    spec: bp.size || "",
    material: bp.material || "",
    series: mapSeries(bp.category),
    version: "V1.0",
    status: "待发布",
    owner: "",
    updatedAt: new Date().toISOString().slice(0, 10),
    description: bp.description || "",
    image: bp.image ? B2B_IMAGE_BASE + bp.image : "",
    drawings: buildDrawings(bp),
    bom: [],
    routings: [],
    sops: [],
    inspection: [],
    changes: []
  };
}

// --- Build initial drawings from B2B CAD/PDF links ---
function buildDrawings(bp) {
  const dwgs = [];
  if (bp.pdf) dwgs.push({ id: bp.id + "-PDF", name: bp.name + " (PDF)", file: bp.pdf, type: "pdf", size: "" });
  if (bp.cad) dwgs.push({ id: bp.id + "-CAD", name: bp.name + " (DWG)", file: bp.cad, type: "dwg", size: "" });
  return dwgs;
}

// --- Category mapping: B2B -> PDM ---
function mapCategory(b2bCat, name) {
  const top = mapSeries(b2bCat);
  if (top === "沟槽系统") {
    if (name.includes("卡箍")) return ["沟槽系统", "卡箍"];
    if (name.includes("三通")) return ["沟槽系统", "三通"];
    if (name.includes("弯头")) return ["沟槽系统", "弯头"];
    if (name.includes("法兰")) return ["沟槽系统", "法兰"];
    return ["沟槽系统", "管件"];
  }
  return [top];
}

function mapSeries(b2bCat) {
  const m = {
    "沟槽管件": "沟槽系统",
    "双卡管件": "双卡压系统",
    "单卡管件": "环压系统",
    "保温管": "保温管系统",
    "覆塑管": "覆塑管系统",
    "不锈钢管": "不锈钢管系统",
    "不锈钢管件": "不锈钢管系统"
  };
  return m[b2bCat] || b2bCat;
}
// --- Sidebar ---
function renderSidebar() {
  const sb = document.getElementById("sidebar");
  const tree = getCategoryTree();
  let html = `<div class="sidebar-title">产品分类</div>`;
  html += `<div class="sidebar-item active" data-filter="__all__">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    全部产品
    <span class="count">${allProducts.length}</span>
  </div>`;
  tree.forEach(t => {
    const count = countByCategory(t.name, null);
    html += `<div class="sidebar-item" data-filter="${t.name}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V4h16v16z"/></svg>
      ${t.name}
      <span class="count">${count}</span>
    </div>`;
    if (t.children && t.children.length > 0) {
      t.children.forEach(c => {
        const cc = countByCategory(t.name, c);
        html += `<div class="sidebar-item sidebar-sub" data-filter="${t.name}|${c}">
          ${c}
          <span class="count">${cc}</span>
        </div>`;
      });
    }
  });
  sb.innerHTML = html;
  sb.querySelectorAll(".sidebar-item").forEach(el => {
    el.addEventListener("click", () => {
      sb.querySelectorAll(".sidebar-item").forEach(x => x.classList.remove("active"));
      el.classList.add("active");
      const filter = el.dataset.filter;
      applyCategoryFilter(filter);
    });
  });
}

function getCategoryTree() {
  const map = {};
  allProducts.forEach(p => {
    if (!p.category || p.category.length < 1) return;
    const top = p.category[0];
    const sub = p.category.length > 1 ? p.category[1] : null;
    if (!map[top]) map[top] = { name: top, children: [] };
    if (sub && !map[top].children.find(x => x === sub)) map[top].children.push(sub);
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

function countByCategory(top, sub) {
  if (!top) return allProducts.length;
  if (!sub) return allProducts.filter(p => p.category && p.category[0] === top).length;
  return allProducts.filter(p => p.category && p.category[0] === top && p.category[1] === sub).length;
}

function applyCategoryFilter(filter) {
  if (!filter || filter === "__all__") {
    filteredProducts = [...allProducts];
  } else {
    const parts = filter.split("|");
    filteredProducts = allProducts.filter(p => {
      if (!p.category) return false;
      if (parts.length === 1) return p.category[0] === parts[0];
      return p.category[0] === parts[0] && p.category[1] === parts[1];
    });
  }
  renderHome();
}

// --- Home ---
function renderHome() {
  currentView = "home";
  currentProductId = null;
  const el = document.getElementById("content");
  const stats = calcStats(filteredProducts);
  el.innerHTML = `
    <div class="hero">
      <h2>产品数据管理平台</h2>
      <p>产品数据同步自 B2B · ${allProducts.length} 个产品 · 实时更新</p>
      <div class="hero-actions">
        <button class="hero-btn hero-btn-primary" onclick="document.getElementById('searchInput').focus()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          搜索产品
        </button>
        <button class="hero-btn hero-btn-secondary" onclick="renderChanges()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
          查看变更
        </button>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></div>
        <div><div class="stat-num">${stats.products}</div><div class="stat-label">产品数量</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div><div class="stat-num">${stats.drawings}</div><div class="stat-label">图纸数量</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
        <div><div class="stat-num">${stats.sops}</div><div class="stat-label">SOP 数量</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg></div>
        <div><div class="stat-num">${stats.changes}</div><div class="stat-label">变更数量</div></div>
      </div>
    </div>
    <div class="section-head"><h3>模块入口</h3></div>
    <div class="module-grid">
      ${renderModules()}
    </div>
    <div class="section-head"><h3>产品列表</h3><p>${filteredProducts.length} 个产品</p></div>
    <div class="panel">
      <table class="data-table">
        <thead><tr><th>图片</th><th>产品名称</th><th>编码</th><th>规格</th><th>材质</th><th>状态</th><th>版本</th></tr></thead>
        <tbody>${renderProductRows(filteredProducts)}</tbody>
      </table>
    </div>
    <div class="section-head"><h3>最近变更记录</h3></div>
    <div class="panel"><div class="timeline">${renderChangeTimeline()}</div></div>
    <div class="footer">FRANTA PDM v3 · 产品数据实时同步自 B2B · ${allProducts.length} 个产品</div>
  `;
}

function calcStats(products) {
  let drawings = 0, sops = 0;
  products.forEach(p => {
    if (p.drawings) drawings += p.drawings.length;
    if (p.sops) sops += p.sops.length;
  });
  return { products: products.length, drawings, sops, changes: allChanges.length };
}

function renderModules() {
  const mods = [
    { icon: "\u{1F4E6}", name: "产品库", count: allProducts.length },
    { icon: "\u{1F4D0}", name: "图纸库", count: allProducts.reduce((a,p) => a + (p.drawings?p.drawings.length:0), 0) },
    { icon: "\u{1F4CB}", name: "BOM", count: allProducts.reduce((a,p) => a + (p.bom?p.bom.length:0), 0) },
    { icon: "\u2699\uFE0F", name: "工艺路线", count: allProducts.reduce((a,p) => a + (p.routings?p.routings.length:0), 0) },
    { icon: "\u{1F4C4}", name: "SOP", count: allProducts.reduce((a,p) => a + (p.sops?p.sops.length:0), 0) },
    { icon: "\u{1F50D}", name: "检验规范", count: allProducts.reduce((a,p) => a + (p.inspection?p.inspection.length:0), 0) },
    { icon: "\u{1F504}", name: "变更记录", count: allChanges.length }
  ];
  return mods.map(m => `
    <div class="module-card" onclick="scrollToSection('${m.name}')">
      <div class="module-icon" style="font-size:22px;margin-bottom:6px">${m.icon}</div>
      <div class="module-name">${m.name}</div>
      <div class="module-count">${m.count} 项</div>
    </div>
  `).join("");
}

function renderProductRows(products) {
  if (!products.length) return `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted)">没有匹配的产品</td></tr>`;
  return products.map(p => `
    <tr onclick="showProduct('${p.id}')" style="cursor:pointer">
      <td><img class="prod-img" src="${p.image || ""}" alt="${p.name}" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2242%22 height=%2242%22><rect fill=%22%23e0f2f1%22 width=%2242%22 height=%2242%22/><text fill=%22%2300796B%22 x=%2221%22 y=%2226%22 font-size=%2216%22 text-anchor=%22middle%22 font-family=%22sans-serif%22>P</text></svg>'"></td>
      <td><strong>${p.name}</strong></td>
      <td style="font-family:var(--font-mono);font-size:12px">${p.code || "-"}</td>
      <td>${p.spec || "-"}</td>
      <td>${p.material || "-"}</td>
      <td><span class="soStatus"><span class="status-dot ${getStatusDot(p.status)}"></span>${p.status}</span></td>
      <td>${p.version || "V1.0"}</td>
    </tr>
  `).join("");
}

function getStatusDot(status) {
  if (status === "已发布") return "dot-green";
  if (status === "审核中" || status === "试制") return "dot-orange";
  if (status === "待发布") return "dot-blue";
  return "dot-gray";
}

function renderChangeTimeline() {
  if (!allChanges.length) return `<div style="padding:20px;text-align:center;color:var(--muted)">暂无变更记录</div>`;
  const sorted = [...allChanges].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.slice(0, 5).map(c => {
    const badgeClass = c.status === "已批准" ? "badge-green" : c.status === "草稿" ? "badge-gray" : "badge-orange";
    return `
      <div class="change-item" onclick="showECN('${c.id}')">
        <div class="change-title">${c.title} <span class="badge ${badgeClass}">${c.status}</span></div>
        <div class="change-meta">${c.id} · ${c.productName} · ${c.requester} · ${c.date}</div>
        <div class="change-desc">${c.description}</div>
      </div>`;
  }).join("");
}
// --- Product Detail ---
function showProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) { showToast("产品未找到", "error"); return; }
  currentView = "product";
  currentProductId = id;
  const el = document.getElementById("content");
  el.innerHTML = `
    <div class="back-bar" onclick="renderHome()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
      返回产品列表
    </div>
    <div class="prod-header">
      <img class="prod-header-img" src="${p.image || ""}" alt="${p.name}" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2288%22 height=%2288%22><rect fill=%22%23e0f2f1%22 width=%2288%22 height=%2288%22/><text fill=%22%2300796B%22 x=%2244%22 y=%2250%22 font-size=%2232%22 text-anchor=%22middle%22 font-family=%22sans-serif%22>P</text></svg>'">
      <div class="prod-header-info">
        <h2>${p.name}</h2>
        <div class="codes">
          <span>${p.code || "-"}</span>
          <span>${p.id}</span>
          <span>v${p.version || "1.0"}</span>
        </div>
        <p style="font-size:13px;color:var(--muted);margin-top:6px">${p.description || ""}</p>
      </div>
    </div>
    <div class="prod-meta-grid">
      <div class="prod-meta-item"><strong>规格</strong><span>${p.spec || "-"}</span></div>
      <div class="prod-meta-item"><strong>材质</strong><span>${p.material || "-"}</span></div>
      <div class="prod-meta-item"><strong>产品系列</strong><span>${p.series || "-"}</span></div>
      <div class="prod-meta-item"><strong>当前版本</strong><span>${p.version || "V1.0"}</span></div>
      <div class="prod-meta-item"><strong>发布状态</strong><span class="soStatus"><span class="status-dot ${getStatusDot(p.status)}"></span>${p.status}</span></div>
      <div class="prod-meta-item"><strong>责任人</strong><span>${p.owner || "-"}</span></div>
      <div class="prod-meta-item"><strong>更新日期</strong><span>${p.updatedAt || "-"}</span></div>
      <div class="prod-meta-item"><strong>产品编码</strong><span style="font-family:var(--font-mono)">${p.code || "-"}</span></div>
    </div>
    ${renderSections(p)}
  `;
}

// --- Section renderer with empty-state placeholders ---
function renderSections(p) {
  let html = "";
  // Drawings
  html += `<div class="section-head" id="图纸库"><h3>图纸文件</h3></div>`;
  if (p.drawings && p.drawings.length) {
    html += `<div class="draw-grid">${p.drawings.map(d => `
        <div class="draw-card">
          <span class="draw-icon">${getDrawIcon(d.type)}</span>
          <div class="name">${d.name}</div>
          <div class="meta">${d.file} · ${d.size || ""}</div>
          <div class="draw-actions">
            <button class="draw-btn primary" onclick="showToast('在线预览: ${d.file}', 'info')">在线预览</button>
            <button class="draw-btn" onclick="showToast('下载文件: ${d.file}', 'info')">下载文件</button>
          </div>
        </div>
      `).join("")}</div>`;
  } else {
    html += `<div class="empty-section"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>暂未上传图纸文件</p></div>`;
  }
  // BOM
  html += `<div class="section-head" id="BOM"><h3>BOM 清单</h3></div>`;
  if (p.bom && p.bom.length) {
    html += `<div class="panel"><table class="data-table">
        <thead><tr><th>层级</th><th>图号</th><th>名称</th><th>数量</th><th>单位</th><th>类型</th><th>来源</th></tr></thead>
        <tbody>${p.bom.map(b => `
          <tr><td>${"  ".repeat(b.level)}Lv.${b.level}</td><td style="font-family:var(--font-mono);font-size:12px">${b.part}</td><td>${b.name}</td><td>${b.qty}</td><td>${b.unit}</td><td>${b.type}</td><td>${b.source}</td></tr>
        `).join("")}</tbody></table></div>`;
  } else {
    html += `<div class="empty-section"><p>暂未建立 BOM 清单</p></div>`;
  }
  // Routings
  html += `<div class="section-head" id="工艺路线"><h3>工艺路线</h3></div>`;
  if (p.routings && p.routings.length) {
    html += `<div class="panel"><table class="data-table">
        <thead><tr><th>工序</th><th>名称</th><th>部门</th><th>设备</th><th>工时</th><th>关键要求</th></tr></thead>
        <tbody>${p.routings.map(r => `
          <tr><td>${r.seq}</td><td>${r.name}</td><td>${r.dept}</td><td>${r.machine}</td><td>${r.time}</td><td>${r.keyReq || ""}</td></tr>
        `).join("")}</tbody></table></div>`;
  } else {
    html += `<div class="empty-section"><p>暂未录入工艺路线</p></div>`;
  }
  // SOPs
  html += `<div class="section-head" id="SOP"><h3>SOP 文件</h3></div>`;
  if (p.sops && p.sops.length) {
    html += `<div class="panel"><table class="data-table">
        <thead><tr><th>编号</th><th>名称</th><th>分类</th></tr></thead>
        <tbody>${p.sops.map(s => `
          <tr><td style="font-family:var(--font-mono);font-size:12px">${s.code}</td><td>${s.name}</td><td>${s.category}</td></tr>
        `).join("")}</tbody></table></div>`;
  } else {
    html += `<div class="empty-section"><p>暂未上传 SOP 文件</p></div>`;
  }
  // Inspection
  html += `<div class="section-head" id="检验规范"><h3>检验规范</h3></div>`;
  if (p.inspection && p.inspection.length) {
    html += `<div class="panel"><table class="data-table">
        <thead><tr><th>检验项目</th><th>标准</th><th>方法</th><th>结果</th><th>实测值</th></tr></thead>
        <tbody>${p.inspection.map(i => {
          const dot = i.result === "pass" ? "dot-green" : i.result === "fail" ? "dot-orange" : "dot-gray";
          return `<tr><td>${i.name}</td><td>${i.spec}</td><td>${i.method}</td><td><span class="soStatus"><span class="status-dot ${dot}"></span>${i.result}</span></td><td>${i.measured}</td></tr>`;
        }).join("")}</tbody></table></div>`;
  } else {
    html += `<div class="empty-section"><p>暂未建立检验规范</p></div>`;
  }
  // Related ECN changes
  html += `<div class="section-head" id="变更记录"><h3>关联变更记录</h3></div>`;
  if (p.changes && p.changes.length) {
    const related = allChanges.filter(c => p.changes.includes(c.id));
    if (related.length) {
      html += `<div class="panel"><div class="timeline">${related.map(c => {
        const badgeClass = c.status === "已批准" ? "badge-green" : c.status === "草稿" ? "badge-gray" : "badge-orange";
        return `<div class="change-item" onclick="showECN('${c.id}')">
          <div class="change-title">${c.title} <span class="badge ${badgeClass}">${c.status}</span></div>
          <div class="change-meta">${c.id} · ${c.type} · ${c.requester} · ${c.date}</div>
          <div class="change-desc">${c.description}</div>
        </div>`;
      }).join("")}</div></div>`;
    } else {
      html += `<div class="empty-section"><p>暂无关联变更记录</p></div>`;
    }
  } else {
    html += `<div class="empty-section"><p>暂无关联变更记录</p></div>`;
  }
  return html;
}

function getDrawIcon(type) {
  const icons = { dwg: "\u{1F4D0}", pdf: "\u{1F4C4}", stp: "\u{1F517}", dxf: "\u{1F4D0}", svg: "\u{1F58C}" };
  return icons[type] || "\u{1F4C4}";
}
// --- ECN Modal ---
function showECN(id) {
  const c = allChanges.find(x => x.id === id);
  if (!c) { showToast("变更未找到", "error"); return; }
  const overlay = document.getElementById("ecnOverlay");
  const body = document.getElementById("ecnBody");
  overlay.style.display = "flex";
  const badgeClass = c.status === "已批准" ? "badge-green" : c.status === "草稿" ? "badge-gray" : "badge-orange";
  const affected = c.affectedDepartments || [];
  const allDepts = ["采购","生产","品质","销售","技术"];
  body.innerHTML = `
    <div class="ecn-header">
      <h2>${c.title} <span class="badge ${badgeClass}">${c.status}</span></h2>
      <div class="sub">${c.id} · ${c.productName} · ${c.type}</div>
    </div>
    <div class="ecn-meta-grid">
      <div class="ecn-meta-item"><strong>产品</strong><span>${c.productName}</span></div>
      <div class="ecn-meta-item"><strong>提出人</strong><span>${c.requester}</span></div>
      <div class="ecn-meta-item"><strong>责任部门</strong><span>${c.department}</span></div>
      <div class="ecn-meta-item"><strong>提出日期</strong><span>${c.date}</span></div>
      <div class="ecn-meta-item"><strong>生效日期</strong><span>${c.effectiveDate || "未设置"}</span></div>
      <div class="ecn-meta-item"><strong>审批状态</strong><span>${c.status}</span></div>
    </div>
    <div class="ecn-diff">
      <div class="diff-row"><span class="diff-label">修改内容</span><span>${c.description}</span></div>
      <div class="diff-row"><span class="diff-label">修改原因</span><span>${c.reason || ""}</span></div>
      <div class="diff-row"><div class="diff-label">修改前</div><div class="diff-before">${c.before || ""}</div></div>
      <div class="diff-row"><div class="diff-label">修改后</div><div class="diff-after">${c.after || ""}</div></div>
    </div>
    <div class="section-head" style="margin-bottom:6px"><h3>影响部门</h3></div>
    <div class="ecn-affect">
      ${allDepts.map(d => `<span class="tag ${affected.includes(d)?"active":""}">${d}</span>`).join("")}
    </div>
    ${c.relatedDocs && c.relatedDocs.length ? `
      <div class="section-head" style="margin-bottom:6px"><h3>关联文件</h3></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${c.relatedDocs.map(d => `<span class="tag active">${d}</span>`).join("")}
      </div>` : ""}
  `;
}

// --- Search ---
function bindSearch() {
  const input = document.getElementById("searchInput");
  input.addEventListener("input", (e) => {
    const q = e.target.value.trim();
    if (!q) {
      filteredProducts = [...allProducts];
      renderHome();
      return;
    }
    const lower = q.toLowerCase();
    filteredProducts = allProducts.filter(p => {
      const searchText = [
        p.name, p.code, p.spec, p.material, p.series, p.description,
        ...(p.category || []), p.id
      ].filter(Boolean).join(" ").toLowerCase();
      return searchText.includes(lower);
    });
    renderSearchResult(q);
  });
}

function renderSearchResult(q) {
  currentView = "search";
  const el = document.getElementById("content");
  const stats = calcStats(filteredProducts);
  el.innerHTML = `
    <div class="back-bar" onclick="clearSearch()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
      清除搜索
    </div>
    <div class="section-head"><h3>搜索结果: "${q}"</h3><p>${filteredProducts.length} 个产品</p></div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></div><div><div class="stat-num">${stats.products}</div><div class="stat-label">产品</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="stat-num">${stats.drawings}</div><div class="stat-label">图纸</div></div></div>
      <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="stat-num">${stats.sops}</div><div class="stat-label">SOP</div></div></div>
      <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg></div><div><div class="stat-num">${stats.changes}</div><div class="stat-label">变更</div></div></div>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead><tr><th>图片</th><th>产品名称</th><th>编码</th><th>规格</th><th>材质</th><th>状态</th><th>版本</th></tr></thead>
        <tbody>${renderProductRows(filteredProducts)}</tbody>
      </table>
    </div>
  `;
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  filteredProducts = [...allProducts];
  renderHome();
}

// --- Changes page ---
function renderChanges() {
  currentView = "changes";
  const el = document.getElementById("content");
  el.innerHTML = `
    <div class="back-bar" onclick="renderHome()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
      返回首页
    </div>
    <div class="section-head"><h3>全部变更记录 (${allChanges.length})</h3></div>
    <div class="panel"><div class="timeline">${allChanges.sort((a,b) => b.date.localeCompare(a.date)).map(c => {
      const badgeClass = c.status === "已批准" ? "badge-green" : c.status === "草稿" ? "badge-gray" : "badge-orange";
      return `<div class="change-item" onclick="showECN('${c.id}')">
        <div class="change-title">${c.title} <span class="badge ${badgeClass}">${c.status}</span></div>
        <div class="change-meta">${c.id} · ${c.productName} · ${c.type} · ${c.requester} · ${c.date}</div>
        <div class="change-desc">${c.description}</div>
      </div>`;
    }).join("")}</div></div>
    <div class="footer">FRANTA PDM v3 · 产品数据管理平台</div>
  `;
}

// --- Toast ---
function showToast(msg, type) {
  const container = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  if (type === "error") t.style.borderLeft = "3px solid #E65100";
  else t.style.borderLeft = "3px solid var(--accent)";
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2500);
}

// --- Modal close ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ecnClose").addEventListener("click", () => {
    document.getElementById("ecnOverlay").style.display = "none";
  });
  document.getElementById("ecnOverlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById("ecnOverlay").style.display = "none";
    }
  });
  init();
});

// --- Scroll helper ---
function scrollToSection(name) {
  const el = document.getElementById(name);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
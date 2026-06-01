/* ============================================================
   FRANTA PDM — Application Controller
   ============================================================ */
var PDM = {
  data: { products: [], changes: [], allData: [] },

  init: function() {
    Promise.all([
      fetch("data/products.json").then(function(r){return r.json()}),
      fetch("data/changes.json").then(function(r){return r.json()})
    ]).then(function(results){
      PDM.data.products = results[0];
      PDM.data.changes = results[1];
      // Build search index
      PDM.data.allData = [];
      PDM.data.products.forEach(function(p){
        PDM.data.allData.push({type:"product", id:p.id, title:p.name, subtitle:p.id+" | "+p.spec, desc:(p.pdm_description||p.description||""), image:p.image});
      });
      PDM.data.changes.forEach(function(c){
        PDM.data.allData.push({type:"change", id:c.id, title:c.title, subtitle:c.productName+" | "+c.date, desc:c.desc});
      });
      PDM.render();
      PDM.bindSearch();
    }).catch(function(err){
      document.getElementById("view-container").innerHTML =
        '<div class="error-state"><h3>\u52a0\u8f7d\u6570\u636e\u5931\u8d25</h3><p>\u8bf7\u786e\u4fdd\u901a\u8fc7 HTTP \u670d\u52a1\u5668\u8bbf\u95ee\u6b64\u9875\u9762\u3002</p><button class="btn" onclick="location.reload()">\u91cd\u8bd5</button></div>';
    });
  },

  bindSearch: function() {
    var input = document.getElementById("searchInput");
    if (!input) return;
    input.addEventListener("keydown", function(e){
      if (e.key === "Enter") {
        var q = input.value.trim();
        if (!q) { PDM.render(); return; }
        PDM.doSearch(q);
      }
    });
    // Ctrl+K / Cmd+K focus search
    document.addEventListener("keydown", function(e){
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        input.focus();
      }
    });
  },

  doSearch: function(q) {
    q = q.toLowerCase();
    var results = PDM.data.allData.filter(function(item){
      return (item.title && item.title.toLowerCase().indexOf(q) >= 0) ||
             (item.subtitle && item.subtitle.toLowerCase().indexOf(q) >= 0) ||
             (item.desc && item.desc.toLowerCase().indexOf(q) >= 0);
    });

    if (results.length === 0) {
      PDM.render();
      PDM.toast("\u641c\u7d22\u201c" + q + "\u201d\u672a\u627e\u5230\u7ed3\u679c");
      return;
    }

    // Render filtered product table
    var prodIds = {};
    results.forEach(function(r){if(r.type==="product")prodIds[r.id]=true;});

    var prods = PDM.data.products;
    var changes = PDM.data.changes;
    var filteredProds = prods.filter(function(p){return prodIds[p.id] || results.length <= 3;});
    // If no product matches, show all products but highlight changes
    if (Object.keys(prodIds).length === 0) filteredProds = prods;

    var totalDrawings = 0, totalSOPs = 0;
    filteredProds.forEach(function(p){totalDrawings += (p.drawings||[]).length; totalSOPs += (p.sops||[]).length;});
    var h = "";

    // Search result banner
    h += '<div style="background:#E0F2F1;border-radius:var(--radius);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">'+
      '<span style="font-size:14px;font-weight:600">\u641c\u7d22\u201c'+PDM.esc(q)+'\u201d \u5171 '+results.length+' \u6761\u7ed3\u679c</span>'+
      '<button class="hero-btn hero-btn-primary" style="padding:6px 16px;font-size:12px" onclick="document.getElementById(\'searchInput\').value=\'\';PDM.render()">\u6e05\u9664\u7ed3\u679c</button></div>';

    // Stats
    h += '<div class="stats-row"><div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div><div class="stat-num">'+filteredProds.length+'</div><div class="stat-label">\u4ea7\u54c1</div></div></div>'+
      '<div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="stat-num">'+totalDrawings+'</div><div class="stat-label">\u56fe\u7eb8</div></div></div>'+
      '<div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg></div><div><div class="stat-num">'+totalSOPs+'</div><div class="stat-label">SOP</div></div></div>'+
      '<div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2A10 10 0 1 1 20 4l-2 2.5"/><path d="M22 2v6h-6"/></svg></div><div><div class="stat-num">'+changes.length+'</div><div class="stat-label">\u53d8\u66f4</div></div></div></div>';

    // Module grid (shortened)
    h += '<div class="module-grid">';
    var mods=[
      {ic:"#E8F0FE",cc:"#1A73E8",nm:"\u4ea7\u54c1\u5e93",cnt:prods.length+"\u4e2a"},
      {ic:"#E0F2F1",cc:"var(--accent)",nm:"BOM",cnt:"\u591a\u5c42\u7ea7"},
      {ic:"#FFF3E0",cc:"#E65100",nm:"\u53d8\u66f4\u8bb0\u5f55",cnt:changes.length+"\u6761"}
    ];
    mods.forEach(function(m){h+='<div class="module-card" onclick="PDM.toast(\'\u5404\u6a21\u5757\u5c06\u5728\u540e\u7eed\u7248\u672c\u5b9e\u73b0\')"><div class="module-icon" style="background:'+m.ic+';color:'+m.cc+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v7m0 6v7M2 12h7m6 0h7"/></svg></div><div class="module-name">'+m.nm+'</div><div class="module-count">'+m.cnt+'</div></div>';});
    h += '</div>';

    // Products + Changes
    h += '<div class="content-grid">';
    h += '<div class="panel" id="section-products"><div class="panel-header"><h4>\u4ea7\u54c1\u5217\u8868</h4><span class="panel-tag">'+filteredProds.length+'\u4e2a</span></div><div class="table-wrap"><table><thead><tr><th></th><th>\u4ea7\u54c1\u540d\u79f0</th><th>\u7f16\u7801</th><th>\u89c4\u683c</th><th>\u6750\u8d28</th><th>\u72b6\u6001</th><th>\u7248\u672c</th></tr></thead><tbody>';
    filteredProds.forEach(function(p){
      var dc = "dot-gray";
      if(p.status==="\u5df2\u53d1\u5e03") dc = "dot-green";
      else if(p.status==="\u5f85\u8bc4\u5ba1"||p.status==="\u8bd5\u5236") dc = "dot-orange";
      h += '<tr onclick="PDM.showProduct(\''+p.id+'\')" style="cursor:pointer">'+
        '<td><img class="prod-img" src="'+p.image+'" alt="" onerror="this.style.display=\'none\'"></td>'+
        '<td><strong>'+PDM.esc(p.name)+'</strong></td>'+
        '<td style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">'+PDM.esc(p.id)+'</td>'+
        '<td style="font-size:12px;color:var(--muted)">'+PDM.esc(p.spec)+'</td>'+
        '<td>'+PDM.esc(p.material)+'</td>'+
        '<td><span class="soStatus"><span class="status-dot '+dc+'"></span>'+PDM.esc(p.status)+'</span></td>'+
        '<td>'+PDM.esc(p.version)+'</td></tr>';
    });
    h += '</tbody></table></div></div>';

    h += '<div class="panel" id="section-changes"><div class="panel-header"><h4>\u6700\u8fd1\u53d8\u66f4\u8bb0\u5f55</h4><span class="panel-tag">'+changes.length+'\u6761</span></div><div class="timeline">';
    changes.forEach(function(c){
      var bc = c.status==="\u5df2\u6279\u51c6"?"badge-green":"badge-orange";
      h += '<div class="change-item" onclick="PDM.showChange(\''+c.id+'\')"><div class="change-title">'+PDM.esc(c.title)+' <span class="badge '+bc+'">'+PDM.esc(c.status)+'</span></div><div class="change-meta">'+PDM.esc(c.id)+' \u00b7 '+PDM.esc(c.requester)+' \u00b7 '+PDM.esc(c.date)+'</div><div class="change-desc">'+PDM.esc(c.desc)+'</div></div>';
    });
    h += '</div></div></div>';

    h += '<div class="footer">\u00a9 2026 FRANTA PDM &middot; Static MVP v0.1.0 &middot; \u5236\u9020\u4e1a\u7248 GitHub</div>';
    document.getElementById("view-container").innerHTML = h;
  },

  render: function() {
    var prods = PDM.data.products;
    var changes = PDM.data.changes;
    var totalDrawings = 0, totalSOPs = 0;
    prods.forEach(function(p){totalDrawings += (p.drawings||[]).length; totalSOPs += (p.sops||[]).length;});
    var h = "";

    h += '<div class="hero"><h2>\u5de5\u7a0b\u6570\u636e\uff0c\u50cf\u4ee3\u7801\u4e00\u6837\u7ba1\u7406</h2><p>FRANTA PDM \u5c06\u5236\u9020\u4e1a\u7684\u4ea7\u54c1\u8d44\u6599\u3001\u56fe\u7eb8\u3001BOM\u3001\u5de5\u827a\u8def\u7ebf\u3001SOP\u3001\u68c0\u9a8c\u89c4\u8303\u548c\u53d8\u66f4\u8bb0\u5f55\u7edf\u4e00\u7ba1\u7406\u3002</p><div class="hero-actions"><button class="hero-btn hero-btn-primary" onclick="document.getElementById(\'section-products\').scrollIntoView({behavior:\'smooth\'})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>\u6d4f\u89c8\u4ea7\u54c1\u5e93</button><button class="hero-btn hero-btn-secondary" onclick="document.getElementById(\'section-changes\').scrollIntoView({behavior:\'smooth\'})">\u67e5\u770b\u53d8\u66f4\u8bb0\u5f55</button></div></div>';

    h += '<div class="stats-row"><div class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div><div class="stat-num">'+prods.length+'</div><div class="stat-label">\u4ea7\u54c1\u6570\u91cf</div></div></div><div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div class="stat-num">'+totalDrawings+'</div><div class="stat-label">\u56fe\u7eb8\u6570\u91cf</div></div></div><div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg></div><div><div class="stat-num">'+totalSOPs+'</div><div class="stat-label">SOP \u6570\u91cf</div></div></div><div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2A10 10 0 1 1 20 4l-2 2.5"/><path d="M22 2v6h-6"/></svg></div><div><div class="stat-num">'+changes.length+'</div><div class="stat-label">\u53d8\u66f4\u8bb0\u5f55</div></div></div></div>';

    h += '<div class="section-header"><div><h3>\u529f\u80fd\u6a21\u5757</h3><p>\u70b9\u51fb\u8fdb\u5165\u5404\u7ba1\u7406\u6a21\u5757</p></div></div><div class="module-grid">';
    var mods=[
      {ic:"#E8F0FE",cc:"#1A73E8",nm:"\u4ea7\u54c1\u5e93",cnt:prods.length+"\u4e2a\u4ea7\u54c1"},
      {ic:"#E8F0FE",cc:"#1A73E8",nm:"\u56fe\u7eb8\u5e93",cnt:totalDrawings+"\u4efd\u56fe\u7eb8"},
      {ic:"#E0F2F1",cc:"var(--accent)",nm:"BOM",cnt:"\u591a\u5c42\u7ea7\u7269\u6599"},
      {ic:"#FFF3E0",cc:"#E65100",nm:"\u5de5\u827a\u8def\u7ebf",cnt:prods.length+"\u6761"},
      {ic:"#F3E8FF",cc:"#7C3AED",nm:"SOP",cnt:totalSOPs+"\u4efd"},
      {ic:"#E0F2F1",cc:"var(--accent)",nm:"\u68c0\u9a8c\u89c4\u8303",cnt:"\u8d28\u91cf\u68c0\u6d4b"},
      {ic:"#FFF3E0",cc:"#E65100",nm:"\u53d8\u66f4\u8bb0\u5f55",cnt:changes.length+"\u6761"}
    ];
    mods.forEach(function(m){h+='<div class="module-card" onclick="PDM.toast(\''+m.nm+'\u6a21\u5757\u5c06\u5728\u540e\u7eed\u7248\u672c\u5b9e\u73b0\')"><div class="module-icon" style="background:'+m.ic+';color:'+m.cc+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v7m0 6v7M2 12h7m6 0h7"/></svg></div><div class="module-name">'+m.nm+'</div><div class="module-count">'+m.cnt+'</div></div>';});
    h += '</div>';

    h += '<div class="content-grid">';
    h += '<div class="panel" id="section-products"><div class="panel-header"><h4>\u4ea7\u54c1\u5217\u8868</h4><span class="panel-tag">'+prods.length+'\u4e2a\u4ea7\u54c1</span></div><div class="table-wrap"><table><thead><tr><th></th><th>\u4ea7\u54c1\u540d\u79f0</th><th>\u7f16\u7801</th><th>\u89c4\u683c</th><th>\u6750\u8d28</th><th>\u72b6\u6001</th><th>\u7248\u672c</th></tr></thead><tbody>';
    prods.forEach(function(p){
      var dc = "dot-gray";
      if(p.status==="\u5df2\u53d1\u5e03") dc = "dot-green";
      else if(p.status==="\u5f85\u8bc4\u5ba1"||p.status==="\u8bd5\u5236") dc = "dot-orange";
      h += '<tr onclick="PDM.showProduct(\''+p.id+'\')" style="cursor:pointer">'+
        '<td><img class="prod-img" src="'+p.image+'" alt="" onerror="this.style.display=\'none\'"></td>'+
        '<td><strong>'+PDM.esc(p.name)+'</strong></td>'+
        '<td style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">'+PDM.esc(p.id)+'</td>'+
        '<td style="font-size:12px;color:var(--muted)">'+PDM.esc(p.spec)+'</td>'+
        '<td>'+PDM.esc(p.material)+'</td>'+
        '<td><span class="soStatus"><span class="status-dot '+dc+'"></span>'+PDM.esc(p.status)+'</span></td>'+
        '<td>'+PDM.esc(p.version)+'</td></tr>';
    });
    h += '</tbody></table></div></div>';

    h += '<div class="panel" id="section-changes"><div class="panel-header"><h4>\u6700\u8fd1\u53d8\u66f4\u8bb0\u5f55</h4><span class="panel-tag">'+changes.length+'\u6761</span></div><div class="timeline">';
    changes.forEach(function(c){
      var bc = c.status==="\u5df2\u6279\u51c6"?"badge-green":"badge-orange";
      h += '<div class="change-item" onclick="PDM.showChange(\''+c.id+'\')"><div class="change-title">'+PDM.esc(c.title)+' <span class="badge '+bc+'">'+PDM.esc(c.status)+'</span></div><div class="change-meta">'+PDM.esc(c.id)+' \u00b7 '+PDM.esc(c.requester)+' \u00b7 '+PDM.esc(c.date)+'</div><div class="change-desc">'+PDM.esc(c.desc)+'</div></div>';
    });
    h += '</div></div></div>';

    h += '<div class="footer">\u00a9 2026 FRANTA PDM &middot; Static MVP v0.1.0 &middot; \u5236\u9020\u4e1a\u7248 GitHub</div>';
    document.getElementById("view-container").innerHTML = h;
  },

  esc: function(s) {
    if (s == null) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  },

  showProduct: function(id) {
    var p = null;
    PDM.data.products.forEach(function(x){if(x.id===id)p=x});
    if (!p) return;
    var h = '<button class="modal-close" onclick="PDM.closeModal()">\u2715</button>'+
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">'+
      '<img src="'+p.image+'" alt="" style="width:72px;height:72px;border-radius:var(--radius-sm);object-fit:cover;background:var(--soft)" onerror="this.style.display=\'none\'">'+
      '<div><h2>'+PDM.esc(p.name)+'</h2><div class="modal-sub">'+PDM.esc(p.id)+' \u00b7 '+PDM.esc(p.spec)+'</div></div></div>'+
      '<div class="meta-grid">'+
      '<div><strong>\u7f16\u7801</strong>'+PDM.esc(p.id)+'</div>'+
      '<div><strong>\u6750\u8d28</strong>'+PDM.esc(p.material)+'</div>'+
      '<div><strong>\u89c4\u683c</strong>'+PDM.esc(p.spec)+'</div>'+
      '<div><strong>\u7cfb\u5217</strong>'+PDM.esc(p.series)+'</div>'+
      '<div><strong>\u538b\u529b</strong>'+PDM.esc(p.pressure)+'</div>'+
      '<div><strong>\u8fde\u63a5</strong>'+PDM.esc(p.connection)+'</div>'+
      '<div><strong>\u72b6\u6001</strong>'+PDM.esc(p.status)+'</div>'+
      '<div><strong>\u7248\u672c</strong>'+PDM.esc(p.version)+'</div>'+
      '<div><strong>\u8d1f\u8d23\u4eba</strong>'+PDM.esc(p.owner)+'</div></div>'+
      '<div class="desc">'+PDM.esc(p.pdm_description||p.description)+'</div>';

    if (p.drawings && p.drawings.length) {
      h += '<div class="sec-title">\u5173\u8054\u56fe\u7eb8 ('+p.drawings.length+')</div>';
      p.drawings.forEach(function(d){h += '<div class="rel-row"><span>'+PDM.esc(d.name)+'</span><span style="color:var(--muted);font-size:12px;font-family:var(--font-mono)">'+PDM.esc(d.file)+' \u00b7 '+PDM.esc(d.version)+'</span></div>';});
    }
    if (p.bom && p.bom.length) {
      h += '<div class="sec-title">BOM ('+p.bom.length+'\u6761)</div>';
      p.bom.forEach(function(b){
        var sb = b.source==="\u81ea\u5236"?"badge-green":"badge-orange";
        h += '<div class="rel-row"><span>'+PDM.esc(b.part)+' \u2014 '+PDM.esc(b.name)+'</span><span><span class="badge '+sb+'" style="font-size:10px">'+PDM.esc(b.source)+'</span> \u00d7'+b.qty+' '+PDM.esc(b.unit)+'</span></div>';
      });
    }
    if (p.sops && p.sops.length) {
      h += '<div class="sec-title">\u5173\u8054 SOP ('+p.sops.length+')</div>';
      p.sops.forEach(function(s){h += '<div class="rel-row"><span class="badge badge-green" style="font-size:10px">'+PDM.esc(s.code)+'</span><span>'+PDM.esc(s.name)+'</span></div>';});
    }
    if (p.routings && p.routings.length) {
      h += '<div class="sec-title">\u5de5\u827a\u8def\u7ebf ('+p.routings.length+'\u9053\u5de5\u5e8f)</div>';
      p.routings.forEach(function(r){h += '<div class="rel-row"><span>#'+r.seq+' '+PDM.esc(r.name)+'</span><span style="color:var(--muted);font-size:12px">'+PDM.esc(r.dept)+'</span></div>';});
    }
    document.getElementById("modalContent").innerHTML = h;
    document.getElementById("modalOverlay").classList.add("show");
  },

  showChange: function(id) {
    var c = null;
    PDM.data.changes.forEach(function(x){if(x.id===id)c=x});
    if (!c) return;
    var bc = c.status==="\u5df2\u6279\u51c6"?"badge-green":"badge-orange";
    var h = '<button class="modal-close" onclick="PDM.closeModal()">\u2715</button><h2>'+PDM.esc(c.title)+'</h2><div class="modal-sub">'+PDM.esc(c.id)+' <span class="badge '+bc+'">'+PDM.esc(c.status)+'</span></div><div class="meta-grid"><div><strong>\u4ea7\u54c1</strong>'+PDM.esc(c.productName)+'</div><div><strong>\u7c7b\u578b</strong>'+PDM.esc(c.type)+'</div><div><strong>\u4f18\u5148\u7ea7</strong>'+PDM.esc(c.priority)+'</div><div><strong>\u7533\u8bf7\u4eba</strong>'+PDM.esc(c.requester)+'</div><div><strong>\u65e5\u671f</strong>'+PDM.esc(c.date)+'</div><div><strong>\u72b6\u6001</strong>'+PDM.esc(c.status)+'</div></div><div class="desc">'+PDM.esc(c.desc)+'</div>';
    document.getElementById("modalContent").innerHTML = h;
    document.getElementById("modalOverlay").classList.add("show");
  },

  closeModal: function() {
    document.getElementById("modalOverlay").classList.remove("show");
  },

  toast: function(msg) {
    var c = document.getElementById("toastContainer");
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function(){t.style.opacity="0";t.style.transform="translateY(8px)";t.style.transition="all .3s"}, 2200);
    setTimeout(function(){t.remove()}, 2800);
  }
};

document.addEventListener("DOMContentLoaded", function(){PDM.init();});

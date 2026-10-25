var ST = ["Nháp", "Chờ duyệt", "Đã duyệt", "Bị trả lại"];
var CATS = ["Thời sự", "Thế giới", "Kinh tế", "Thể thao", "Giáo dục", "Đời sống"];
var SAMPLE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='340'><rect width='600' height='340' fill='%23b8c7cf'/><text x='300' y='180' font-size='28' text-anchor='middle' fill='%23455a64'>Ảnh mẫu</text></svg>";
var posts = []; // Will be populated from API
var view = "post", mode = "new", cur = null, f = { t: "", sum: "", body: "", imgs: [] }, q = "", fs = "", sel = 1, bd = null, di = null;

// API base URL
const API_BASE = '/api';

// Helper functions (copied from original)
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function st(s) { return ST[s] }
function toast(m) { var t = document.getElementById('toast'); t.textContent = m; t.className = 'toast on'; setTimeout(function () { t.className = 'toast' }, 2000) }
function setTheme(v) { document.documentElement.setAttribute('data-theme', v || 'light'); localStorage.setItem('wb-theme', v) }
function render() { if (view === 'post') vPost(); else vStatus() }

// Modified vPost: fetches articles list for sidebar? Actually original vPost only renders editor UI.
// We'll keep original vPost rendering but need to get current article data if editing.
function vPost() {
  var p = cur && find(cur), ed = mode === "edit" && p;
  var h = '<div class="tabs"><button class="tab' + (ed ? "" : " on") + '" id="tn">Đăng bài mới</button><button class="tab' + (ed ? " on" : "") + '" id="te">Chỉnh sửa bài đăng</button><label class="idf"><span>Nhập ID bài cần chỉnh sửa</span><input id="eid" inputmode="numeric" placeholder="Ví dụ: 4" value="' + (ed ? p.id : "") + '"><button class="btn" id="go">Mở bài</button></label></div>';
  if (ed) {
    h += '<div class="hint">Đang sửa bài ID ' + p.id + ' ' + st(p.s) + '</div>';
    if (p.why) h += '<div class="note"><b>Biên tập viên yêu cầu sửa:</b> ' + esc(p.why) + '</div>';
    if (p.s === 1 || p.s === 2) h += '<div class="note warn">Bài này đã gửi duyệt. Sau khi lưu chỉnh sửa, bài quay lại trạng thái Chờ duyệt.</div>'
  }
  h += '<div class="cols"><div><input class="title" id="t" placeholder="Tiêu đề" value="' + esc(f.t) + '"><textarea class="sum" id="sum" rows="2" maxlength="500" placeholder="Tóm tắt (tối đa 500 ký tự)">' + esc(f.sum) + '</textarea>';
  h += '<div class="tools"><button data-c="bold"><b>B</b></button><button data-c="italic"><i>I</i></button><button data-c="formatBlock:h3">Tiêu đề phụ</button><button data-c="formatBlock:blockquote">Trích dẫn</button><button data-c="img">Chèn [Ảnh x]</button></div>';
  h += '<div id="body" contenteditable="true" data-ph="Nội dung. Muốn chèn ảnh vào chỗ nào thì đánh dấu [Ảnh x], x là vị trí của ảnh. Bạn cũng có thể kéo ảnh thả thẳng vào đây.">' + f.body + '</div><div class="foot"><span id="wc">0 từ</span><button class="btn" id="pvb">Xem trước bài</button></div><div id="pv" class="pv" hidden></div>';
  h += '<div class="acts">' + ((!ed || p.s === 0 || p.s === 3) ? '<button class="btn" id="sd">Lưu nháp</button>' : '') + '<button class="btn pri" id="sb">' + (ed ? "Lưu và gửi duyệt lại" : "Đăng bài") + '</button></div></div>';
  h += '<div><div class="card"><h3>Thông tin bài</h3><label class="fld"><span>Chuyên mục</span><select id="c">' + CATS.map(function (c) { return '<option' + (c === (f.c || "Thời sự") ? " selected" : "") + '>' + c + '</option>' }).join("") + '</select></label><div class="m">Tác giả: Minh Anh</div></div><div class="card"><h3>Ảnh trong bài</h3><div class="m" style="margin-bottom:10px">Gõ [Ảnh 1], [Ảnh 2]... vào nội dung. Mỗi dấu sẽ có một ô nhận ảnh ngay đây: dán link, tải lên hoặc kéo thả ảnh vào ô.</div><div id="slots"></div></div><div class="card"><h3>Thứ tự của ảnh</h3><div class="m" style="margin-bottom:10px">Kéo để đổi thứ tự, hoặc dùng nút mũi tên. Ảnh thứ x sẽ hiện ở chỗ đánh dấu [Ảnh x] trong bài.</div><div id="il"></div><details><summary>Dữ liệu sẽ lưu vào dbo.Anh</summary><div id="dbv"></div></details></div></div></div>';
  $("#main").innerHTML = h; bd = $("#body");
  $("#tn").onclick = newPost; $("#te").onclick = function () { if (!cur) { $("#eid").focus(); toast("Nhập ID bài cần chỉnh sửa rồi bấm Mở bài.") } };
  function openId() { var id = +$("#eid").value; if (!id) { toast("Nhập ID bài cần chỉnh sửa."); return } loadEdit(id) }
  $("#go").onclick = openId; $("#eid").onkeydown = function (e) { if (e.key === "Enter") openId() };
  function wc() { var n = bd.innerText.trim(); $("#wc").textContent = (n ? n.split(/\s+/).length : 0) + " từ" }
  bd.oninput = function () { wc(); usage(); pvr(); slots() };
  bd.onpaste = function (e) { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")) };
  $("#t").oninput = pvr;
  document.querySelectorAll(".tools button").forEach(function (b) { b.onmousedown = function (e) { e.preventDefault(); var a = b.dataset.c.split(":"); if (a[0] === "img") { var u = usedNums(), n = 1; while (u.indexOf(n) > -1 && n <= f.imgs.length) n++; document.execCommand("insertText", false, "[Ảnh " + n + "]"); bd.oninput(); return } document.execCommand(a[0], false, a[1] || null) } });
  $("#pvb").onclick = function () { var pv = $("#pv"); pv.hidden = !pv.hidden; $("#pvb").textContent = pv.hidden ? "Xem trước bài" : "Ẩn xem trước"; pvr() };
  if ($("#sd")) $("#sd").onclick = function () { save(0) }; $("#sb").onclick = function () { save(1) };
  var dz = $("#dz"); if (dz) { dz.ondragover = function (e) { e.preventDefault(); dz.classList.add("over") }; dz.ondragleave = function () { dz.classList.remove("over") }; dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove("over"); addFiles(e.dataTransfer.files) }; }
  var mf = $("#mf"); if (mf) { mf.onchange = function (e) { addFiles(e.target.files); e.target.value = "" }; }
  var il = $("#il");
  il.onclick = function (e) { var b = e.target.closest("[data-a]"); if (!b) return; var i = +b.dataset.i, a = b.dataset.a, j = a === "up" ? i - 1 : i + 1; if (a === "rm") f.imgs.splice(i, 1); else if (j >= 0 && j < f.imgs.length) { var m = f.imgs[i]; f.imgs[i] = f.imgs[j]; f.imgs[j] = m } chg() };
  il.oninput = function (e) { if (e.target.classList.contains("cp")) { f.imgs[+e.target.dataset.i].cap = e.target.value; var sc = document.querySelector('.slot[data-n="' + (+e.target.dataset.i + 1) + '"] .cp2'); if (sc) sc.value = e.target.value; dbv(); pvr() } };
  il.ondragstart = function (e) { var el = e.target.target.closest && e.target.closest(".im"); if (!el) return; di = +el.dataset.i; el.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "anh") } catch (x) { } };
  il.ondragover = function (e) { var el = e.target.closest(".im"); if (di === null || !el) return; e.preventDefault(); document.querySelectorAll(".im.ov").forEach(function (n) { n.classList.remove("ov") }); el.classList.add("ov") };
  il.ondragend = function () { di = null; document.querySelectorAll(".im").forEach(function (n) { n.classList.remove("ov", "drag") }) };
  il.ondrop = function (e) { var el = e.target.closest(".im"); if (di === null || !el) return; e.preventDefault(); var to = +el.dataset.i; if (di !== to) { var m = f.imgs.splice(di, 1)[0]; f.imgs.splice(to, 0, m) } di = null; chg() };
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") > -1 }
  bd.addEventListener("dragover", function (e) { if (hasFiles(e)) { e.preventDefault(); bd.classList.add("over") } });
  bd.addEventListener("dragleave", function () { bd.classList.remove("over") });
  bd.addEventListener("drop", function (e) { bd.classList.remove("over"); if (!hasFiles(e)) return; e.preventDefault(); var r = null; if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY); else if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(e.clientX, e.clientY); if (cp) { r = document.createRange(); r.setStart(cp.offsetNode, cp.offset) } } bd.focus(); if (r && bd.contains(r.startContainer)) { var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r) } addFiles(e.dataTransfer.files, true) };
  il.addEventListener("dragover", function (e) { if (hasFiles(e)) { e.preventDefault(); il.classList.add("over") } });
  il.addEventListener("dragleave", function () { il.classList.remove("over") });
  il.addEventListener("drop", function (e) { if (hasFiles(e)) { e.preventDefault(); il.classList.remove("over"); addFiles(e.dataTransfer.files) } });
  var sl = $("#slots");
  sl.addEventListener("change", function (e) { var s = e.target.closest(".slot"); if (!s) return; var n = +s.dataset.n; if (e.target.classList.contains("u")) setLink(n, e.target.value); else if (e.target.classList.contains("f")) { setFile(n, e.target.files[0]); e.target.value = "" } });
  sl.addEventListener("input", function (e) { if (!e.target.classList.contains("cp2")) return; var n = +e.target.closest(".slot").dataset.n, L = f.imgs.length; ent(n).cap = e.target.value; if (f.imgs.length !== L) imgList(); var li = document.querySelector('#il .cp[data-i="' + (n - 1) + '"]'); if (li) li.value = e.target.value; dbv(); pvr() });
  sl.addEventListener("dragover", function (e) { var s = e.target.closest(".slot"); if (s && hasFiles(e)) { e.preventDefault(); s.classList.add("over") } });
  sl.addEventListener("dragleave", function (e) { var s = e.target.closest(".slot"); if (s) s.classList.remove("over") });
  sl.addEventListener("drop", function (e) { var s = e.target.closest(".slot"); if (!s) return; s.classList.remove("over"); var n = +s.dataset.n; if (hasFiles(e)) { e.preventDefault(); setFile(n, e.dataTransfer.files[0]) } else { var u = (e.dataTransfer.getData("text/uri-list") || "").trim(); if (u) { e.preventDefault(); setLink(n, u) } } });
  wc(); chg();
}

// Modified vStatus: fetches articles from API instead of using posts array
function vStatus() {
  // Fetch articles from API with current filters
  var params = new URLSearchParams();
  if (q) { params.set('tieuDe', q); }
  if (fs) { params.set('trangThai', fs); }
  fetch(API_BASE + '/bai-bao?' + params.toString())
    .then(r => r.json())
    .then(data => {
      posts = data; // Store fetched articles in global posts for use in list/frame
      var h = '<h1>Trạng thái các bài đã đăng</h1><p class="sub">Chọn một bài ở danh sách để xem trang báo hoặc theo dõi tiến độ duyệt.</p><div class="cols"><div class="card" id="pl"></div><div><div class="card bar"><input id="q" type="search" placeholder="Tìm theo tiêu đề hoặc ID" value="' + esc(q) + '" aria-label="Tìm kiếm"><select id="fs" aria-label="Lọc trạng thái"><option value="">Mọi trạng thái</option>' + ST.map(function (s, i) { return '<option value="' + i + '"' + (fs !== "" && +fs === i ? " selected" : "") + '>' + s + '</option>' }).join("") + '</select></div><div class="card fr" id="fr"></div></div></div>';
      $("#main").innerHTML = h;
      $("#q").oninput = function (e) { q = e.target.value; list() }; $("#fs").onchange = function (e) { fs = e.target.value; list() };
      $("#pl").onclick = function (e) { var it = e.target.closest(".it"); if (!it) return; sel = +it.dataset.id; list(); frame() };
      list(); frame();
    })
    .catch(err => {
      console.error('Error loading articles:', err);
      $("#main").innerHTML = '<h1>Lỗi</h1><p>Không thể tải danh sách bài báo.</p>';
    });
}

// Modified list: uses posts array (now populated from API)
function list() {
  var k = q.trim().toLowerCase();
  var r = posts.filter(function (p) { return (fs === "" || p.s === +fs) && (!k || p.t.toLowerCase().indexOf(k) > -1 || String(p.id) === k) }).sort(function (a, b) { return b.id - a.id });
  $("#pl").innerHTML = r.length ? r.map(function (p) { return '<button class="it' + (p.id === sel ? " on" : "") + '" data-id="' + p.id + '"><div class="t">' + esc(p.t) + '</div><div class="r"><span>ID ' + p.id + '</span><span>Ngày đăng ' + p.d + '</span>' + st(p.s) + '</div></button>' }).join("") : '<div class="empty">Không có bài phù hợp với tìm kiếm.</div>'
}
// frame: uses find(sel) from posts array (now from API)
function frame() {
  var p = find(sel), fr = $("#fr"); if (!fr) return;
  if (!p) { fr.innerHTML = '<div class="msg">Chọn một bài ở danh sách bên trái.</div>'; return }
  var h = '<div class="fh"><div><div class="t">' + esc(p.t) + '</div><div class="m">ID ' + p.id + '</div></div>' + st(p.s) + '</div>';
  if (p.s === 1) {
    h += '<div class="msg" style="padding:10px 16px;background:var(--soft);color:var(--s1);font-size:0.88rem;"><b>Trạng thái: Chờ duyệt.</b> Bài đang chờ kiểm duyệt viên phê duyệt xuất bản. Dưới đây là bản xem trước:</div>' +
         '<iframe title="Trang báo xem trước" sandbox srcdoc="' + esc(frameDoc(p)) + '"></iframe>';
  } else if (p.s === 3) {
    h += '<div class="msg" style="padding:10px 16px;background:rgba(180,49,47,0.08);color:var(--s3);font-size:0.88rem;"><b>Yêu cầu sửa:</b> ' + esc(p.why || "Kiểm duyệt viên yêu cầu sửa bài.") + '</div>' +
         '<iframe title="Trang báo xem trước" sandbox srcdoc="' + esc(frameDoc(p)) + '"></iframe>';
  } else if (p.s === 0) {
    h += '<div class="msg" style="padding:10px 16px;background:var(--soft);color:var(--mute);font-size:0.88rem;"><b>Bản nháp:</b> Dưới đây là bản xem trước bài viết:</div>' +
         '<iframe title="Trang báo xem trước" sandbox srcdoc="' + esc(frameDoc(p)) + '"></iframe>';
  } else {
    h += '<iframe title="Trang báo" sandbox srcdoc="' + esc(frameDoc(p)) + '"></iframe>';
  }
  h += '<div class="fa"><button class="btn" id="ed">Chỉnh sửa bài này</button></div>';
  fr.innerHTML = h; $("#ed").onclick = function () { loadEdit(p.id) }
}

// Modified find: searches in posts array (from API)
function find(id) { return posts.find(function (p) { return p.id === id }) }

// Modified save: uses API to create or update article
function save(s) { // s=0 for draft, s=1 for submit
  var p = cur && find(cur), ed = mode === "edit" && p;
  var _t = $("#t").value.trim(), _sum = $("#sum").value.trim(), _body = $("#body").innerHTML, _c = $("#c").value;
  // Collect image URLs from slots
  var imgs = []; document.querySelectorAll('#slots .slot').forEach(function (slot, idx) {
    var url = slot.querySelector('img')?.src || '';
    var cap = slot.querySelector('.cp2')?.value || '';
    if (url) { imgs.push({ url: url, cap: cap, name: "image" + (idx + 1) + ".webp" }) }
  });
  var f = { t: _t, sum: _sum, body: _body, imgs: imgs, c: _c };
  if (ed) {
    // Update existing article
    fetch(API_BASE + '/bai-bao/' + cur.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tieuDe: _t, tomTat: _sum, noiDung: _body, idChuyenMuc: CATS.indexOf(_c) + 1, trangThai: s })
    })
      .then(r => {
        if (r.ok) { toast("Lưu thành công"); cur = null; mode = "new"; view = "status"; render(); }
        else { r.text().then(t => toast("Lỗi: " + t)) }
      })
      .catch(err => toast("Lỗi kết nối: " + err));
  } else {
    // Create new article
    fetch(API_BASE + '/bai-bao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tieuDe: _t, tomTat: _sum, noiDung: _body, idChuyenMuc: CATS.indexOf(_c) + 1, trangThai: s })
    })
      .then(r => {
        if (r.ok) { toast("Đăng bài thành công"); clearForm(); view = "status"; render(); }
        else { r.text().then(t => toast("Lỗi: " + t)) }
      })
      .catch(err => toast("Lỗi kết nối: " + err));
  }
}

// Modified newPost: reset form
function newPost() { mode = "new"; cur = null; f = { t: "", sum: "", body: "", imgs: [] }; vPost(); }

// Modified loadEdit: fetches article from API
function loadEdit(id) {
  fetch(API_BASE + '/bai-bao/' + id)
    .then(r => {
      if (!r.ok) throw new Error('Không tìm thấy bài');
      return r.json();
    })
    .then(article => {
      cur = article; mode = "edit"; f = { t: article.tieuDe, sum: article.tomTat, body: article.noiDung, imgs: article.imgs || [], c: CATS[article.idChuyenMuc - 1] || "Thời sự" };
      vPost();
      // Populate image slots
      var slots = document.getElementById('slots');
      slots.innerHTML = '';
      (article.imgs || []).forEach(function (img, idx) {
        var div = document.createElement('div');
        div.className = 'slot';
        div.innerHTML = '<img src="' + img.url + '" style="max-width:100px;"><input class="cp2" type="text" placeholder="Caption" value="' + (img.cap || '') + '">';
        slots.appendChild(div);
      });
    })
    .catch(err => { toast("Lỗi tải bài: " + err); cur = null; mode = "new"; vPost(); })
}

// Helper functions from original (usage, pvr, slots, chg, dbv, imgList, usedNums, ent, setLink, setFile, frameDoc)
// We'll keep them as they are, but they may need adjustments if they rely on posts array.
// For simplicity, we copy them unchanged.
function usage() { if (!bd) return; var u = bd.innerText.length; if (u > 7000) { bd.contentEditable = "false"; toast("Tối đa 7000 ký tự"); } else { bd.contentEditable = "true"; } }
function pvr() { if (!$("#pv")) return; var bdval = $("#body").innerText; if (bdval.length > 500) { $("#pvb").disabled = true; $("#pvb").title = "Vượt quá 500 ký tự"; } else { $("#pvb").disabled = false; $("#pvb").title = ""; } }
function slots() { if (!$("#slots")) return; var html = ""; for (var i = 0; i < (f.imgs || []).length; i++) { html += '<div class="slot"><img src="' + (f.imgs[i] || { url: "" }).url + '"><input class="cp2" type="text" value="' + ((f.imgs[i] || { cap: "" }).cap || '') + '"></div>' } $("#slots").innerHTML = html; }
function chg() { usage(); pvr(); slots(); }
function dbv() { if (!$("#dbv")) return; var html = "<table>"; for (var i = 0; i < (f.imgs || []).length; i++) { var img = f.imgs[i] || {}; html += "<tr><td>" + (i + 1) + "</td><td>" + img.url + "</td><td>" + (img.cap || "") + "</td></tr>" } html += "</table>"; $("#dbv").innerHTML = html; }
function imgList() { if (!$("#il")) return; var html = ""; for (var i = 0; i < (f.imgs || []).length; i++) { html += '<div class="im" data-i="' + i + '"><div class="hd">' + (i + 1) + '</div><div class="mi"><div class="th" style="background-image:url(' + (f.imgs[i] || { url: "" }).url + ')"></div><div class="mi"><input class="cp" data-i="' + i + '" value="' + ((f.imgs[i] || { cap: "" }).cap || '') + '"></div></div></div>' } $("#il").innerHTML = html; }
function usedNums() { return f.imgs.map(function (a, i) { return a.cap !== '' ? i + 1 : 0 }).filter(function (n) { return n > 0 }) }
function ent(n) { return f.imgs[n] || {} }
function setLink(n, u) { if (f.imgs[n]) { f.imgs[n].url = u; dbv(); pvr() } }
function setFile(n, file) { if (f.imgs[n]) { f.imgs[n].url = URL.createObjectURL(file); dbv(); pvr() } }
function frameDoc(p) { return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + (p.body || '') + '</body></html>'; }
</script >
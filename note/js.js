"use strict";
// 获取 DOM 元素
const newMemoBtn = document.getElementById("new_note");
const memoList = document.getElementById("note_list");
const memoTitle = document.getElementById("title");
const memoContent = document.getElementById("content");
const saveBtn = document.getElementById("save");
const catList = document.getElementById("folder_list");
const listTitle = document.getElementById("folder_name");
const edit = document.getElementById("edit");
const searchLbl = document.getElementById("search_lbl");
const allNote = document.getElementById("all_note");
const notsort = document.getElementById("not_sort");
const recycle = document.getElementById("recycle");
const cleanBin = document.getElementById("clean_bin");
const searchOpTitle = document.getElementById("search_op_title");
const searchOpFull = document.getElementById("search_op_full");
const txtSearch = document.getElementById("search");
const btnRestoreAll = document.getElementById("restore_all");
const searchField = document.getElementById("search_field");
const showSearch = document.getElementById("show_search");
const wrap = document.getElementById("wrap");

const UNCAT = "未分类";
const RECYCLE_CAT = "回收站";
const ALL_CAT = "全部笔记";

const RESERVED_CAT = [UNCAT, RECYCLE_CAT, ALL_CAT];

let catElem = allNote;
catElem.classList.add("sel");
let memoElem = null;
cleanBin.classList.add("hide");
btnRestoreAll.classList.add("hide");
searchField.classList.add("hide");

// MemoManager 类：负责处理备忘录数据的 CRUD 操作
class MemoManager {
    constructor(storageKey) {
        this.storageKey = storageKey;
        this.catKey = storageKey + "_cat";
        this.loadMemos();
        this.loadCats();
    }

    // 从 localStorage 加载备忘录数据
    loadMemos() {
        const memosJson = localStorage.getItem(this.storageKey);
        this.memos = memosJson ? JSON.parse(memosJson) : [];
    }

    loadCats() {
        const cat = localStorage.getItem(this.catKey);
        this.cat = cat ? JSON.parse(cat) : [];
    }

    // 将当前数据保存到 localStorage
    saveMemos() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.memos));
    }

    saveCats() { localStorage.setItem(this.catKey, JSON.stringify(this.cat)); }

    // 创建备忘录
    createMemo(title = "新建备忘录", content = "") {
        const newMemo = {
            id: Date.now(), // 唯一ID
            title,
            content,
            lastModified: new Date().toISOString(), // 创建时设置 lastModified
            cat: listTitle.textContent,
        };
        this.memos.push(newMemo);
        this.saveMemos();
        return newMemo;
    }

    createCat(name) {
        this.cat.push(name);
        this.saveCats();
        return name;
    }

    // 获取所有备忘录
    getAllMemos() {
        return this.memos.filter(i => i.cat !== RECYCLE_CAT);
    }

    getCats() { return this.cat; }

    // 根据ID获取备忘录
    getMemoById(id) {
        return this.memos.find(memo => memo.id === id);
    }

    getMemosByCat(cat) {
        let lst = this.memos.filter(i => i.cat == cat);
        return lst ? lst : [];
    }

    // 更新备忘录（按ID）
    updateMemo(id, updatedFields) {
        const memo = this.getMemoById(id);
        if (memo) {
            Object.assign(memo, updatedFields, { lastModified: new Date().toISOString() }); // 更新时只修改 lastModified
            this.saveMemos();
            return memo;
        }
        return null;
    }

    // 删除备忘录
    deleteMemo(id) {
        const index = this.memos.findIndex(memo => memo.id === id);
        if (index !== -1) {
            this.memos.splice(index, 1);
            this.saveMemos();
            return true;
        }
        return false;
    }

    delCat(cat) {
        let idx = this.cat.findIndex(i => i === cat);
        if (idx === -1) return false;
        let memos = this.getMemosByCat(cat);
        for (let i of memos) Object.assign(i, { cat: UNCAT });
        this.saveMemos();
        this.cat.splice(idx, 1);
        this.saveCats();
        return true;
    }

    renCat(cat, newcat) {
        let idx = this.cat.findIndex(i => i === cat);
        if (idx === -1) return false;
        let memos = this.getMemosByCat(cat);
        for (let i of memos) Object.assign(i, { cat: newcat });
        this.saveMemos();
        this.cat.splice(idx, 1);
        this.cat.push(newcat);
        this.saveCats();
        return true;
    }

    chgCat(memo_id, new_cat) {
        let m = this.getMemoById(memo_id);
        Object.assign(m, { cat: new_cat, old_cat: m.cat });
        this.saveMemos();
    }

    restoreMemo(memo_id) {
        let m = this.getMemoById(memo_id);
        if (this.cat.findIndex(i => i === m.old_cat) === -1) this.cat.push(m.old_cat);
        this.saveCats();
        Object.assign(m, { cat: m.old_cat });
        this.saveMemos();
    }
}

function showEdit() { edit.style.display = "block"; }

let dirty = false;
memoTitle.oninput = memoContent.oninput = function (ev) {
    dirty = true;
    if (memoElem) memoElem.classList.add("dirty");
};

function hideEdit() {
    if (!dirty || confirm("更改未保存，确定要关闭吗？")) {
        edit.style.display = "none";
        dirty = false;
        if (memoElem) {
            memoElem.classList.remove("sel");
            memoElem.classList.remove("dirty");
        }
    }
}

hideEdit();

// 实例化 MemoManager
const memoManager = new MemoManager("memoAppStorage");

// 当前编辑的备忘录ID
let currentMemoId = null;

function recycleMemo(id) {
    memoManager.chgCat(id, RECYCLE_CAT);
    renderMemoList();
    hideEdit();
}

function restoreMemo(id) {
    memoManager.restoreMemo(id);
    renderCatList();
    renderMemoList();
    hideEdit();
}

// 渲染备忘录列表
function renderMemoList() {
    memoList.innerHTML = ""; // 清空列表
    listTitle.innerText = catElem.firstChild.innerHTML || catElem.innerHTML;
    //searchLbl.firstChild.nodeValue = "搜索“" + listTitle.innerHTML + "”中的笔记：";
    let memos = catElem.id == "all_note" ?
        memoManager.getAllMemos() :
        memoManager.getMemosByCat(listTitle.innerText);
    memos.forEach(memo => {
        const li = document.createElement("li");
        if (catElem === recycle)
            li.innerHTML = `<span class="title">${memo.title || "（无标题）"}</span><span class="delete-btn" onclick="deleteMemo(${memo.id})">&#160;×&#160;</span><span class="restore-btn" onclick="restoreMemo(${memo.id})">&#160;↩&#160;</span>`;
        else
            li.innerHTML = `<span class="title">${memo.title || "（无标题）"}</span><span class="delete-btn" onclick="recycleMemo(${memo.id})">&#160;×&#160;</span>`;
        li.innerHTML += "<input type=\"hidden\" name=\"id\" value=\"" + memo.id + "\" />";
        li.addEventListener("mousedown", () => loadMemo(memo.id, li));
        memoList.appendChild(li);
        li.draggable = true;
        if (currentMemoId === memo.id) {
            memoElem = li;
            li.classList.add("sel");
        }
    });
    //hideEdit();
}

// 加载备忘录到编辑界面
function loadMemo(id, li) {
    const memo = memoManager.getMemoById(id);
    if (memo) {
        if (memoElem) memoElem.classList.remove("sel");
        (memoElem = li).classList.add("sel");
        showEdit();
        currentMemoId = id;
        memoTitle.value = memo.title;
        memoContent.value = memo.content;
    }
}

// 清空编辑界面
function clearEditor() {
    currentMemoId = null;
    memoTitle.value = "";
    memoContent.value = "";
}

// 保存备忘录（新增或更新）
function saveMemo() {
    dirty = false;
    if (memoElem) memoElem.classList.remove("dirty");

    const title = memoTitle.value.trim();
    const content = memoContent.value.trim();

    if (!title && !content) {
        alert("标题和内容不能为空！");
        return;
    }

    if (currentMemoId) {
        // 更新备忘录
        memoManager.updateMemo(currentMemoId, { title, content });
    } else {
        // 创建新备忘录
        currentMemoId = memoManager.createMemo(title, content).id;
    }
    renderCatList();
    renderMemoList();
}

// 删除备忘录
function deleteMemo(id) {
    if (!confirm("笔记删除后不可恢复，确定吗？")) return;
    memoManager.deleteMemo(id);
    renderMemoList();
    hideEdit();
}

function renCat(cat) {
    let n = null;
    while (true) {
        let ok = true;
        n = prompt("重命名分类\n原名：" + cat + "\n新名：", cat);
        if (n === null) return;
        if (!n.length) {
            alert("分类名称不能为空，请重新输入！");
            ok = false;
            continue;
        }
        if (n === cat) return;
        for (let i of memoManager.getCats())
            if (i !== cat && n === i) {
                alert("和现有的分类重名，请重新输入！");
                ok = false;
                break;
            }
        if (ok) break;
    }
    memoManager.renCat(cat, n);
    renderCatList();
}

function delCat(cat) {
    if (!confirm("将删除该分类，并将该分类下的所有笔记移动到未分类，确定吗？")) return;
    memoManager.delCat(cat);
    renderCatList();
    chgSel(notsort);
}

function chgSel(elem) {
    catElem.classList.remove("sel");
    (catElem = elem).classList.add("sel");
    if (elem === recycle) {
        newMemoBtn.classList.add("hide");
        cleanBin.classList.remove("hide");
        btnRestoreAll.classList.remove("hide");
    } else {
        newMemoBtn.classList.remove("hide");
        cleanBin.classList.add("hide");
        btnRestoreAll.classList.add("hide");
    }
    renderMemoList();
}

// 事件绑定
newMemoBtn.addEventListener("click", () => {
    clearEditor();
    currentMemoId = null; // 新建备忘录
    if (memoElem) memoElem.classList.remove("sel");
    if (catElem.id == "all_note")
        chgSel(document.getElementById("not_sort"));
    showEdit();
});

saveBtn.addEventListener("click", saveMemo);

function renderCatList() {
    while (catList.lastChild.id != "not_sort") catList.removeChild(catList.lastChild);
    let cat = memoManager.getCats();
    for (let i of cat) {
        let li = document.createElement("li");
        let n = memoManager.getMemosByCat(i).length;
        li.innerHTML = '<span class="title">' + i + '</span><span class="num">&#160;' + n + '&#160;</span><span class="delete-btn" onclick="delCat(\'' + i + '\')">&#160;×&#160;</span><span class="rename_cat" onclick="renCat(\'' + i + '\')">✏️</span>';
        catList.appendChild(li);
    }
    for (let i of catList.children) {
        i.addEventListener("click", function (event) { chgSel(i); hideEdit(); }, true);
        if (i != allNote) {
            i.ondragover = function (ev) { ev.preventDefault(); };
            i.ondrop = function (ev) {
                memoManager.chgCat(currentMemoId, i.firstChild.innerHTML || i.innerHTML);
                chgSel(i);
            };
        }
    }
}

// 页面初始化
renderCatList();
renderMemoList();
clearEditor();

document.getElementById("new_folder").onclick = function (event) {
    let s = null;
    while (true) {
        let ok = true;
        s = prompt("输入新的分类名称：");
        if (s === null) return;

        if (!s.length) {
            alert("分类名称不能为空，请重新输入！");
            ok = false;
            continue;
        }

        if (RESERVED_CAT.find(i => i === s)) {
            alert("与保留分类重名，请重新输入！");
            ok = false;
            continue;
        }

        for (let i of memoManager.getCats())
            if (s === i) {
                alert("和现有的分类重名，请重新输入！");
                ok = false;
                break;
            }

        if (ok) break;
    }
    memoManager.createCat(s);
    memoManager.saveCats();
    renderCatList();
};

document.getElementById("close_edit").onclick = hideEdit;

function search() {
    let key = txtSearch.value, items = memoList.childNodes;
    for (let i of items) {
        if (searchOpTitle.checked)
            if (key !== "" && !i.firstChild.innerText.includes(key)) {
                i.style.display = "none";
                hideEdit();
            } else i.style.display = "block";
        else {
            let m = memoManager.getMemoById(Number(i.querySelector("input").value));
            if (key !== "" && !i.firstChild.innerText.includes(key) && !m.content.includes(key)) {
                i.style.display = "none";
                hideEdit();
            } else i.style.display = "block";
        }
    }
};

txtSearch.oninput = searchOpFull.onclick = searchOpTitle.onclick = search;

cleanBin.onclick = function (ev) {
    if (!confirm("回收站清空后不可恢复，确定吗？")) return;
    let memos = memoManager.getMemosByCat(RECYCLE_CAT);
    for (let i of memos)
        memoManager.deleteMemo(i.id);
    renderMemoList();
};

btnRestoreAll.onclick = function (ev) {
    if (!confirm("确定要还原所有项目吗？")) return;
    let memos = memoManager.getMemosByCat(RECYCLE_CAT);
    for (let i of memos) memoManager.restoreMemo(i.id);
    renderCatList();
    renderMemoList();
};

function adjustMemoListHight() { memoList.style.maxHeight = `calc(100% - ${memoList.getBoundingClientRect().top}px)`; }
adjustMemoListHight();

showSearch.onclick = function (ev) {
    if (searchField.classList.contains("hide")) {
        searchField.classList.remove("hide");
        showSearch.classList.add("sel");
    } else {
        searchField.classList.add("hide");
        showSearch.classList.remove("sel");
    }
    adjustMemoListHight();
}

function chgWrap(ev) { memoContent.style.whiteSpace = wrap.checked ? "pre-wrap" : "nowrap"; }
chgWrap();

wrap.onclick = chgWrap;
/**
 * @param {HTMLInputElement} self 
 */
function search_box_change(self)
{
    search(self.value);
}

/**
 * 在表格中搜索关键字，如果找到，则应用突出显示类，否则，删除所有突出显示类。
 * @param {string} key 
 */
function search(key)
{
    let cells = document.querySelectorAll("td");
    let found = false;
    for (let i of cells) {
        if (key !== "" && i.innerText.includes(key)) {
            i.classList.add("highlight");
            if (!found) {
                found = true;
                scroll_to_cell(i);
            }
        } else {
            i.classList.remove("highlight");
        }
    }
    if (!found) {
        reset_scroll();
    }
}

/**
 * @param {HTMLTableCellElement} cell
 */
function scroll_to_cell(cell)
{
    let container = document.querySelector(".rank");
    let cell_rect = cell.getBoundingClientRect();
    let container_rect = container.getBoundingClientRect();
    let first_col_width = document.querySelector("th").getBoundingClientRect().width;
    container.scrollLeft += cell_rect.left - container_rect.left - first_col_width;
}

function reset_scroll()
{
    document.querySelector(".rank").scrollLeft = 0;
}
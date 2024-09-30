/**
 * @param {HTMLOptionElement} self 
 */
function daypicker_change(self)
{
    let fram = document.getElementsByClassName("schdfram")[0];
    fram.src = "schd_pages/" + self.value + ".html";
}
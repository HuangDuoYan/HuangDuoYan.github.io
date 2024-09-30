/**
 * @param {HTMLSelectElement} self 
 */
function sexpicker_change(self)
{
    let fram = document.getElementsByClassName("bracketfram")[0];
    fram.src = "bracket_pages/" + self.value + ".html";
}
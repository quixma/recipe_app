//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}
//---------ADD RECIPES-----------
function addIngredientRow() {
    const container = document.getElementById('ingredients-container');
    const newRow = document.createElement('div');
    newRow.classList.add('ingredients-row');
    newRow.innerHTML = `
      <input type="text" name="ingredient_name[]" placeholder="Ingredient Name">
          <input type="number" step="0.01" name="ingredient_amount[]" placeholder="Amount">
          <select name="ingredient_unit[]">
            <option value="">Unit</option>
            <option value="ml">Milliliters</option>
            <option value=""grams">Grams</option>
            <option value="tsp">Teaspoons</option>
            <option value="tbsp">Tablespoons</option>
            <option value="cup">Cups</option>
            <option value="oz">Ounces</option>
            <option value="lb">Pound</option>
          </select>
        `
    container.appendChild(newRow);
}

function addStepRow() {
    const container = document.getElementById('steps-container');
    const newRow = document.createElement('div');
    newRow.classList.add('steps-row');
    newRow.innerHTML = `
      <input type="text" name="step_description[]" placeholder="Step Description">
        `
    container.appendChild(newRow);
}

function deleteRow(containerId, rowId) {
    const container = document.getElementById(containerId); //parent element of all the ingredient rows
    const divElements = container.querySelectorAll(rowId); //divs in which ingredient rows live
    const rowAmount = divElements.length;
    const indextoDelete = rowAmount - 1;

    divElements[indextoDelete].remove();
}

//---------VIEW RECIPES-------------
const recipeTypeSelect = document.getElementById('recipe_types');
const nameTypeSelect = document.getElementById('recipe_names');
const adjust_recipe_val = document.getElementById('recipe_multiply');
const adjust_recipe_btn = document.getElementById('adjust_recipe');
recipeTypeSelect.addEventListener("change", GetRecipeNamesByType);
// wrapped, or the change event object arrives where the multiplier is expected
nameTypeSelect.addEventListener("change", () => GetRecipeDetailsByName());
adjust_recipe_btn.addEventListener("click", () => UpdateRecipeIngredientValues(adjust_recipe_val.value));

//restoring select drop downs on page reload
window.addEventListener("pageshow", (event) => {
    // a back/forward-cache restore brings the whole DOM back intact, names and
    // recipe included, so there is nothing inconsistent to clear up there
    if (event.persisted) return;

    recipeTypeSelect.selectedIndex = 0;
    nameTypeSelect.innerHTML = "<option value=''>Select Recipe</option>";
    adjust_recipe_val.selectedIndex = 0;
    document.getElementById('recipe_details').innerHTML = '';
});

async function GetRecipeNamesByType() {
    const type = recipeTypeSelect.value;
    const nameSelect = document.querySelector('.recipe_names');

    if (!type) return;
    nameSelect.innerHTML = "<option value=''>Select Recipe</option>";

    const response = await fetch('/api/getRecipeNamesByType', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type })
    });

    if (!response.ok) {
        console.log("Lookup failed" + ":", await response.text());
        alert("Lookup failed" + ". See console.");
        return null;
    }

    const data = await response.json();

    if (recipeTypeSelect.value !== type) return;

    data.forEach(function (item) {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        nameSelect.appendChild(option);
    });
}

// Text from the database goes into innerHTML, so escape it before it gets there.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

// Escape first, then turn any http(s) or www. address into a link.
function linkify(value) {
    return escapeHtml(value).replace(/\b(?:https?:\/\/|www\.)[^\s<]+/gi, url => {
        const trimmed = url.replace(/[.,!?)\]]+$/, '');   // leave trailing punctuation outside the link
        const tail = url.slice(trimmed.length);
        // a bare www. address needs a scheme or the browser reads it as a relative path
        const href = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${trimmed}</a>${tail}`;
    });
}

async function GetRecipeDetailsByName(value) {
    const name = nameTypeSelect.value;
    const type = recipeTypeSelect.value;

    if (!name || !type) return;

    const response = await fetch('/api/getRecipeDetailsByName', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_name: name, recipe_type: type })
    });

    if (!response.ok) {
        console.log("Lookup failed" + ":", await response.text());
        alert("Lookup failed" + ". See console.");
        return null;
    }

    const data = await response.json();

    if (nameTypeSelect.value !== name) return;

    // picking a different recipe starts it unscaled again
    if (value === undefined) adjust_recipe_val.selectedIndex = 0;

    UpdateRecipeDetails(data, value ?? 1);
}
function UpdateRecipeDetails(data, value){
    const details = document.getElementById('recipe_details');

    if (!data.recipe_name) {
        details.innerHTML = "<p>Recipe not found.</p>";
        return;
    }
    const multiplier = Number(value) > 0 ? Number(value) : 1; //no multiplyer? send a 1
    // so a scaled list can't be mistaken for the recipe as written
    const scaleNote = multiplier === 1 ? '' : ` <span>(&times;${formatAmount(multiplier)})</span>`;

    details.innerHTML = `
            <h3>${escapeHtml(data.recipe_name)}</h3>
            <p><strong>Type:</strong> ${escapeHtml(data.recipe_type)}</p>
            <h4>Ingredients:${scaleNote}</h4>
            <ul>
                ${data.ingredients.map(ingredient => `<li>${escapeHtml(scaleAmount(ingredient.ingredient_amount, multiplier))} ${escapeHtml(ingredient.ingredient_unit)} ${escapeHtml(ingredient.ingredient_name)}</li>`).join('')}
            </ul>
            <h4>Steps:</h4>
            <ol>
                ${data.steps.map(step => `<li>${escapeHtml(step.step_description)}</li>`).join('')}
            </ol>
            <p class="notes"><strong>Notes:</strong> <span>${linkify(data.notes)}</span></p>
            `;
    
}
function UpdateRecipeIngredientValues(value){
    const multiplier = Number(value);
    // the "Adjust Recipe Servings" placeholder option has an empty value, if that is selected, send one (does nothing)
    GetRecipeDetailsByName(multiplier > 0 ? multiplier : 1);
}

function scaleAmount(raw, multiplier) {
    const value = parseAmount(raw);
    if (value === null) return String(raw ?? '');   // if ingredient amount is text not a value like "to taste", leave it and return
    return formatAmount(value * multiplier); //ingredient multiplication + format, send back to display
}

// Amounts are free text: "2", "1.5", ".5", "1/2", "1 1/2", or something that is
// not a number at all ("to taste"). Returns null for anything unparseable.
function parseAmount(raw) {
    const text = String(raw ?? '').trim();

    let m = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);          // 1 1/2
    if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;

    m = text.match(/^(\d+)\/(\d+)$/);                       // 1/2
    if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;

    if (/^\d*\.?\d+$/.test(text)) return Number(text);      // 2, 1.5, .5

    return null;
}

// Two decimals at most, no trailing zeros
function formatAmount(n) {
    return String(Math.round(n * 100) / 100);
}


//------GROCERY LIST-------------
async function addGroceryItem() {
    const itemName = document.getElementById('grocery_item').value.trim();
    const itemCategory = document.getElementById('grocery_item_category').value;

    if (!itemName || !itemCategory) return;

    const response = await fetch('/api/addItemtoGroceryList', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: itemName, item_category: itemCategory })
    });

    if (!response.ok) {
        console.log("Insertion failed" + ":", await response.text());
        alert("Insertion failed" + ". See console.");
        return null;
    }
    
    updateGroceryList(itemName, itemCategory);
}

function updateGroceryList(itemName, itemCategory) {
    const itemNameInput = document.getElementById('grocery_item');
    const ul = document.getElementById(itemCategory);
    const li = document.createElement('li');
    
    li.className = "grocery-row";
    li.id = itemName;
    li.textContent = itemName;

    ul.appendChild(li);
    
    // Resets the dropdown to the very first item in the list
    itemNameInput.value = '';
    document.getElementById('grocery_item_category').selectedIndex = 0;

}

async function clearGroceryList() {
    const response = await fetch('/api/clearGroceryList', {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        console.log("Clearing failed" + ":", await response.text());
        alert("Clearing failed" + ". See console.");
        return null;
    }

    // Clear the grocery list in the UI
    document.querySelectorAll('.grocery-category ul').forEach(ul => ul.innerHTML = '');
    document.getElementById('grocery_item_category').selectedIndex = 0;
}

//event listener for click to strikethrough
document.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;

  // only act if the li lives inside one of our lists
  if (!li.closest('ul.grocery-class')) return;

  li.classList.toggle('remove');
  
  
});

async function removeGroceryItem() {
    let items = [];
    const list_items = document.querySelectorAll('.grocery-row');

    list_items.forEach(li => {
        if (li.classList.contains('remove')) { //add item to list to remove
            items.push(li.id); 
        }
    });
    
    if(!items) return; //if no items are marked then return

    //remove items from db
    const response = await fetch('/api/removeGroceryItem', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({item_names: items})
    });

    if (!response.ok) {
        console.log("Clearing failed" + ":", await response.text());
        alert("Clearing failed" + ". See console.");
        return null;
    }

    // Clear the items removed in UI
    const itemsToRemove = new Set(items); 

    list_items.forEach(li => {
    if (itemsToRemove.has(li.id)) {
        li.remove();                                // actually removes the <li> from the DOM
    }
    });
    
    //reset dropdown
    document.getElementById('grocery_item_category').selectedIndex = 0;
}
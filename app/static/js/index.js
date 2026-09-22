//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

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

const recipeTypeSelect = document.getElementById('recipe_types');
const nameTypeSelect = document.getElementById('recipe_names');
recipeTypeSelect.addEventListener("change", GetRecipeNamesByType);
nameTypeSelect.addEventListener("change", GetRecipeDetailsByName);

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

async function GetRecipeDetailsByName() {
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

    const details = document.getElementById('recipe_details');

    if (!data.recipe_name) {
        details.innerHTML = "<p>Recipe not found.</p>";
        return;
    }

    details.innerHTML = `
      <h3>${escapeHtml(data.recipe_name)}</h3>
      <p><strong>Type:</strong> ${escapeHtml(data.recipe_type)}</p>
      <h4>Ingredients:</h4>
      <ul>
        ${data.ingredients.map(ingredient => `<li>${escapeHtml(ingredient.ingredient_amount)} ${escapeHtml(ingredient.ingredient_unit)} ${escapeHtml(ingredient.ingredient_name)}</li>`).join('')}
      </ul>
      <h4>Steps:</h4>
      <ol>
        ${data.steps.map(step => `<li>${escapeHtml(step.step_description)}</li>`).join('')}
      </ol>
      <p class="notes"><strong>Notes:</strong> <span>${linkify(data.notes)}</span></p>
    `;
}

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
    
    li.textContent = itemName;
    ul.appendChild(li);
    itemNameInput.value = '';
    // Resets the dropdown to the very first item in the list
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
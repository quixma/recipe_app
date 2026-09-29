from app import app
from flask import render_template, redirect, url_for, jsonify, request, flash
import sqlite3
from config import Config

@app.route('/', methods = ["GET", "POST"])
def index():
    recipe_types = get_recipe_types()
    grocery_categories = GROCERY_CATEGORY_MAP.values()
    grocery_list = get_grocery_list()
    return render_template('index.html', recipe_types = recipe_types, grocery_categories = grocery_categories, grocery_list = grocery_list)

def get_db_connection():
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route('/recipe_upload', methods = ["POST"])
def recipe_upload():
    if request.method == "POST":
        date = request.form.get('date')
        recipe_name = request.form.get('recipe_name')
        recipe_type = request.form.get('recipe_type')
        ingredient_name = request.form.getlist('ingredient_name[]')
        ingredient_amount = request.form.getlist('ingredient_amount[]')
        ingredient_unit = request.form.getlist('ingredient_unit[]')
        steps = request.form.getlist('step_description[]')
        notes = request.form.get('notes')

        ingredient_list = []

        if not (len(ingredient_name) == len(ingredient_amount) == len(ingredient_unit)): #entry lengths must match or ingredients would be silently dropped
            flash('Ingredient fields did not match up. Recipe was not saved.')
            return redirect(url_for('index'))

        for x in range(len(ingredient_name)):
            ingredient_entry = {
                "ingredient_name": ingredient_name[x],
                "ingredient_amount": ingredient_amount[x],
                "ingredient_unit": ingredient_unit[x]
                }
            ingredient_entry = {key: None if value == "" else value for key, value in ingredient_entry.items()} # if empty value replace with null
            ingredient_list.append(ingredient_entry)

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('INSERT INTO recipes (date, recipe_name, recipe_type, notes) VALUES (?, ?, ?, ?)',
                       (date, recipe_name, recipe_type, notes))
        session_id = cursor.lastrowid
        for i in range(len(ingredient_list)):
            cursor.execute('INSERT INTO ingredients (session_id, ingredient_name, ingredient_amount, ingredient_unit) VALUES (?, ?, ?, ?)',
                           (session_id, ingredient_list[i]['ingredient_name'], ingredient_list[i]['ingredient_amount'], ingredient_list[i]['ingredient_unit']))
        for row in steps:
            cursor.execute('INSERT INTO steps (session_id, step_description) VALUES (?, ?)',
                           (session_id, row))
        conn.commit()
        conn.close()

    return redirect(url_for('index'))


def get_recipe_types():
    #get types and first recipe for default selection
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT DISTINCT recipe_type FROM recipes')
    recipe_types = [row['recipe_type'] for row in cursor.fetchall()]
    conn.close()
    return recipe_types


@app.route('/api/getRecipeNamesByType', methods = ["POST"])
def get_recipe_names_by_type():
    data = request.get_json()
    type = data.get('type')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT Id, recipe_name FROM recipes WHERE recipe_type = ? ORDER BY recipe_name', (type,))
    recipe_names = [{'id': row['Id'], 'recipe_name': row['recipe_name']} for row in cursor.fetchall()]
    conn.close()

    return jsonify(recipe_names)

@app.route('/api/getRecipeDetailsByName', methods = ["POST"])
def get_recipe_details():
    data = request.get_json()
    recipe_name = data.get('recipe_name')
    recipe_type = data.get('recipe_type')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM recipes WHERE recipe_name = ? AND recipe_type = ?',
                   (recipe_name, recipe_type))
    recipe_details = cursor.fetchone()

    if recipe_details:
        session_id = recipe_details['Id']
        cursor.execute('SELECT * FROM ingredients WHERE session_id = ?', (session_id,))
        ingredients = cursor.fetchall()

        cursor.execute('SELECT * FROM steps WHERE session_id = ?', (session_id,))
        steps = cursor.fetchall()

        recipe_data = {
            'id': session_id,
            'date': recipe_details['date'],
            'recipe_name': recipe_details['recipe_name'],
            'recipe_type': recipe_details['recipe_type'],
            'notes': recipe_details['notes'],
            'ingredients': [{'ingredient_name': row['ingredient_name'], 'ingredient_amount': row['ingredient_amount'], 'ingredient_unit': row['ingredient_unit']} for row in ingredients],
            'steps': [{'step_description': row['step_description']} for row in steps]
        }
    else:
        recipe_data = {}

    conn.close()
    return jsonify(recipe_data)

GROCERY_CATEGORY_MAP = {
    'Meat': 'Meat',
    'Vegetables': 'Vegetables',
    'Fruit': 'Fruit',
    'Dairy': 'Dairy',
    'Rice_Potato_Pasta': 'Rice/Potato/Pasta',
    'Frozen': 'Frozen',
    'Dessert': 'Dessert',
    'Snacks': 'Snacks',
    'Drinks': 'Drinks',
    'Sauce_Dressing': 'Sauce/Dressing',
    'Baking': 'Baking',
    'Cleaning_products': 'Cleaning Products',
    'Miscellaneous': 'Miscellaneous'
}

@app.route('/api/updateRecipe', methods = ["POST"])
def updateRecipe():
    data = request.get_json()
    recipe = {
        'id': data.get("id"),
        'date': data.get("date"),
        'recipe_name': data.get("recipe_name"),
        'recipe_type': data.get("recipe_type"),
        'notes': data.get("notes"),
        'ingredients': data.get("ingredients") or [],
        'steps': data.get("steps") or [],
    }

    try:
        session_id = int(recipe['id'])          # arrives as text from the hidden field
    except (TypeError, ValueError):
        return jsonify({'error': 'No recipe id was sent, so there is nothing to update.'}), 400

    # Browsing starts by picking a type, so a recipe saved without one could
    # never be found again.
    if not (recipe['recipe_type'] or '').strip():
        return jsonify({'error': 'A recipe type is required.'}), 400

    if not (recipe['recipe_name'] or '').strip():
        return jsonify({'error': 'A recipe name is required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('UPDATE recipes SET date = ?, recipe_name = ?, recipe_type = ?, notes = ? WHERE Id = ?',
                       (recipe['date'], recipe['recipe_name'], recipe['recipe_type'], recipe['notes'], session_id))

        if cursor.rowcount == 0:                # no such recipe, so there is nothing to write
            conn.rollback()
            return jsonify({'error': 'No recipe found with that id.'}), 404

        # Ingredient and step rows carry no id of their own, so they are replaced
        # wholesale rather than matched up one by one. That is also what lets a
        # row be added or removed in the modal.
        cursor.execute('DELETE FROM ingredients WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM steps WHERE session_id = ?', (session_id,))

        for row in recipe['ingredients']:
            ingredient_entry = {
                'ingredient_name': row.get('ingredient_name'),
                'ingredient_amount': row.get('ingredient_amount'),
                'ingredient_unit': row.get('ingredient_unit'),
            }
            ingredient_entry = {key: None if value == "" else value for key, value in ingredient_entry.items()} # if empty value replace with null

            if not any(ingredient_entry.values()):   # a row left blank is not an ingredient
                continue

            cursor.execute('INSERT INTO ingredients (session_id, ingredient_name, ingredient_amount, ingredient_unit) VALUES (?, ?, ?, ?)',
                           (session_id, ingredient_entry['ingredient_name'], ingredient_entry['ingredient_amount'], ingredient_entry['ingredient_unit']))

        for row in recipe['steps']:
            step_description = row.get('step_description')
            if not step_description:             # same for a step with nothing typed into it
                continue

            cursor.execute('INSERT INTO steps (session_id, step_description) VALUES (?, ?)',
                           (session_id, step_description))

        conn.commit()                            # commit first, then close
    except Exception:
        conn.rollback()                          # a half-written recipe is worse than an unchanged one
        raise
    finally:
        conn.close()

    return jsonify({'message': 'Recipe updated', 'id': session_id})

def get_grocery_list():
     conn = get_db_connection()
     cursor = conn.cursor()

     cursor.execute('SELECT grocery_item, grocery_category FROM grocery_list')
     grocery_list = cursor.fetchall()

     conn.close()
     return grocery_list

@app.route('/api/addItemtoGroceryList', methods = ["POST"])
def add_grocery_item():
    data = request.get_json()
    item_name = data.get('item_name')
    item_category = data.get('item_category')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('INSERT INTO grocery_list (grocery_item, grocery_category) VALUES (?, ?)',
                   (item_name, item_category))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Grocery item added successfully'})

@app.route('/api/clearGroceryList', methods = ["POST"])
def clear_grocery_list():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('DELETE FROM grocery_list')
    conn.commit()
    conn.close()

    return jsonify({'message': 'Grocery list cleared successfully'})

@app.route('/api/removeGroceryItem', methods = ["POST"])
def removeGroceryItems():
    data = request.get_json()
    item_names = data.get('item_names')

    conn = get_db_connection()
    cursor = conn.cursor()
    for item in item_names:
        cursor.execute("DELETE FROM grocery_list WHERE grocery_item = ?", (item,))
        conn.commit()

    conn.close()

    return jsonify({'message': 'Items removed successfully'})


from app import app
from flask import render_template, redirect, url_for, jsonify, request, flash
import sqlite3
from config import Config

@app.route('/', methods = ["GET", "POST"])
def index():
    recipe_types = get_recipe_types()
    return render_template('index.html', recipe_types = recipe_types)

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

    cursor.execute('SELECT DISTINCT recipe_name FROM recipes WHERE recipe_type = ?', (type,))
    recipe_names = [row['recipe_name'] for row in cursor.fetchall()]
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
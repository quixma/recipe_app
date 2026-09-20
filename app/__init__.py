from flask import Flask
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

#import files here
from app import routes
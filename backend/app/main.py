# main.py
from fastapi import FastAPI

app = FastAPI(title="My FastAPI App")

@app.get("/")
async def root():
    return {"message": "Hello, FastAPI!"}
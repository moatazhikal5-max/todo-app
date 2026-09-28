import os

from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient, ReturnDocument, UpdateOne

load_dotenv()

client = MongoClient(os.environ["MONGODB_URI"])
collection = client["todo_app"]["todos"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    completed: bool | None = None


class Todo(BaseModel):
    id: str
    title: str
    completed: bool = False


class TodoOrder(BaseModel):
    ids: list[str]


def to_todo(doc) -> Todo:
    return Todo(id=str(doc["_id"]), title=doc["title"], completed=doc["completed"])


def parse_id(todo_id: str) -> ObjectId:
    try:
        return ObjectId(todo_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Todo not found")


@app.get("/")
def root():
    return {"message": "Hello from FastAPI"}


@app.get("/todos")
def list_todos() -> list[Todo]:
    docs = collection.find().sort([("position", 1), ("_id", 1)])
    return [to_todo(doc) for doc in docs]


@app.post("/todos", status_code=201)
def create_todo(data: TodoCreate) -> Todo:
    last = collection.find_one(sort=[("position", -1)])
    next_position = last.get("position", -1) + 1 if last else 0
    doc = {"title": data.title, "completed": False, "position": next_position}
    collection.insert_one(doc)
    return to_todo(doc)


@app.put("/todos/order", status_code=204)
def reorder_todos(data: TodoOrder):
    operations = [
        UpdateOne({"_id": parse_id(todo_id)}, {"$set": {"position": index}})
        for index, todo_id in enumerate(data.ids)
    ]
    if operations:
        collection.bulk_write(operations)


@app.patch("/todos/{todo_id}")
def update_todo(todo_id: str, data: TodoUpdate) -> Todo:
    changes = data.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No fields to update")
    doc = collection.find_one_and_update(
        {"_id": parse_id(todo_id)},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return to_todo(doc)


@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: str):
    result = collection.delete_one({"_id": parse_id(todo_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Todo not found")
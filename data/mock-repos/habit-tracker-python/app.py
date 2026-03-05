from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Habit Tracker API")


class HabitInput(BaseModel):
    name: str
    streak: int = 0


habits = [
    {"id": 1, "name": "Walk 10 minutes", "streak": 3},
    {"id": 2, "name": "Read 5 pages", "streak": 7},
]


@app.get("/")
def hello():
    return {"message": "Hello from Habit Tracker API"}


@app.get("/habits")
def list_habits():
    return habits


@app.post("/habits", status_code=201)
def create_habit(payload: HabitInput):
    item = {
        "id": 1 if not habits else max(h["id"] for h in habits) + 1,
        "name": payload.name.strip(),
        "streak": payload.streak,
    }
    habits.append(item)
    return item


@app.put("/habits/{habit_id}")
def update_habit(habit_id: int, payload: HabitInput):
    for habit in habits:
        if habit["id"] == habit_id:
            habit["name"] = payload.name.strip()
            habit["streak"] = payload.streak
            return habit
    raise HTTPException(status_code=404, detail="habit not found")


@app.delete("/habits/{habit_id}", status_code=204)
def delete_habit(habit_id: int):
    for index, habit in enumerate(habits):
        if habit["id"] == habit_id:
            habits.pop(index)
            return None
    raise HTTPException(status_code=404, detail="habit not found")

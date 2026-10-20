from fastapi import FastAPI

app = FastAPI(title="Items API")


@app.get("/items/{item_id}")
def read_item(item_id: int) -> dict:
    return {"id": item_id, "name": "widget"}

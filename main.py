# main.py
from fastapi import FastAPI
from fastapi.responses import FileResponse

app = FastAPI()

@app.get("/")
def read_root():
    file_path = "./KG/data/graph/C001_graph.json"
    
    # media_type을 지정해주면 브라우저가 JSON 파일임을 정확히 인식합니다.
    return FileResponse(file_path, media_type="application/json")
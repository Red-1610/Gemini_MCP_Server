import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from mcp import ClientSession
from mcp.client.sse import sse_client

app = FastAPI(title="MCP Engine")

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8000")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
client: genai.Client | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

class PromptRequest(BaseModel):
    prompt: str

@app.post("/chat")
async def chat(req: PromptRequest):
    global client

    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

    if client is None:
        client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        async with sse_client(MCP_SERVER_URL) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                tools_result = await session.list_tools()
                function_declarations = [
                    types.FunctionDeclaration(
                        name=mcp_tool.name,
                        description=mcp_tool.description,
                        parameters_json_schema=mcp_tool.input_schema,
                    )
                    for mcp_tool in tools_result.tools
                ]

                gemini_response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=req.prompt,
                    config=types.GenerateContentConfig(
                        tools=[types.Tool(function_declarations=function_declarations)]
                    ),
                )

                parts = gemini_response.candidates[0].content.parts
                for part in parts:
                    if part.function_call is None:
                        continue

                    call_name = part.function_call.name
                    call_args = dict(part.function_call.args or {})
                    tool_result = await session.call_tool(call_name, arguments=call_args)
                    result_output = [
                        item.text for item in tool_result.content if hasattr(item, "text")
                    ]

                    final_response = client.models.generate_content(
                        model=GEMINI_MODEL,
                        contents=[
                            req.prompt,
                            gemini_response.candidates[0].content,
                            types.Part.from_function_response(
                                name=call_name,
                                response={"result": result_output},
                            ),
                        ],
                    )
                    return {"reply": final_response.text, "tool": call_name}

                return {"reply": gemini_response.text, "tool": None}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
	
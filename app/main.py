from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import asyncio
from app.database import save_message, get_conversation, get_all_users
from app.config import HOST, PORT

# Paths
BASE_DIR = Path(__file__).parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Safe Place - Multi-User Chat")

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# HTML Routes
@app.get("/")
@app.get("/login")
async def login_page():
    return FileResponse(TEMPLATES_DIR / "login.html")


@app.get("/chat")
async def chat_page():
    return FileResponse(TEMPLATES_DIR / "chat.html")


# WebSocket state - stores all connected users
# {user_id: {"websocket": ws, "username": username}}
connected_users = {}


async def broadcast_user_list():
    """Send updated user list to all connected clients"""
    users_list = [
        {"id": uid, "username": info["username"], "online": True}
        for uid, info in connected_users.items()
    ]
    
    for uid, info in connected_users.items():
        try:
            await info["websocket"].send_json({
                "type": "users_list",
                "users": [u for u in users_list if u["id"] != uid]  # Don't include self
            })
        except:
            pass


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_id = None
    username = None
    
    # Wait for auth message
    try:
        auth_data = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        
        if auth_data.get("type") != "auth":
            await websocket.send_json({"type": "error", "message": "Se requiere autenticación"})
            await websocket.close()
            return
        
        username = auth_data.get("username")
        user_id = auth_data.get("user_id")
        
        if not username or not user_id:
            await websocket.send_json({"type": "error", "message": "Usuario inválido"})
            await websocket.close()
            return
            
    except asyncio.TimeoutError:
        await websocket.send_json({"type": "error", "message": "Timeout"})
        await websocket.close()
        return
    except Exception as e:
        print(f"Auth error: {e}")
        await websocket.close()
        return

    # Register user
    connected_users[user_id] = {"websocket": websocket, "username": username}
    print(f"[WS] {username} conectado. Total: {len(connected_users)}")

    # Send connection confirmation
    await websocket.send_json({
        "type": "connected",
        "user_id": user_id,
        "username": username
    })

    # Send list of all registered users (online and offline)
    all_users = await get_all_users()
    users_with_status = []
    for u in all_users:
        if u["id"] != user_id:  # Don't include self
            users_with_status.append({
                "id": u["id"],
                "username": u["username"],
                "online": u["id"] in connected_users
            })
    
    await websocket.send_json({
        "type": "users_list",
        "users": users_with_status
    })

    # Notify others that this user is online
    for uid, info in connected_users.items():
        if uid != user_id:
            try:
                await info["websocket"].send_json({
                    "type": "user_online",
                    "user_id": user_id,
                    "username": username
                })
            except:
                pass

    # Message loop
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "text")
            
            # Handle request for conversation history
            if msg_type == "get_history":
                other_user_id = data.get("with_user_id")
                if other_user_id:
                    messages = await get_conversation(user_id, other_user_id)
                    await websocket.send_json({
                        "type": "history",
                        "with_user_id": other_user_id,
                        "messages": messages
                    })
                continue
            
            # Handle regular message
            receiver_id = data.get("receiver_id")
            content = data.get("content", "")
            file_url = data.get("file_url")
            
            if not receiver_id:
                continue
            
            # Save message
            saved = await save_message(
                sender_id=user_id,
                sender_username=username,
                receiver_id=receiver_id,
                content=content,
                message_type=msg_type,
                file_url=file_url
            )

            # Send to receiver if online
            if receiver_id in connected_users:
                try:
                    await connected_users[receiver_id]["websocket"].send_json({
                        "type": "message",
                        "sender_id": user_id,
                        "sender_username": username,
                        "receiver_id": receiver_id,
                        "content": content,
                        "message_type": msg_type,
                        "file_url": file_url,
                        "created_at": saved.get("created_at") if saved else None
                    })
                except:
                    pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")
    finally:
        if user_id in connected_users:
            del connected_users[user_id]
            print(f"[WS] {username} desconectado. Total: {len(connected_users)}")
            
            # Notify others that user went offline
            for uid, info in connected_users.items():
                try:
                    await info["websocket"].send_json({
                        "type": "user_offline",
                        "user_id": user_id,
                        "username": username
                    })
                except:
                    pass


def start():
    """Entry point for the application"""
    import uvicorn
    print(f"Servidor en http://localhost:{PORT}")
    print(f"Abre http://localhost:{PORT}/login")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)


if __name__ == "__main__":
    start()

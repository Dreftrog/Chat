import httpx
from app.config import SUPABASE_URL, SUPABASE_KEY

# Headers for Supabase API
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}


async def save_message(sender_id: str, sender_username: str, receiver_id: str, content: str, message_type: str = "text", file_url: str = None):
    """Save a message to the database"""
    data = {
        "sender_id": sender_id,
        "sender_username": sender_username,
        "receiver_id": receiver_id,
        "content": content,
        "message_type": message_type,
        "file_url": file_url
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/messages",
            headers=headers,
            json=data
        )
        if response.status_code == 201:
            result = response.json()
            return result[0] if result else data
        else:
            print(f"Error saving message: {response.text}")
            return data


async def get_conversation(user1_id: str, user2_id: str, limit: int = 50):
    """Get messages between two specific users"""
    async with httpx.AsyncClient() as client:
        # Get messages where (sender=user1 AND receiver=user2) OR (sender=user2 AND receiver=user1)
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/messages",
            headers=headers,
            params={
                "select": "*",
                "or": f"(and(sender_id.eq.{user1_id},receiver_id.eq.{user2_id}),and(sender_id.eq.{user2_id},receiver_id.eq.{user1_id}))",
                "order": "created_at.asc",
                "limit": limit
            }
        )
        if response.status_code == 200:
            return response.json()
        return []


async def get_all_users():
    """Get all registered users"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=headers,
            params={
                "select": "id,username"
            }
        )
        if response.status_code == 200:
            return response.json()
        return []

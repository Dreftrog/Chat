# Safe Place Chat

Chat privado 1 a 1 en tiempo real con FastAPI y Supabase.

## Características

- ✅ Autenticación por username
- ✅ Múltiples usuarios con chat privado
- ✅ Mensajes, imágenes, archivos y notas de voz
- ✅ Historial persistente
- ✅ Notificaciones de sonido
- ✅ Sidebar colapsable

## Estructura

```
Chat/
├── app/                    # Backend Python
│   ├── config.py
│   ├── database.py
│   └── main.py
├── static/                 # Frontend
│   ├── css/styles.css
│   └── js/
├── templates/              # HTML
│   ├── login.html
│   └── chat.html
├── requirements.txt
└── Procfile
```

## Instalación Local

```bash
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
python run.py
```

## Variables de Entorno

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Deploy en Render

1. Conecta con GitHub
2. Create New > Web Service
3. Selecciona el repositorio
4. Environment: Python 3
5. Build Command: `pip install -r requirements.txt`
6. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
7. Añadir variables de entorno (SUPABASE_URL, SUPABASE_KEY)

"""Entry point.

Dev:        python run.py
Production: gunicorn -w 4 -b 0.0.0.0:8000 run:app
"""

import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Mặc định port 8000: trên macOS port 5000 thường bị AirPlay Receiver chiếm
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))

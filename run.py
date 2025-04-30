# run.py
import os
from dotenv import load_dotenv
from app_factory import create_app

load_dotenv()

# -----------------------------------------------------------------------------
# APPLICATION ENTRY POINT
# -----------------------------------------------------------------------------

app = create_app()

if __name__ == '__main__':
    app.run(
        debug=os.environ.get('FLASK_ENV') != 'production', 
        host='0.0.0.0', 
        port=int(os.environ.get('PORT', 5000))
    )

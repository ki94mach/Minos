# Standard library imports
import os

# Third-party imports
from dotenv import load_dotenv

# Local application imports
from app_factory import create_app

# Load environment variables from .env file
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

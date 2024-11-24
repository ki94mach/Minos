import transaction
import logging
def commit():
    try:
        transaction.commit()
        logging.info("Transaction committed successfully.")
    except Exception as e:
        transaction.abort()
        logging.error(f"Failed to commit transaction: {str(e)}")
        raise RuntimeError(f"Failed to commit transaction: {str(e)}")
    
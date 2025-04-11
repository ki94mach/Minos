import logging
from ..tables import Drug


class DrugDriver:
    @staticmethod
    def insert(drug: Drug):
        try:
            drug.save()
            logging.info(f"Inserted Drug with id: {drug.id}")
            return drug.id
        except Exception as e:
            logging.error(f"Error inserting Drug: {e}")
            raise

    @staticmethod
    def find(**query):
        return Drug.objects(**query)

    @staticmethod
    def update(drug: Drug):
        try:
            drug.save()
            logging.info(f"Updated Drug with id: {drug.id}")
        except Exception as e:
            logging.error(f"Error updating Drug: {e}")
            raise

    @staticmethod
    def delete(drug_id):
        result = Drug.objects(id=drug_id).delete()
        if result:
            logging.info(f"Deleted Drug with id: {drug_id}")
        else:
            logging.warning(f"Drug with id: {drug_id} not found.")

    @staticmethod
    def set_data(drug_id, **data):
        try:
            drug = Drug.objects(id=drug_id).first()
            if not drug:
                logging.warning(f"Drug with id: {drug_id} not found.")
                return None
            
            for key, value in data.items():
                setattr(drug, key, value)
            
            drug.save()
            logging.info(f"Updated Drug data with id: {drug_id}")
            return drug
        except Exception as e:
            logging.error(f"Error updating Drug data: {e}")
            raise

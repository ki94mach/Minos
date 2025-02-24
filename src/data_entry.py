# data_entry.py
from pkg.med_core import (
    Characteristic,
    Drug,
    Treatment,
    MedicationRegimen,
    AlternativeTreatments,
    Patient,
    FollowUp
)
import traceback

def main():
    try:
        # Create Characteristics
        lung_cancer = Characteristic.get_or_create(type="Primary Indication", name="Lung Cancer")
        nsclc = Characteristic.get_or_create(type="Type", name="NSCLC")
        keras = Characteristic.get_or_create(type="Biomarker", name="KRAS G12C")
        pdl1 = Characteristic.get_or_create(type="Biomarker", name="PDL1 < 1%")
        ps_2 = Characteristic.get_or_create(type="Performance", name="Status 2")

        # Create Drugs
        carboplatin = Drug.get_or_create(name="Carboplatin", strength="450 mg")
        gemcitabine = Drug.get_or_create(name="Gemcitabine", strength="1 g")
        paclitaxel = Drug.get_or_create(name="Paclitaxel", strength="100 mg")
        pembrolizumab = Drug.get_or_create(name="Pembrolizumab", strength="200 mg")

        # Create Medical Treatments
        regimen_1 = MedicationRegimen.get_or_create(name="Carboplatin with Gemcitabine")
        regimen_1.add_drug(carboplatin, annual_patient_con=13)
        regimen_1.add_drug(gemcitabine, annual_patient_con=13)

        regimen_2 = MedicationRegimen.get_or_create(name="Carboplatin with Paclitaxel")
        regimen_2.add_drug(carboplatin, annual_patient_con=15)
        regimen_2.add_drug(paclitaxel, annual_patient_con=20)

        # Create Alternative Treatments
        bone_target = AlternativeTreatments.get_or_create(alternatives=[regimen_1, regimen_2])
        
        # Create Additional Medical Treatment
        treatment_c = MedicationRegimen.get_or_create(name="Pembrolizumab")
        treatment_c.add_drug(pembrolizumab, annual_patient_con=10)

        # Create Population and Patient
        population = Characteristic.get_or_create(type="Population", name="Iran")
        patient_lc = Patient.get_or_create(size=90000000, chars=[(population, 90000000, 1)])
        patient_lc.add_characteristic(lung_cancer, rate=0.0001)
        patient_lc.add_characteristic(nsclc, rate=0.85)
        
        # Additional Characteristics
        metastatic = Characteristic.get_or_create(type="Metastasis", name="Metastatic")
        bone_metastatic = Characteristic.get_or_create(type="Metastasis", name="Bone Metastasis")
        patient_lc.add_characteristic(metastatic, rate=0.45)
        patient_lc.add_characteristic(bone_metastatic, rate=0.343)
        
        # Create More Drugs and Treatments
        denosumab = Drug.get_or_create(name="Denosumab", strength="120 mg")
        denosumab_reg = MedicationRegimen.get_or_create(name="Denosumab Treatment")
        denosumab_reg.add_drug(denosumab, annual_patient_con=13)
        
        zoledronic_acid = Drug.get_or_create(name="Zoledronic Acid", strength="4 mg")
        zoledronic_acid_reg = MedicationRegimen.get_or_create(name="Zoledronic Acid Treatment")
        zoledronic_acid_reg.add_drug(zoledronic_acid, annual_patient_con=13)
        
        # Create Alternative Treatments for Bone Target
        bone_target = AlternativeTreatments.get_or_create(alternatives=[denosumab_reg, zoledronic_acid_reg])
        patient_lc.add_treatment(bone_target, rate=1.0)
        
        # IMPORTANT: Save the patient to update the database with the new treatments.
        patient_lc.save()
        
        # Create Follow-Up
        bone_treated_fu = FollowUp.get_or_create(patient=patient_lc, overall_survival=0.43)
        bone_treated_fu.add_to_patient()
        
        # (Other operations on branches, mutations, etc.)
        
    except Exception as e:
        print(f"An error occurred: {e}")
        traceback.print_exc()
        raise

if __name__ == "__main__":
    main()

from pkg.med_core import *
from pkg.ZODB_manager import RegistryManager
import traceback
from pkg.utils import commit

def main():
    with RegistryManager() as rm:
        try:
            # Create Characteristics
            lung_cancer = Characteristic('Primary Indication', 'Lung Cancer')
            nsclc = Characteristic('Type', 'NSCLC')
            keras = Characteristic('Biomarker', 'KRAS G12C')
            pdl1 = Characteristic('Biomarker', 'PDL1 < 1%')
            ps_2 = Characteristic('Performance', 'Status 2')
            

            # Create Drugs
            carboplatin = Drug('Carboplatin', '450 mg')
            gemcitabine = Drug('Gemcitabine', '1 g')
            paclitaxel = Drug('Paclitaxel', '100 mg')
            pembrolizumab = Drug('Pembrolizumab', '200 mg')
            commit(*Characteristic.get_all_instances(), *Drug.get_all_instances())

            # Create Medical Treatments
            regimen_1 = MedicationRegimen.get_or_create('Carboplatin with Gemcitabine')
            regimen_1.add_drug(carboplatin, annual_patient_con=13)
            regimen_1.add_drug(gemcitabine, annual_patient_con=13)
            
            regimen_2 = MedicationRegimen.get_or_create('Carboplatin with Paclitaxel')
            regimen_2.add_drug(carboplatin, annual_patient_con=15)
            regimen_2.add_drug(paclitaxel, annual_patient_con=20)
            
            # Create Alternative Treatments
            combined_regimen = AlternativeTreatments.get_or_create(regimen_1, regimen_2)
            
            # Create Additional Medical Treatment
            treatment_c = MedicationRegimen.get_or_create('Pembrolizumab')
            treatment_c.add_drug(pembrolizumab, annual_patient_con=10)
            commit(*MedicationRegimen.get_all_instances(), *AlternativeTreatments.get_all_instances())

            # Create Population and Patient
            population = Characteristic('Population', 'Iran')
            patient_lc = Patient(90_000_000, population)
            patient_lc.add_characteristic(lung_cancer, rate=0.0001)
            patient_lc.add_characteristic(nsclc, rate=0.85)
            
            # Additional Characteristics
            metastatic = Characteristic('Metastasis', 'Metastatic')
            bone_metastatic = Characteristic('Metastasis', 'Bone Metastasis')
            patient_lc.add_characteristic(metastatic, rate=0.45)
            patient_lc.add_characteristic(bone_metastatic, rate=0.343)
            
            # Create More Drugs and Treatments
            denosumab = Drug('Denosumab', '120 mg')
            denosumab_reg = MedicationRegimen('Denosumab Treatment')
            denosumab_reg.add_drug(denosumab, annual_patient_con=13)
            
            zoledronic_acid = Drug('Zoledronic Acid', '4 mg')  # Capitalized 'Zoledronic Acid'
            zoledronic_acid_reg = MedicationRegimen('Zoledronic Acid Treatment')
            zoledronic_acid_reg.add_drug(zoledronic_acid, annual_patient_con=13)
            
            # Create Alternative Treatments for Bone Target
            bone_target = AlternativeTreatments(denosumab_reg, zoledronic_acid_reg)
            patient_lc.add_treatment(bone_target, rate=1.0)
            
            # Create Follow-Up
            bone_treated_fu = FollowUp(patient_lc, 0.43)
            bone_treated_fu.add_to_patient()
            
            # Register Patient
            patient_lc.register_patient()
            
            # Create Additional Mutations and Branches
            other_mutation = Characteristic('Mutation', 'Other Mutations')
            kras_g12c = Characteristic('Mutation', 'KRAS G12C')
            patient_om = patient_lc.add_branch(other_mutation, 0.39, metastatic)
            patient_km = patient_lc.add_branch(kras_g12c, 0.61, metastatic)
            patient_om.register_patient()
            
            # Create Another Patient Group
            patient_p = Patient(90_000_000, population)
            male_p = Characteristic('Population', 'Male Population')
            patient_p.add_characteristic(male_p, rate=0.5055)
            prostate_c = Characteristic('Primary Indication', 'Prostate Cancer')
            patient_p.add_characteristic(prostate_c, rate=0.0018457)
            patient_p.add_characteristic(metastatic, rate=0.08)
            
            # Create Branches from Patient_p
            regional = Characteristic('Type', 'Regional')
            regional_p = patient_p.add_branch(regional, 0.13, prostate_c)
            local = Characteristic('Type', 'Local')
            local_p = patient_p.add_branch(local, 0.69, prostate_c)
            
            # Register Patients
            patient_p.register_patient()
            local_p.register_patient()
            regional_p.register_patient()
            
            # Commit all changes at once
            commit(
                *Characteristic.get_all_instances(),
                *Patient.get_all_instances(),
                *Drug.get_all_instances(),
                *MedicationRegimen.get_all_instances(),
                *AlternativeTreatments.get_all_instances(),
                *FollowUp.get_all_instances(),    
            )

        except Exception as e:
            print(f"An error occurred: {e}")
            traceback.print_exc()
            raise

if __name__ == "__main__":
    main()

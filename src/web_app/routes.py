from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from pkg.utils import commit
from pkg.med_core import Patient, Characteristic, Drug, Treatment, MedicationRegimen, AlternativeTreatments, FollowUp
from pkg.ZODB_manager import RegistryManager
from pkg.graph_vis import GraphVisualizer

main = Blueprint('main', __name__)


@main.route('/')
def index():
    return render_template('index.html')



def get_patient_characteristics():
    """Helper function to fetch populations, primary indications, and other characteristics."""
    with RegistryManager() as rm:
        patient_registry = rm.get_registry('patient_registry')
        
        all_pops = set()
        all_pis = set()
        all_chars_name = set()
        all_chars_type = set()

        for patient in patient_registry.values():
            for char, _, _ in patient.chars:
                if char.type == 'Population':
                    all_pops.add(char.name)
                elif char.type == 'Primary Indication':
                    all_pis.add(char.name)
                else:
                    all_chars_name.add(char.name)
                    all_chars_type.add(char.type)

        return list(all_pops), list(all_pis), list(all_chars_name), list(all_chars_type)
                                                   

@main.route('/api/characteristics', methods=['GET'])
def fetch_charracteristics():
    try:
        all_pops, all_pis, all_chars_name, all_chars_type = get_patient_characteristics()
        return jsonify({
            'population': list(all_pops),
            'primary_indication': list(all_pis),
            'other_characteristics_name': list(all_chars_name),
            'other_characteristics_type': list(all_chars_type)
        })
    
    except Exception as e:
        return jsonify({'error': f'Failed to fetch characteristics: {str(e)}'}), 500

        

@main.route('/patients', methods=['GET', 'POST'])
def patients():
    all_pops, all_pis, all_chars_name, all_chars_type = [], [], [], []
    try:
        all_pops, all_pis, all_chars_name, all_chars_type = get_patient_characteristics()                 
        if request.method == 'POST':
            try:
                population = request.form['population']
                primary_indication = request.form['primary_indication']
                char_type = request.form['char_type']
                char_name = request.form['char_name']

                matching_patients = []
                with RegistryManager() as rm:
                    patient_registry = rm.get_registry('patient_registry')
                    for patient in patient_registry.values():
                        matches_pop = any(char.name == population for char, *_ in patient.chars) if population else True
                        matches_pi = any(char.name == primary_indication for char, *_ in patient.chars) if primary_indication else True
                        matches_char_type = any(char.type == char_type for char, *_ in patient.chars) if char_type else True
                        matches_char_name = any(char.name == char_name for char, *_ in patient.chars) if char_name else True

                        if (
                            matches_pop and
                            matches_pi and
                            matches_char_type and
                            matches_char_name
                        ):
                            matching_patients.append(patient)
                    
                    print("patient_registry size:", len(patient_registry))

                    # Visualize the graph
                    if matching_patients:
                        graph_vis = GraphVisualizer()
                        for patient in matching_patients:
                            graph_vis.add_patient(patient)
                        graph_vis.visualize_interactive()
                        flash(f'Found {len(matching_patients)} matching patients.', 'success')
                    else:
                        flash(f'No patiens found matching the filter criteria.', 'danger')
                    # size = float(request.form['size'])

                    # population_char = Characteristic('Population', population)
                    # patient = Patient(size, population_char)
                    # pi_char = Characteristic('Primary Indication', primary_indication)
                    # patient.add_characteristic(pi_char)

                    # commit(patient)
                    # flash('Patient added successfully!', 'success')
            
            except Exception as e:
                flash(f'Error adding patient: {e}', 'danger')
        return render_template(
            'patients.html',
            all_pops = all_pops,
            all_pis = all_pis,
            all_chars_name = all_chars_name,
            all_chars_type = all_chars_type
            )
    
    except Exception as e:
        flash(f'Error fetching patient data: {e}', 'danger')
        return render_template(
            'patients.html',
            all_pops = all_pops,
            all_pis = all_pis,
            all_chars_name = all_chars_name,
            all_chars_type = all_chars_type
            )
    

@main.route('/filter_patient/<patient_id>', methods=['GET'])
def filter_patient(patient_id):
    graph_vis = GraphVisualizer()
    graph_vis.load_data()
    graph_vis.filter_graph_by_patient(patient_id)

    return jsonify({"message": f"Graph updated for patient {patient_id}"})


@main.route('/drugs', methods=['GET', 'POST'])
def drugs():
    if request.method == 'POST':
        try:
            name = request.form['name']
            strength = request.form['strength']

            drug = Drug(name, strength)
            commit(drug)
            flash('Drug added successfully!', 'success')
        except Exception as e:
            flash(f'Error adding drug: {e}', 'danger')
    return render_template('drugs.html')


@main.route('/treatments', methods=['GET'])
def treatments():
    try:
        with RegistryManager() as rm:
            drug_registry = rm.get_registry('drug_registry')
            drugs = [drug.to_dict() for drug in drug_registry.values()]
            
            treatment_registry = rm.get_registry('treatment_registry')
            medical_treatments = [treatment.to_dict() for treatment in treatment_registry.values()]

        return render_template('treatments.html', drugs=drugs, medical_treatments=medical_treatments)
    
    except Exception as e:
        flash(f"Error fetching registries: {e}", 'danger')
        return render_template('treatments.html', drugs=[], medical_treatments=[])



@main.route('/treatments/general', methods=['POST'])
def add_general_treatment():
    try:
        name = request.form['treatment_name']
        treatment = Treatment.get_or_create(name)
        commit(treatment)
        flash(f'General Treatment added successfully!', 'success')
    except Exception as e:
        flash(f'Error adding treatment: {e}' , 'danger')
    
    return redirect(url_for('main.treatments'))


@main.route('/treatments/regimen', methods=['POST'])
def add_medical_regimen():
    try:
        name = request.form['medical_regimen_name']
        drugs = request.form.getlist('medical_regimen_drugs')
        medication = MedicationRegimen.get_or_create(name)

        for drug_id in drugs:
            drug_name, drug_str = drug_id.split('|')
            drug = Drug(drug_name, drug_str)
            annual_patient_con = int(request.form[f'annual_con_{drug_name}'])
            medication.add_drug(drug, annual_patient_con)

        commit(medication)
        flash(f'Medication Regimen add successfully!', 'success')
    except Exception as e:
        flash(f'Error adding Medication Regimen: {e}', 'danger')
    return redirect(url_for('main.treatments'))


@main.route('/treatments/alternative', methods=['POST'])
def add_alt_treatment():
    try:
        name = request.form['alt_name']
        selelcted_treatments = request.form.getlist('alternative_treatments')
        rates = [
            float(request.form.get(f'rate_{treatment_name}', 1.0))
            for treatment_name in selelcted_treatments
        ]

        treatments = [Treatment.get_or_create(t_name) for t_name in selelcted_treatments]
        alternative_treatment = AlternativeTreatments.get_or_create(*treatments, rates=rates)
        
        commit(alternative_treatment)
        flash('Alternative Treatment added successfully!', 'success')
    except Exception as e:
        flash(f'Error adding alternative treatment: {e}', 'danger')
    return redirect(url_for('main.treatments'))


@main.route('/followups', methods=['GET', 'POST'])
def followups():
    if request.method == 'POST':
        try:
            patient_id = request.form['patient_id']
            os_rate = float(request.form['os_rate'])

            # Retrieve Patient and Create Follow-Up
            # Assuming patient retrieval logic is defined
            patient = Patient.get(patient_id)
            followup = FollowUp(patient, os_rate)
            followup.add_to_patient()
            commit(followup)
            flash('Follow-Up added successfully!', 'success')
        except Exception as e:
            flash(f'Error adding follow-up: {e}', 'danger')

    return render_template('followups.html')


@main.route('/chars', methods=['GET', 'POST'])
def chars():
    if request.method == 'POST':
        try:
            type = request.form['type']
            name = request.form['name']

            char = Characteristic(type, name)
            commit(char)
            flash('Characteristic added successfully!', 'success')
        except Exception as e:
            flash(f'Error adding Characteristic: {e}', 'danger')
    return render_template('chars.html')


@main.route('/interactive_graph')
def interactive_graph():
    vis = GraphVisualizer()
    vis.load_data()
    vis.visualize_interactive()

    return """
    <h3>Graph</h3>
    <iframe src="/static/pyvis_graph.html" width="100%" height="800"></iframe>
    """

@main.route('/api/primary_indications/<population_name>')
def fetch_primary_indications_for_population(population_name):
    """
    Return all primary indications for patients who have a given population characteristic.
    """
    try:
        with RegistryManager() as rm:
            patient_registry = rm.get_registry('patient_registry')

            pi_set = set()
            for patient in patient_registry.values():
                # Check if this patient has the chosen population
                has_pop = any(
                    char.type == 'Population' and char.name == population_name
                    for char, *_ in patient.chars
                )
                if has_pop:
                    # If so, collect the patient's Primary Indication(s)
                    for char, *_ in patient.chars:
                        if char.type == 'Primary Indication':
                            pi_set.add(char.name)

            # Build JSON response
            data = {
                'primary_indications': [{'name': pi} for pi in pi_set]
            }
            return jsonify(data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

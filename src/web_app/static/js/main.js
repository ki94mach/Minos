document.addEventListener('DOMContentLoaded', function () {
    // Initialize Select2 on both select elements
    $('#alternative_treatments').select2({
        placeholder: "Select treatments",  // Placeholder text
        allowClear: true,                  // Allow clearing selections
        width: '100%'                      // Full width of the dropdown
    });

    $('#medical_regimen_drugs').select2({
        placeholder: "Select drugs",  // Placeholder text
        allowClear: true,            // Allow clearing selections
        width: '100%'                // Full width of the dropdown
    });

    // When drugs are selected, dynamically add inputs for annual consumption
    const drugSelect = document.getElementById('medical_regimen_drugs');
    const drugInputsDiv = document.getElementById('drug_inputs');
    
    // When drugs are selected, dynamically add inputs for annual consumption
    drugSelect.addEventListener('change', function () {
        console.log('Drug selection changed'); // Check if the event is triggered
        drugInputsDiv.innerHTML = '';  // Clear existing inputs
        Array.from(drugSelect.selectedOptions).forEach(option => {
            const drugName = option.value.split('|')[0];
            const label = document.createElement('label');
            label.textContent = `Annual Consumption for ${drugName}:`;
            const input = document.createElement('input');
            input.type = 'number';
            input.name = `annual_con_${drugName}`;
            input.required = true;
            drugInputsDiv.appendChild(label);
            drugInputsDiv.appendChild(input);
        });
    });

    // For Alternative Treatments
    const altTreatmentSelect = document.getElementById('alternative_treatments');
    const rateInputsDiv = document.getElementById('rate_inputs');
    
    // When treatments are selected, dynamically add rate inputs
    altTreatmentSelect.addEventListener('change', function () {
        console.log('Alternative treatment selection changed'); // Check if the event is triggered
        rateInputsDiv.innerHTML = '';  // Clear existing rate inputs
        Array.from(altTreatmentSelect.selectedOptions).forEach(option => {
            const treatmentName = option.value;
            const label = document.createElement('label');
            label.textContent = `Rate for ${treatmentName}:`;
            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.min = '0';
            input.max = '1';
            input.name = `rate_${treatmentName}`;
            input.value = '1.0'; // Default rate
            rateInputsDiv.appendChild(label);
            rateInputsDiv.appendChild(input);
        });
    });
});

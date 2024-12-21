// Example JavaScript to dynamically add form fields or update sections

document.addEventListener('DOMContentLoaded', function () {
    const drugSelect = document.getElementById('medical_regimen_drugs');
    const drugInputsDiv = document.getElementById('drug_inputs');
    
    // When drugs are selected, dynamically add inputs for annual consumption
    drugSelect.addEventListener('change', function () {
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
});

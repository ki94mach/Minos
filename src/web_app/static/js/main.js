$(document).ready(function () {
    // Initialize Select2 on both select elements
    $('#alternative_treatments').select2({
      placeholder: 'Select treatments',  // Placeholder text
      allowClear: true,                  // Allow clearing selections
      width: '100%'                      // Full width of the dropdown
    });
  
    $('#medical_regimen_drugs').select2({
      placeholder: 'Select drugs',  // Placeholder text
      allowClear: true,             // Allow clearing selections
      width: '100%'                 // Full width of the dropdown
    });

    // Initialize Select2 for Population and Primary Indication dropdowns
    $('#population').select2({
      placeholder: 'Select Population',
      allowClear: true,
      width: '100%'
  });

  $('#primary_indication').select2({
      placeholder: 'Select Primary Indication',
      allowClear: true,
      width: '100%'
  });
  
    // When drugs are selected, dynamically add inputs for annual consumption
    $('#medical_regimen_drugs').on('change', function () {
      console.log('Drug selection changed via jQuery');
  
      const $drugInputsDiv = $('#drug_inputs');
      $drugInputsDiv.empty(); // Clear existing inputs
  
      // For each selected <option> in the #medical_regimen_drugs
      $(this).find(':selected').each(function () {
        const value = $(this).val(); // e.g. "Aspirin|100 mg"
        const [drugName] = value.split('|'); // Extract the drug name from "Aspirin|100 mg"
  
        // Create label
        const $label = $('<label>').text(`Annual Consumption for ${drugName}:`);
        // Create input
        const $input = $('<input>', {
          type: 'number',
          name: `annual_con_${drugName}`,
          required: true
        });
  
        // Append label and input to the container
        $drugInputsDiv.append($label, $input);
      });
    });
  
    // When alternative treatments are selected, dynamically add rate inputs
    $('#alternative_treatments').on('change', function () {
      console.log('Alternative treatment selection changed via jQuery');
  
      const $rateInputsDiv = $('#rate_inputs');
      $rateInputsDiv.empty(); // Clear existing rate inputs
  
      // For each selected <option> in the #alternative_treatments
      $(this).find(':selected').each(function () {
        const treatmentName = $(this).val(); // e.g. "SomeTreatment"
  
        // Create label
        const $label = $('<label>').text(`Rate for ${treatmentName}:`);
        // Create input
        const $input = $('<input>', {
          type: 'number',
          step: '0.01',
          min: '0',
          max: '1',
          name: `rate_${treatmentName}`,
          value: '1.0'  // Default rate
        });
  
        // Append label and input to the container
        $rateInputsDiv.append($label, $input);
      });
    });

      // When a Population is selected, dynamically load Primary Indications
      $('#population').on('change', function () {
        const populationId = $(this).val();

        // Make an AJAX request to get the Primary Indications for the selected Population
        $.ajax({
            url: `/api/primary_indications/${populationId}`,
            type: 'GET',
            success: function (data) {
                const $primaryIndicationSelect = $('#primary_indication');
                $primaryIndicationSelect.empty(); // Clear existing options

                // Populate Primary Indications dropdown with the fetched data
                data.primary_indications.forEach(function (indication) {
                    const option = $('<option>').val(indication.name).text(indication.name);
                    $primaryIndicationSelect.append(option);
                });
            },
            error: function () {
                alert('Failed to fetch Primary Indications.');
            }
        });
    });
});
  
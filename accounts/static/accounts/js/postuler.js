document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('postulationForm');
    const submitButton = document.getElementById('submitButton');
    const successModal = document.getElementById('success-modal');
    const closeBtn = successModal.querySelector('.close');

    form.addEventListener('submit', function(e) {
        if (submitButton.textContent.trim() === 'Je postule') {
            e.preventDefault();
            
            fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    successModal.style.display = 'block';
                }
            });
        }
    });

    closeBtn.addEventListener('click', function() {
        successModal.style.display = 'none';
    });
});
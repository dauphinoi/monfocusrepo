document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('postulationForm');
    const submitButton = document.getElementById('submitButton');
    const successModal = document.getElementById('success-modal');
    const closeBtn = successModal.querySelector('.close');
    const loadingOverlay = document.getElementById('loadingOverlay');

    form.addEventListener('submit', function(e) {
        if (submitButton.textContent.trim() === 'Je postule') {
            e.preventDefault();
            
            // Afficher l'overlay de chargement
            loadingOverlay.style.display = 'flex';
            
            fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                }
            })
            .then(response => response.json())
            .then(data => {
                // Cacher l'overlay de chargement
                loadingOverlay.style.display = 'none';
                
                if (data.success) {
                    successModal.style.display = 'block';
                }
            })
            .catch(error => {
                // Cacher l'overlay de chargement en cas d'erreur
                loadingOverlay.style.display = 'none';
                console.error('Error:', error);
            });
        }
    });

    closeBtn.addEventListener('click', function() {
        successModal.style.display = 'none';
    });
});
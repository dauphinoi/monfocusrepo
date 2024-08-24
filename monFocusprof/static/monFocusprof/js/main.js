    // Nouvelle partie pour la gestion du menu responsive
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('active');
        });
    }

    // Gestion améliorée des sous-menus pour la version mobile
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const dropdownToggle = dropdown.querySelector('a');
        const dropdownContent = dropdown.querySelector('.dropdown-content');
        
        if (dropdownToggle && dropdownContent) {
            dropdownToggle.addEventListener('click', function(e) {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
                }
            });

            const dropdownLinks = dropdownContent.querySelectorAll('a');
            dropdownLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    if (window.innerWidth <= 768) {
                        // Ne pas empêcher la navigation pour les liens internes
                        dropdownContent.style.display = 'none';
                    }
                });
            });
        }
    });
});
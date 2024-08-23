document.addEventListener('DOMContentLoaded', function() {
    const renseignementLink = document.getElementById('renseignement-link');
    const currentPage = renseignementLink?.getAttribute('data-current-page');
    
    if (renseignementLink) {
        renseignementLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (currentPage !== 'index') {
                // Si on n'est pas sur la page d'accueil, rediriger avec un paramètre
                window.location.href = this.href + '?highlight=true';
            } else {
                // Si on est déjà sur la page d'accueil, juste faire l'effet
                highlightSection();
            }
        });
    }

    function highlightSection() {
        const profileSection = document.getElementById('profile-section');
        if (profileSection) {
            // Scroll doux vers la section
            profileSection.scrollIntoView({ behavior: 'smooth' });

            profileSection.style.transition = 'background-color 0.5s ease';
            profileSection.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Vert semi-transparent
            
            setTimeout(() => {
                profileSection.style.backgroundColor = ''; // Retour à la couleur originale
            }, 2000);
        } else {
            console.warn("La section 'profile-section' n'a pas été trouvée.");
        }
    }

    // Vérifier si on vient d'arriver sur la page avec le paramètre highlight
    if (currentPage === 'index' && new URLSearchParams(window.location.search).get('highlight') === 'true') {
        highlightSection();
        // Nettoyer l'URL
        history.replaceState(null, '', window.location.pathname);
    }
});

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
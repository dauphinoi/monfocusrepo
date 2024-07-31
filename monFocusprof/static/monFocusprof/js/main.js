// Script to change the header background color on scroll
window.addEventListener('scroll', function() {
    var header = document.getElementById('main-header');
    var scrollPosition = window.scrollY;

    if (scrollPosition > 50) {
        header.style.backgroundColor = '#0000FF'; // Change to the desired background color
        header.style.transition = 'background-color 0.3s'; // Smooth transition
    } else {
        header.style.backgroundColor = 'transparent'; // Initial transparent background
    }
});

document.addEventListener('DOMContentLoaded', function() {
    var renseignementLink = document.getElementById('renseignement-link');
    if (renseignementLink) {
        renseignementLink.addEventListener('click', function(e) {
            e.preventDefault();
            var currentPath = window.location.pathname;
            
            if (currentPath !== '/') {
                // Si on n'est pas sur la page d'accueil, rediriger
                window.location.href = this.href;
            } else {
                // Si on est déjà sur la page d'accueil, juste faire l'effet
                highlightSection();
            }
        });
    }

    function highlightSection() {
        var profileSection = document.getElementById('profile-section');
        if (profileSection) {
            profileSection.style.transition = 'background-color 0.5s ease';
            profileSection.style.backgroundColor = 'green'; // Couleur de mise en évidence
            setTimeout(function() {
                profileSection.style.backgroundColor = ''; // Retour à la couleur originale
            }, 2000);
        }
    }

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
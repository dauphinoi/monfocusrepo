document.addEventListener('DOMContentLoaded', function() {
    const gridItems = document.querySelectorAll('.grid-item input[type="checkbox"]');
    gridItems.forEach(item => {
        item.addEventListener('change', function() {
            if (this.checked) {
                this.parentElement.classList.add('selected');
            } else {
                this.parentElement.classList.remove('selected');
            }
        });
    });
});



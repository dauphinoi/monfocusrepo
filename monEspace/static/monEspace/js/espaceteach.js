document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentHomeworks = {
    upcoming: [],
    past: []
    };
    let activeHomeworkTab = 'upcoming';
    let allNotes = [];
    let courseNotes = [];
    let recentNotes = [];
    let selectedNote = null;
    let currentCourseId = null;
    let currentTodos = [];
    let sidebarVisible = true;
    let currentAttachmentIndex = 0;
    let currentAttachments = [];
    const dataCache = {
        courses: coursesData,
        notes: {},
        attachments: {},
        todos: {}
    };

    // Éléments DOM fréquemment utilisés
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const cancelResetBtn = document.getElementById('cancelReset');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const todoSidebar = document.getElementById('todoSidebar');

    // Initialisation
    initTinyMCE();
    setupEventListeners();
    handleResponsiveness();
    initializeCourseEvents();
    toggleView('courses');

    function initTinyMCE() {
        tinymce.init({
            selector: '#editor',
            height: 500,
            apiKey: tinymceApiKey,
            plugins: [
                'advlist autolink lists link image charmap print preview anchor',
                'searchreplace visualblocks code fullscreen',
                'insertdatetime media table paste code help wordcount',
                'mathjax'
            ],
            toolbar: `
                undo redo | formatselect | bold italic backcolor |
                alignleft aligncenter alignright alignjustify |
                bullist numlist outdent indent | removeformat | help |
                mathjax
            `,
            mathjax: {
                lib: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.4/MathJax.js?config=TeX-AMS_HTML',
                symbols: {start: '\\(', end: '\\)'},
                className: 'math-tex'
            },
            setup: function(editor) {
                editor.on('change', function() {
                    if (selectedNote) {
                        selectedNote.content = editor.getContent();
                    }
                });
            },
            extended_valid_elements: 'span[*]',
        });
    }

    function setupEventListeners() {

        // Gestion des clics en dehors des overlays
   document.addEventListener('mousedown', function(event) {
    const todoSidebar = document.getElementById('todoSidebar');
    const overlayBackground = document.getElementById('overlayBackground');

    if (event.target === overlayBackground) {
        if (todoSidebar.style.display === 'block') {
            toggleTodo();
        }
    }
});

    document.getElementById('homeworkTab').addEventListener('click', () => switchTab('homework'));
    document.getElementById('tasksTab').addEventListener('click', () => switchTab('todo'));
    
    document.querySelectorAll('.sub-tab-button').forEach(button => {
        button.addEventListener('click', (e) => switchHomeworkTab(e.target.dataset.tab));
    });

    document.getElementById('backToHomeworkList').addEventListener('click', showHomeworkList);
        
        document.addEventListener('mousedown', handleOutsideClick);
        resetPasswordBtn.addEventListener('click', () => resetPasswordModal.style.display = 'block');
        cancelResetBtn.addEventListener('click', () => resetPasswordModal.style.display = 'none');
        resetPasswordForm.addEventListener('submit', handleResetPasswordSubmit);
        window.addEventListener('click', (event) => {
            if (event.target === resetPasswordModal) resetPasswordModal.style.display = 'none';
        });
        toggleSidebarBtn.addEventListener('click', toggleSidebar);
        window.addEventListener('resize', handleResponsiveness);
        document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
        document.getElementById('todoBtn').addEventListener('click', toggleTodo);
        document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
        document.getElementById('addImageBtn').addEventListener('click', () => triggerFileInput('image'));
        document.getElementById('addVideoBtn').addEventListener('click', () => triggerFileInput('video'));
        document.getElementById('addAudioBtn').addEventListener('click', () => triggerFileInput('audio'));
        document.getElementById('closeMediaBtn').addEventListener('click', closeMediaOverlay);
        document.getElementById('fileInput').addEventListener('change', handleFileUpload);
        document.getElementById('courseViewBtn').addEventListener('click', showCourseView);
        document.getElementById('addTodoBtn').addEventListener('click', () => {
            const todoInput = document.getElementById('newTodoInput');
            const content = todoInput.value.trim();
            if (content) {
                addTodo(content);
                todoInput.value = '';
            }
        });
        document.getElementById('prevAttachment').addEventListener('click', navigateAttachment('prev'));
        document.getElementById('nextAttachment').addEventListener('click', navigateAttachment('next'));
    }

    function initializeCourseEvents() {
        document.querySelectorAll('.course-item').forEach(item => {
            item.addEventListener('click', () => {
                const courseId = item.dataset.courseId;
                if (courseId && courseId !== 'null') {
                    const courseName = item.querySelector('h3').textContent;
                    fetchCourseNotes(courseId, courseName);
                } else {
                    console.error('Invalid course ID');
                }
            });
        });
    }

    // Ajoutez ces nouvelles fonctions
function switchTab(tab) {
    document.getElementById('todoContent').classList.toggle('active', tab === 'todo');
    document.getElementById('homeworkContent').classList.toggle('active', tab === 'homework');
    document.getElementById('tasksTab').classList.toggle('active', tab === 'todo');
    document.getElementById('homeworkTab').classList.toggle('active', tab === 'homework');
    
    if (tab === 'homework') {
        renderHomeworks();
    }
}

function switchHomeworkTab(tab) {
    activeHomeworkTab = tab;
    document.querySelectorAll('.sub-tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });
    document.getElementById('upcomingHomework').style.display = tab === 'upcoming' ? 'block' : 'none';
    document.getElementById('pastHomework').style.display = tab === 'past' ? 'block' : 'none';
    renderHomeworks();
}

async function fetchHomeworks(courseId) {
    if (!courseId) {
        currentHomeworks = { upcoming: [], past: [] };
        renderHomeworks();
        return;
    }

    try {
        const upcomingResponse = await fetch(`/api/homeworks/?course=${courseId}&status=upcoming`);
        const pastResponse = await fetch(`/api/homeworks/?course=${courseId}&status=past`);

        if (!upcomingResponse.ok || !pastResponse.ok) {
            throw new Error('Erreur lors de la récupération des devoirs');
        }

        currentHomeworks.upcoming = await upcomingResponse.json();
        currentHomeworks.past = await pastResponse.json();
        
        renderHomeworks();
    } catch (error) {
        console.error('Erreur lors de la récupération des devoirs:', error);
    }
}

function renderHomeworks() {
    const upcomingList = document.getElementById('upcomingHomework');
    const pastList = document.getElementById('pastHomework');
    upcomingList.innerHTML = '';
    pastList.innerHTML = '';
    
    function createHomeworkItem(homework) {
        const li = document.createElement('li');
        li.className = 'homework-item';
        li.innerHTML = `
            <h4>${homework.title}</h4>
            <p>Date limite : ${new Date(homework.due_date).toLocaleDateString()}</p>
            <p>Statut : ${homework.is_corrected ? 'Corrigé (résumé disponible sur votre boite mail)' : 'Non corrigé'}</p>
        `;
        li.addEventListener('click', () => showHomeworkDetails(homework));
        return li;
    }
    
    currentHomeworks.upcoming.forEach(homework => {
        upcomingList.appendChild(createHomeworkItem(homework));
    });
    
    currentHomeworks.past.forEach(homework => {
        pastList.appendChild(createHomeworkItem(homework));
    });

    showHomeworkList();
}

function showHomeworkDetails(homework) {
    const detailsDiv = document.getElementById('homeworkDetails');
    const listDiv = document.getElementById('homeworkList');

    document.getElementById('homeworkTitle').textContent = homework.title;
    document.getElementById('homeworkDescription').textContent = homework.description || 'Aucune description disponible';
    document.getElementById('homeworkDueDate').textContent = `Date limite : ${new Date(homework.due_date).toLocaleDateString()}`;
    document.getElementById('homeworkStatus').textContent = `Statut : ${homework.is_corrected ? 'Corrigé' : 'Non corrigé'}`;

    // Ajoutez d'autres détails si nécessaire, par exemple le feedback
    if (homework.feedback) {
        const feedbackElement = document.createElement('div');
        feedbackElement.innerHTML = `
            <h4>Feedback</h4>
            <p>${homework.feedback.content}</p>
            <p>Note : ${homework.feedback.grade || 'Non noté'}</p>
        `;
        detailsDiv.appendChild(feedbackElement);
    }

    listDiv.style.display = 'none';
    detailsDiv.style.display = 'block';
}

function showHomeworkList() {
    const detailsDiv = document.getElementById('homeworkDetails');
    const listDiv = document.getElementById('homeworkList');

    detailsDiv.style.display = 'none';
    listDiv.style.display = 'block';
}

    async function handleResetPasswordSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('emailInput').value;
        try {
            const response = await fetch('/accounts/reset-password/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({ email: email }),
            });
            const data = await response.json();
            alert(data.success ? 'Un email de réinitialisation a été envoyé à ' + email : 'Erreur : ' + data.message);
        } catch (error) {
            console.error('Erreur lors de la demande de réinitialisation:', error);
            alert('Une erreur est survenue lors de la demande de réinitialisation.');
        }
        resetPasswordModal.style.display = 'none';
    }

    function toggleSidebar() {
        sidebarVisible = !sidebarVisible;
        if (sidebarVisible) {
            sidebar.classList.remove('hidden');
            sidebar.style.left = '0';
            if (window.innerWidth > 768) {
                mainContent.style.marginLeft = '250px';
            }
            toggleSidebarBtn.style.left = '260px';
        } else {
            sidebar.classList.add('hidden');
            sidebar.style.left = '-250px';
            mainContent.style.marginLeft = '0';
            toggleSidebarBtn.style.left = '10px';
        }
    }

    function handleResponsiveness() {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('hidden');
            sidebar.style.left = '-250px';
            mainContent.style.marginLeft = '0';
            toggleSidebarBtn.style.left = '10px';
            todoSidebar.style.width = '100%';
        } else {
            if (sidebarVisible) {
                sidebar.classList.remove('hidden');
                sidebar.style.left = '0';
                mainContent.style.marginLeft = '250px';
                toggleSidebarBtn.style.left = '260px';
            }
            todoSidebar.style.width = '350px';
        }
    }

    function showCourseView() {
        toggleView('courses');
        recentNotes = [];
        selectedNote = null;
        currentCourseId = null;
        document.getElementById('currentCourseTitle').textContent = '';
    }

    async function fetchCourseNotes(courseId, courseName) {
        try {
            currentCourseId = courseId;
            if (!dataCache.notes[courseId]) {
                const response = await fetch(`/api/notes/course_notes/?course_id=${courseId}`);
                dataCache.notes[courseId] = await response.json();
            }
            courseNotes = dataCache.notes[courseId];
            updateRecentNotes();
            renderNotes();
            updateCurrentCourseTitle(courseName);
            toggleView('notes');
            fetchTodos(courseId);
            fetchHomeworks(courseId);
        } catch (error) {
            console.error('Error fetching course notes:', error);
        }
    }

    function updateRecentNotes() {
        recentNotes = courseNotes
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(0, 5);
        renderRecentNotes();
    }

    function renderNotes() {
        const allNotesList = document.getElementById('allNotesList');
        allNotesList.innerHTML = '';
        courseNotes.forEach(note => {
            allNotesList.appendChild(createNoteElement(note));
        });
    }

    function renderRecentNotes() {
        const recentNotesList = document.getElementById('recentNotesList');
        recentNotesList.innerHTML = '';
        recentNotes.forEach(note => {
            recentNotesList.appendChild(createNoteElement(note));
        });
    }

    function createNoteElement(note) {
        const div = document.createElement('div');
        div.className = `note-item ${selectedNote && selectedNote.id === note.id ? 'selected' : ''}`;
        div.innerHTML = `<span class="icon">📄</span> ${note.title}`;
        div.addEventListener('click', () => selectNote(note));
        return div;
    }

    function selectNote(note) {
        selectedNote = note;
        document.getElementById('noteTitle').textContent = note.title;
        tinymce.get('editor').setContent(note.content || '');
        renderAttachments(note.attachments);
        updateRecentNotes();
        toggleView('editor');
    }

    function renderAttachments(attachments) {
        const attachmentsContainer = document.getElementById('attachments');
        attachmentsContainer.innerHTML = '';
        if (attachments && attachments.length > 0) {
            attachments.forEach(attachment => {
                const button = document.createElement('button');
                const fileName = attachment.file.split('/').pop();
                button.innerHTML = `
                    <span class="icon">
                        ${attachment.file_type === 'image' ? '🖼️' : 
                        attachment.file_type === 'video' ? '🎥' : 
                        attachment.file_type === 'audio' ? '🎵' : 
                        '📎'}
                    </span>
                    ${fileName}
                `;
                button.addEventListener('click', () => handleAttachmentClick(attachment, attachments));
                attachmentsContainer.appendChild(button);
            });
        }
    }

    function renderAttachment(attachment) {
        const mediaContent = document.getElementById('mediaContent');
        mediaContent.innerHTML = '';
        switch (attachment.file_type) {
            case 'image':
                mediaContent.innerHTML = `<img src="${attachment.file}" alt="Image">`;
                break;
            case 'video':
                mediaContent.innerHTML = `<video controls src="${attachment.file}"></video>`;
                break;
            case 'audio':
                mediaContent.innerHTML = `<audio controls src="${attachment.file}"></audio>`;
                break;
            default:
                mediaContent.innerHTML = `<p>Fichier non pris en charge : ${attachment.file}</p>`;
        }
    }

    function createNewNote() {
        if (!currentCourseId) {
            alert("Veuillez d'abord sélectionner un cours.");
            return;
        }
        const title = prompt("Entrez le titre de votre nouvelle note :");
        if (title) {
            const newNote = { title: title, content: '', attachments: [], course: currentCourseId };
            courseNotes.push(newNote);
            selectNote(newNote);
            updateRecentNotes();
            toggleView('editor');
        }
    }

    async function saveNote() {
        if (selectedNote) {
            try {
                const url = selectedNote.id ? `/api/notes/${selectedNote.id}/` : '/api/notes/';
                const method = selectedNote.id ? 'PUT' : 'POST';
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    body: JSON.stringify({
                        ...selectedNote,
                        course: currentCourseId
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const savedNote = await response.json();
                if (selectedNote.id) {
                    courseNotes = courseNotes.map(n => n.id === savedNote.id ? savedNote : n);
                    allNotes = allNotes.map(n => n.id === savedNote.id ? savedNote : n);
                } else {
                    courseNotes.push(savedNote);
                    allNotes.push(savedNote);
                }
                selectedNote = savedNote;
                updateRecentNotes();
                renderNotes();
                alert('Note sauvegardée avec succès');
            } catch (error) {
                console.error('Error saving note:', error);
                alert('Erreur lors de la sauvegarde de la note');
            }
        }
    }

    function toggleView(view) {
        const elements = {
            courseGrid: document.getElementById('courseGrid'),
            noteContent: document.getElementById('noteContent'),
            allNotesList: document.getElementById('allNotesList'),
            noteTitle: document.getElementById('noteTitle'),
            recentNotesList: document.getElementById('recentNotesList')
        };

        const viewConfigs = {
            courses: { display: ['courseGrid'], hide: ['noteContent', 'allNotesList', 'noteTitle', 'recentNotesList'] },
            notes: { display: ['allNotesList', 'recentNotesList'], hide: ['courseGrid', 'noteContent'], conditional: ['todoSidebar'] },
            editor: { display: ['noteContent', 'allNotesList', 'recentNotesList'], hide: ['courseGrid', 'todoSidebar'] }
        };

        Object.entries(elements).forEach(([key, element]) => {
            if (viewConfigs[view].display.includes(key)) {
                element.style.display = key === 'courseGrid' ? 'grid' : 'block';
            } else if (viewConfigs[view].hide.includes(key)) {
                element.style.display = 'none';
            } else if (viewConfigs[view].conditional && viewConfigs[view].conditional.includes(key)) {
                element.style.display = currentCourseId ? 'block' : 'none';
            }
        });

        if (view === 'courses') {
            currentTodos = [];
            renderTodos();
        }
    }

    function handleOutsideClick(event) {
        const todoSidebar = document.getElementById('todoSidebar');
        const toggleBtn = document.getElementById('todoBtn');
        if (!todoSidebar.contains(event.target) && event.target !== toggleBtn) {
            closeTodoSidebar();
        }
    }

    function closeTodoSidebar() {
        const todoSidebar = document.getElementById('todoSidebar');
        todoSidebar.style.display = 'none';
        toggleOverlayBackground(false);
    }   

    function toggleOverlayBackground(show) {
    const overlayBackground = document.getElementById('overlayBackground');
    overlayBackground.style.display = show ? 'block' : 'none';
    document.body.style.overflow = show ? 'hidden' : 'auto';
    }

    
    function toggleTodo() {
    const todoSidebar = document.getElementById('todoSidebar');
    const isVisible = todoSidebar.style.display === 'flex';
    
    if (!isVisible) {
        todoSidebar.style.display = 'flex';
        toggleOverlayBackground(true);
        if (currentCourseId) {
            fetchTodos(currentCourseId);
            fetchHomeworks(currentCourseId);
        }
        handleResponsiveness();
    } else {
        closeTodoSidebar();
    }
}

    function triggerFileInput(type) {
        const fileInput = document.getElementById('fileInput');
        fileInput.setAttribute('accept', type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*');
        fileInput.click();
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', file.type.split('/')[0]);
        formData.append('note_id', selectedNote.id);
    
        try {
            const response = await fetch('/api/upload/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                },
                body: formData,
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            if (data.id) {
                const newAttachment = {
                    id: data.id,
                    file: data.file,
                    file_type: data.file_type,
                    created_at: data.created_at,
                    note: data.note
                };
                selectedNote.attachments = [...(selectedNote.attachments || []), newAttachment];
                renderAttachments(selectedNote.attachments);
                updateNoteInList(selectedNote);
                alert('Fichier uploadé avec succès!');
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Réponse inattendue du serveur');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert(`Erreur lors de l'upload du fichier : ${error.message}`);
        }
    }

    function handleAttachmentClick(attachment, attachments) {
        const mediaOverlay = document.getElementById('mediaOverlay');
        const mediaContent = document.getElementById('mediaContent');
        mediaContent.innerHTML = '';
    
        currentAttachments = attachments.filter(att => att.file_type === 'image');
        currentAttachmentIndex = currentAttachments.findIndex(att => att.id === attachment.id);
    
        renderAttachment(attachment);
        mediaOverlay.style.display = 'flex';
        updateNavigationButtons();
    }

    function updateNavigationButtons() {
        const prevButton = document.getElementById('prevAttachment');
        const nextButton = document.getElementById('nextAttachment');
    
        prevButton.style.display = currentAttachmentIndex > 0 ? 'block' : 'none';
        nextButton.style.display = currentAttachmentIndex < currentAttachments.length - 1 ? 'block' : 'none';
    }

    function navigateAttachment(direction) {
        return () => {
            if (direction === 'prev' && currentAttachmentIndex > 0) {
                currentAttachmentIndex--;
            } else if (direction === 'next' && currentAttachmentIndex < currentAttachments.length - 1) {
                currentAttachmentIndex++;
            }
            renderAttachment(currentAttachments[currentAttachmentIndex]);
            updateNavigationButtons();
        };
    }

    function closeMediaOverlay() {
        document.getElementById('mediaOverlay').style.display = 'none';
    }

    function updateCurrentCourseTitle(courseName) {
        document.getElementById('currentCourseTitle').textContent = courseName;
    }

    function getCsrfToken() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            .split('=')[1];
    }

    async function fetchTodos(courseId) {
        if (!courseId) {
            currentTodos = [];
            renderTodos();
            return;
        }

        if (dataCache.todos[courseId]) {
            currentTodos = dataCache.todos[courseId];
            renderTodos();
            return;
        }

        try {
            const response = await fetch(`/api/todo-items/?course=${courseId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des todos');
            }
            currentTodos = await response.json();
            
            dataCache.todos[courseId] = currentTodos;
            
            renderTodos();
        } catch (error) {
            console.error('Erreur lors de la récupération des todos:', error);
        }
    }

    function renderTodos() {
        const todoList = document.getElementById('todoList');
        todoList.innerHTML = '';
        currentTodos.forEach(todo => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" ${todo.completed ? 'checked' : ''}>
                <span>${todo.content}</span>
            `;
            li.querySelector('input').addEventListener('change', () => toggleTodoCompletion(todo.id));
            todoList.appendChild(li);
        });
        handleResponsiveness();
    }

    async function addTodo(content) {
        if (!currentCourseId) {
            alert("Veuillez d'abord sélectionner un cours.");
            return;
        }
        try {
            const response = await fetch('/api/todo-items/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({
                    course: currentCourseId,
                    content: content
                }),
            });
            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout du todo');
            }
            const newTodo = await response.json();
            currentTodos.push(newTodo);
            
            dataCache.todos[currentCourseId] = currentTodos;
            
            renderTodos();
        } catch (error) {
            console.error('Erreur lors de l\'ajout du todo:', error);
        }
    }

    async function toggleTodoCompletion(todoId) {
        try {
            const response = await fetch(`/api/todo-items/${todoId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                },
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erreur détaillée:', errorData);
                throw new Error('Erreur lors de la suppression du todo');
            }
            currentTodos = currentTodos.filter(todo => todo.id !== todoId);
            
            dataCache.todos[currentCourseId] = currentTodos;
            
            renderTodos();
        } catch (error) {
            console.error('Erreur lors de la suppression du todo:', error);
        }
    }

    // Initialisation de l'état de la sidebar
    if (window.innerWidth <= 768) {
        sidebarVisible = false;
        sidebar.classList.add('hidden');
        sidebar.style.left = '-250px';
        mainContent.style.marginLeft = '0';
        toggleSidebarBtn.style.left = '10px';
    } else {
        sidebarVisible = true;
        sidebar.classList.remove('hidden');
        sidebar.style.left = '0';
        mainContent.style.marginLeft = '250px';
        toggleSidebarBtn.style.left = '260px';
    }
});
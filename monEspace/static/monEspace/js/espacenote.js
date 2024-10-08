document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    const dataCache = {
        courses: coursesData,
        allNotes: [],
        courseNotes: {},
        todos: {},
        homework: {}
    };
    let selectedNote = null;
    let currentCourseId = null;
    let chatHistory = [];
    let currentSessionId = null;
    let todoPromptShown = false;
    let sidebarVisible = true;
    let currentAttachmentIndex = 0;
    let currentAttachments = [];
    let currentView = 'tasks';
    let currentTodoId = null;

    // finir des tacches
     // Ajout de l'écouteur d'événements pour le bouton "Finir la tâche en cours"
     const finishTaskBtn = document.getElementById('finishTaskBtn');
        if (finishTaskBtn) {
            finishTaskBtn.addEventListener('click', async function() {
                if (confirm('Êtes-vous sûr de vouloir terminer la tâche en cours ?')) {
                    await finalizeTaskSession();
                }
            });
        }

    // Gestion de l'ajout de cours
    const addCourseBtn = document.getElementById('addCourseBtn');
    const addCourseOverlay = document.getElementById('addCourseOverlay');
    const closeOverlayBtn = document.getElementById('closeOverlayBtn');
    const addCourseForm = document.getElementById('addCourseForm');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');

    const typesCours = [
        {name: 'Cours à domicile'},
        {name: 'Cours hebdomadaire en centre (près de chez vous)'},
        {name: 'Stage de vacances'},
        {name: 'Cours en ligne (avec un prof en visio)'},
        {name: 'Je ne sais pas et souhaite être conseillé(e)'}
    ];

    // Éléments DOM fréquemment utilisés
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

    // Initialisation
    if (!currentCourseId && dataCache.courses.length > 0) {
        currentCourseId = dataCache.courses[0].id;
    }
    initTinyMCE();
    setupEventListeners();
    initSidebar();
    toggleView('courses');
    // checkPendingTodos();
    showStaticSVG();

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

    // Masquer les sections de notes et le bouton de création au chargement initial
    document.getElementById('newNoteBtn').style.display = 'none';
    document.getElementById('allNotesSection').style.display = 'none';
    document.getElementById('finishTaskBtn').style.display = 'none';
    

   // Gestion des clics en dehors des overlays
   document.addEventListener('mousedown', function(event) {
    const searchOverlay = document.getElementById('searchOverlay');
    const chatOverlay = document.querySelector('.chat-overlay');
    const todoSidebar = document.getElementById('todoSidebar');
    const overlayBackground = document.getElementById('overlayBackground');

    if (event.target === overlayBackground) {
        if (searchOverlay.style.display === 'block') {
            toggleSearch();
        }
        if (chatOverlay.style.display === 'flex') {
            toggleChat();
        }
        if (todoSidebar.style.display === 'block') {
            toggleTodo();
        }
    }
});

        // Gestion des tâches et devoirs
        document.getElementById('addHomeworkForm').addEventListener('submit', handleAddHomeworkSubmit);
        document.getElementById('tasksTab').addEventListener('click', () => switchView('tasks'));
        document.getElementById('homeworkTab').addEventListener('click', () => switchView('homework'));
        document.getElementById('addHomeworkBtn').addEventListener('click', showAddHomeworkForm);
        document.getElementById('cancelAddHomework').addEventListener('click', backToHomeworkView);
        document.querySelector('[data-tab="upcoming"]').addEventListener('click', showUpcomingHomework);
        document.querySelector('[data-tab="past"]').addEventListener('click', showPastHomework);
        

        // Gestion de l'interface principale
        toggleSidebarBtn.addEventListener('click', toggleSidebar);
        document.getElementById('deleteNoteBtn').addEventListener('click', confirmDeleteNote);
        document.getElementById('courseViewBtn').addEventListener('click', showCourseView);
        document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
        document.getElementById('searchBtn').addEventListener('click', toggleSearch);
        document.getElementById('chatBtn').addEventListener('click', toggleChat);
        document.getElementById('todoBtn').addEventListener('click', toggleTodo);
        document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
        
        // Gestion des pièces jointes
        document.getElementById('addImageBtn').addEventListener('click', () => triggerFileInput('image'));
        document.getElementById('addVideoBtn').addEventListener('click', () => triggerFileInput('video'));
        document.getElementById('addAudioBtn').addEventListener('click', () => triggerFileInput('audio'));
        document.getElementById('closeMediaBtn').addEventListener('click', closeMediaOverlay);
        document.getElementById('fileInput').addEventListener('change', handleFileUpload);
        
        // Gestion du chat
        document.getElementById('closeChatBtn').addEventListener('click', toggleChat);
        document.getElementById('sendChatBtn').addEventListener('click', (e) => {
            e.preventDefault();
            handleChatSubmit();
        });
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleChatSubmit();
            }
        });
        
        // Gestion de la recherche
        document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));

        // Gestion des cours
        document.querySelectorAll('.course-item').forEach(item => {
            item.addEventListener('click', () => {
                const courseId = item.getAttribute('data-course-id');
                if (courseId && courseId !== 'null') {
                    const courseName = item.querySelector('h3').textContent;
                    fetchCourseNotes(courseId, courseName);
                }
            });
        });

        // Gestion des pièces jointes
        document.getElementById('prevAttachment').addEventListener('click', () => navigateAttachment('prev'));
        document.getElementById('nextAttachment').addEventListener('click', () => navigateAttachment('next'));

        // Gestion de l'ajout de cours
        addCourseBtn.addEventListener('click', async () => {
        const subjects = await fetchSubjects();
        createOptions(document.getElementById('matiereOptions'), subjects, 'radio', true);
        createOptions(document.getElementById('typeCoursOptions'), typesCours, 'checkbox');
        addCourseOverlay.style.display = 'flex';
    });
    }

    // Fonction pour finaliser la session de tâche
    async function finalizeTaskSession() {
    if (!currentSessionId || !currentTodoId) {
        console.error('Aucune session de tâche active ou tâche non spécifiée');
        return;
    }

    try {
        const response = await fetch('/api/chat/generate_report/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                todo_id: currentTodoId
            }),
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la génération du rapport');
        }

        const data = await response.json();
        alert(data.message);
        
        if (data.task_deleted) {
            // Supprimer la tâche de l'interface
            removeTodoFromUI(data.task_id);
        }
        
        // Réinitialiser l'état
        currentSessionId = null;
        currentTodoId = null;
        const finishTaskBtn = document.getElementById('finishTaskBtn');
        if (finishTaskBtn) {
            finishTaskBtn.style.display = 'none';
        }
        toggleChat(); // Fermer le chat
    } catch (error) {
        console.error('Erreur lors de la finalisation de la session :', error);
        alert('Une erreur est survenue lors de la génération du rapport.');
    }
}

function removeTodoFromUI(todoId) {
    // Supprimer la tâche de la liste affichée
    const todoElement = document.querySelector(`[data-todo-id="${todoId}"]`);
    if (todoElement) {
        todoElement.remove();
    }
    
    // Supprimer la tâche du cache local si vous en utilisez un
    if (dataCache.todos[currentCourseId]) {
        dataCache.todos[currentCourseId] = dataCache.todos[currentCourseId].filter(todo => todo.id !== todoId);
    }
    
    // Mettre à jour l'affichage si nécessaire
    updateTodoDisplay();
}

function updateTodoDisplay() {
    // Fonction pour mettre à jour l'affichage des tâches restantes
    const todoList = document.getElementById('todoList');
    if (dataCache.todos[currentCourseId] && dataCache.todos[currentCourseId].length === 0) {
        todoList.innerHTML = '<li>Toutes les tâches sont terminées !</li>';
    }
}

// Fonction pour afficher le rapport
function displayReport(reportHtml) {
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();
}

// Fonction pour réinitialiser l'état de la session
function resetTaskSession() {
    currentSessionId = null;
    const finishTaskBtn = document.getElementById('finishTaskBtn');
    if (finishTaskBtn) {
        finishTaskBtn.style.display = 'none';
    }
}

    
    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
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

    function showCourseView() {
    toggleView('courses');
    dataCache.recentNotes = [];
    selectedNote = null;
    currentCourseId = null;
    document.getElementById('currentCourseTitle').textContent = '';
    document.getElementById('allNotesList').innerHTML = '';
    document.getElementById('allNotesSection').style.display = 'none';
}

    function confirmDeleteNote() {
        if (selectedNote) {
            if (confirm("Voulez-vous vraiment supprimer cette note ?")) {
                deleteNote(selectedNote.id);
            }
        } else {
            alert("Veuillez d'abord sélectionner une note à supprimer.");
        }
    }

    async function deleteNote(noteId) {
        try {
            const response = await fetch(`/api/notes/${noteId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                },
            });

            if (response.ok) {
                dataCache.courseNotes[currentCourseId] = dataCache.courseNotes[currentCourseId].filter(note => note.id !== noteId);
                
                if (dataCache.recentNotes.length > 0) {
                    selectNote(dataCache.recentNotes[0]);
                } else {
                    selectedNote = null;
                    document.getElementById('noteTitle').textContent = '';
                    tinymce.get('editor').setContent('');
                    document.getElementById('attachments').innerHTML = '';
                }
                
                renderNotes(currentCourseId);
                alert('Note supprimée avec succès');
            } else {
                throw new Error('Erreur lors de la suppression de la note');
            }
        } catch (error) {
            console.error('Erreur lors de la suppression de la note:', error);
            alert('Erreur lors de la suppression de la note');
        }
    }

    async function fetchCourseNotes(courseId, courseName) {
    if (!dataCache.courseNotes[courseId]) {
        try {
            const response = await fetch(`/api/notes/course_notes/?course_id=${courseId}`);
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des notes du cours');
            }
            dataCache.courseNotes[courseId] = await response.json();
        } catch (error) {
            console.error('Error fetching course notes:', error);
            dataCache.courseNotes[courseId] = [];
        }
    }
    currentCourseId = courseId;
    renderNotes(courseId);
    updateCurrentCourseTitle(courseName || 'Cours sans nom');
    toggleView('notes');
    // Afficher les sections de notes et le bouton de création
    document.getElementById('newNoteBtn').style.display = 'block';
    document.getElementById('allNotesSection').style.display = 'block';
}

    function renderNotes(courseId) {
        console.log('Rendering notes for course:', courseId, dataCache.courseNotes[courseId]);
        const allNotesList = document.getElementById('allNotesList');
        allNotesList.innerHTML = '';
        dataCache.courseNotes[courseId].forEach(note => {
            allNotesList.appendChild(createNoteElement(note));
        });
    }

    function renderRecentNotes() {
        const recentNotesList = document.getElementById('recentNotesList');
        recentNotesList.innerHTML = '';
        dataCache.recentNotes.forEach(note => {
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

    async function selectNote(note) {
    if (!note) {
        console.error('Attempted to select an undefined note');
        return;
    }
    selectedNote = note;
    document.getElementById('noteTitle').textContent = note.title || 'Note sans titre';
    tinymce.get('editor').setContent(note.content || '');
    renderAttachments(note.attachments || []);
    
    // Assurez-vous que les notes du cours sont chargées avant de mettre à jour les notes récentes
    if (!dataCache.courseNotes[currentCourseId]) {
        await fetchCourseNotes(currentCourseId, findCourseById(currentCourseId)?.subject_name || 'Cours sans nom');
    }
    
    toggleView('editor');
}

function updateCurrentCourseTitle(title) {
    const titleElement = document.getElementById('currentCourseTitle');
    if (titleElement) {
        titleElement.textContent = title || 'Cours sans nom';
    }
}

// Fonction utilitaire pour trouver un cours par son ID
function findCourseById(courseId) {
    return dataCache.courses.find(course => course.id === parseInt(courseId, 10));
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

    async function createNewNote() {
    if (!currentCourseId) {
        alert("Veuillez d'abord sélectionner un cours.");
        return;
    }
    const title = prompt("Entrez le titre de votre nouvelle note :");
    if (title) {
        const newNote = { title: title, content: '', attachments: [], course: currentCourseId };
        try {
            const response = await fetch('/api/notes/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify(newNote),
            });
            if (!response.ok) throw new Error('Erreur lors de la création de la note');
            const savedNote = await response.json();
            
            // Mise à jour du cache
            if (!dataCache.courseNotes[currentCourseId]) {
                dataCache.courseNotes[currentCourseId] = [];
            }
            dataCache.courseNotes[currentCourseId].push(savedNote);
            
            // Mise à jour de l'interface
            renderNotes(currentCourseId);
            selectNote(savedNote);
            toggleView('editor');
        } catch (error) {
            console.error('Erreur lors de la création de la note:', error);
            alert('Erreur lors de la création de la note');
        }
    }
}

function renderNotes(courseId) {
    const allNotesList = document.getElementById('allNotesList');
    allNotesList.innerHTML = '';
    if (dataCache.courseNotes[courseId] && Array.isArray(dataCache.courseNotes[courseId])) {
        dataCache.courseNotes[courseId].forEach(note => {
            allNotesList.appendChild(createNoteElement(note));
        });
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
                    dataCache.courseNotes[currentCourseId] = dataCache.courseNotes[currentCourseId].map(n => n.id === savedNote.id ? savedNote : n);
                } else {
                    dataCache.courseNotes[currentCourseId].push(savedNote);
                }
                selectedNote = savedNote;
                renderNotes(currentCourseId);
                alert('Note sauvegardée avec succès');
            } catch (error) {
                console.error('Error saving note:', error);
                alert('Erreur lors de la sauvegarde de la note');
            }
        }
    }

    function toggleView(view) {
    const elements = {
        toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
        courseGrid: document.getElementById('courseGrid'),
        noteContent: document.getElementById('noteContent'),
        allNotesSection: document.getElementById('allNotesSection'),
        todoSidebar: document.getElementById('todoSidebar'),
        noteTitle: document.getElementById('noteTitle'),
        newNoteBtn: document.getElementById('newNoteBtn')
    };

    const viewConfigs = {
        courses: { 
            show: ['courseGrid'], 
            hide: ['noteContent', 'allNotesSection', 'todoSidebar', 'noteTitle', 'newNoteBtn']
        },
        notes: { 
            show: ['allNotesSection', 'newNoteBtn'], 
            hide: ['courseGrid', 'noteContent', 'todoSidebar'] 
        },
        editor: { 
            show: ['noteContent', 'allNotesSection', 'newNoteBtn'], 
            hide: ['courseGrid', 'todoSidebar'] 
        }
    };

    Object.entries(elements).forEach(([key, element]) => {
        if (element) {
            if (viewConfigs[view].show && viewConfigs[view].show.includes(key)) {
                element.style.display = key === 'courseGrid' ? 'grid' : 'block';
            } else if (viewConfigs[view].hide && viewConfigs[view].hide.includes(key)) {
                element.style.display = 'none';
            }
        }
    });

    if (view === 'courses') {
        if (currentCourseId && !dataCache.todos[currentCourseId]) {
            fetchTodos(currentCourseId);
        } else {
            renderTodos(currentCourseId);
        }
    }
}

function toggleOverlayBackground(show) {
    const overlayBackground = document.getElementById('overlayBackground');
    overlayBackground.style.display = show ? 'block' : 'none';
    document.body.style.overflow = show ? 'hidden' : 'auto';
}

function toggleTodo() {
    const todoSidebar = document.getElementById('todoSidebar');
    const isVisible = todoSidebar.style.display === 'block';
    
    if (!isVisible) {
        todoSidebar.style.display = 'block';
        todoSidebar.classList.add('open');
        toggleOverlayBackground(true);
        if (currentCourseId) {
            fetchTodos(currentCourseId);
            fetchHomework(currentCourseId);
        }
    } else {
        todoSidebar.style.display = 'none';
        todoSidebar.classList.remove('open');
        toggleOverlayBackground(false);
    }
}

function toggleChat() {
    const chatOverlay = document.querySelector('.chat-overlay');
    const isVisible = chatOverlay.style.display === 'flex';
    
    if (!isVisible) {
        chatOverlay.style.display = 'flex';
        toggleOverlayBackground(true);
        if (!currentSessionId) {
            console.log("Pas de session active, démarrage d'une nouvelle session");
            startNewChatSession();
        } else {
            if (chatHistory.length > 0) {
                renderChatHistory();
            }
        }
    } else {
        chatOverlay.style.display = 'none';
        toggleOverlayBackground(false);
    }
}

function toggleSearch() {
    const searchOverlay = document.getElementById('searchOverlay');
    const isVisible = searchOverlay.style.display === 'block';

    if (isVisible) {
        searchOverlay.style.display = 'none';
        toggleOverlayBackground(false);
    } else {
        searchOverlay.style.display = 'block';
        toggleOverlayBackground(true);
    }
}

    function switchView(view) {
        currentView = view;
        const tasksTab = document.getElementById('tasksTab');
        const homeworkTab = document.getElementById('homeworkTab');
        const todoContent = document.getElementById('todoContent');
        const homeworkContent = document.getElementById('homeworkContent');
        const addHomeworkForm = document.getElementById('addHomeworkForm');
        const homeworkTabs = document.querySelector('.homework-tabs');
        const addHomeworkBtn = document.getElementById('addHomeworkBtn');

        if (view === 'tasks') {
            tasksTab.classList.add('active');
            homeworkTab.classList.remove('active');
            todoContent.style.display = 'block';
            homeworkContent.style.display = 'none';
            addHomeworkForm.style.display = 'none';
            homeworkTabs.style.display = 'none';
            addHomeworkBtn.style.display = 'none';
        } else if (view === 'homework') {
            tasksTab.classList.remove('active');
            homeworkTab.classList.add('active');
            todoContent.style.display = 'none';
            homeworkContent.style.display = 'block';
            addHomeworkForm.style.display = 'none';
            homeworkTabs.style.display = 'flex';
            showUpcomingHomework();
        } else if (view === 'addHomework') {
            todoContent.style.display = 'none';
            homeworkContent.style.display = 'none';
            addHomeworkForm.style.display = 'block';
            homeworkTabs.style.display = 'none';
            addHomeworkBtn.style.display = 'none';
        }
    }

    function showUpcomingHomework() {
        const upcomingTab = document.querySelector('[data-tab="upcoming"]');
        const pastTab = document.querySelector('[data-tab="past"]');
        const upcomingHomework = document.getElementById('upcomingHomework');
        const pastHomework = document.getElementById('pastHomework');
        const addHomeworkBtn = document.getElementById('addHomeworkBtn');

        upcomingTab.classList.add('active');
        pastTab.classList.remove('active');
        upcomingHomework.style.display = 'block';
        pastHomework.style.display = 'none';
        addHomeworkBtn.style.display = 'block';

        fetchHomework(currentCourseId, 'upcoming');
    }

    function showPastHomework() {
        const upcomingTab = document.querySelector('[data-tab="upcoming"]');
        const pastTab = document.querySelector('[data-tab="past"]');
        const upcomingHomework = document.getElementById('upcomingHomework');
        const pastHomework = document.getElementById('pastHomework');
        const addHomeworkBtn = document.getElementById('addHomeworkBtn');

        upcomingTab.classList.remove('active');
        pastTab.classList.add('active');
        upcomingHomework.style.display = 'none';
        pastHomework.style.display = 'block';
        addHomeworkBtn.style.display = 'none';

        fetchHomework(currentCourseId, 'past');
    }

    async function startNewChatSession() {
        try {
            const response = await fetch('/api/chat/start_session/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({ course_id: currentCourseId }),
            });
            const data = await response.json();
            currentSessionId = data.session_id;
            chatHistory = [];
            renderChatHistory();
        } catch (error) {
            console.error('Error starting new chat session:', error);
        }
    }


    function showAnimatedSVG() {
    document.getElementById('animatedSVG').style.display = 'inline-block';
    document.getElementById('staticSVG').style.display = 'none';
}

    function showStaticSVG() {
        document.getElementById('animatedSVG').style.display = 'none';
        document.getElementById('staticSVG').style.display = 'inline-block';
    }

    async function handleChatSubmit(event = null) {
    const chatInput = document.getElementById('chatInput');
    let messageContent;

    if (event && event instanceof PointerEvent) {
        console.log("Clic détecté, pas d'action nécessaire");
        return;
    } else if (typeof event === 'string') {
        messageContent = event;
    } else {
        messageContent = chatInput.value.trim();
    }

    if (messageContent === '') {
        console.log("Message vide, pas d'envoi");
        return;
    }

    addMessageToHistory('user', messageContent);
    renderUserMessage(messageContent);
    chatInput.value = '';

    try {
        showAnimatedSVG(); // Afficher le SVG animé au début de la génération de la réponse
        if (!currentSessionId) {
            console.log("Pas de session active, démarrage d'une nouvelle session");
            await startNewChatSession();
        }

        const response = await fetch('/api/chat/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
            },
            body: JSON.stringify({ 
                message: messageContent,
                session_id: currentSessionId
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponseContent = '';
        let currentBlock = { type: 'text', content: '' };
        let blocks = [];
        let aiMessageElement = null;
        let source = null;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'end') {
                        break;
                    } else if (data.type === 'source') {
                        source = data.source;
                    } else if (data.content) {
                        aiResponseContent += data.content;
                        
                        // Analyse du contenu pour identifier les blocs spéciaux
                        blocks = parseContent(aiResponseContent);

                        if (!aiMessageElement) {
                            aiMessageElement = document.createElement('div');
                            aiMessageElement.className = 'chat-message ai';
                            document.getElementById('chatMessages').appendChild(aiMessageElement);
                        }

                        renderFormattedContent(aiMessageElement, blocks);
                        scrollChatToBottom();
                    }
                }
            }
        }

        if (currentBlock.content) {
            blocks.push(currentBlock);
        }

        addMessageToHistory('ai', aiResponseContent, source);
        finalizeAIMessageInUI(aiResponseContent, source, blocks);

        showStaticSVG(); // Afficher le SVG statique une fois la réponse générée

    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        renderErrorMessage("Une erreur est survenue lors de l'envoi du message. Veuillez réessayer.");
    }
}

function renderFormattedContent(element, blocks) {
    console.log('Rendering formatted content:', blocks);
    element.innerHTML = '';
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';

    let currentList = null;

    blocks.forEach((block, index) => {
        console.log('Processing block:', block);
        let blockElement;
        switch (block.type) {
            case 'title':
                blockElement = document.createElement('h2');
                blockElement.textContent = block.content;
                blockElement.className = 'section-title';
                break;
            case 'subtitle':
                blockElement = document.createElement('h3');
                blockElement.textContent = block.content;
                blockElement.className = 'section-subtitle';
                break;
            case 'text':
                blockElement = document.createElement('p');
                blockElement.innerHTML = formatInlineElements(block.content);
                break;
            case 'bullet':
                if (!currentList) {
                    currentList = document.createElement('ul');
                    contentElement.appendChild(currentList);
                }
                blockElement = document.createElement('li');
                blockElement.innerHTML = formatInlineElements(block.content);
                currentList.appendChild(blockElement);
                return;
            case 'math':
                blockElement = document.createElement('div');
                blockElement.className = 'math-block';
                blockElement.innerHTML = `\\[${block.content}\\]`;
                break;
            default:
                console.warn('Unknown block type:', block.type);
                blockElement = document.createElement('p');
                blockElement.textContent = block.content;
        }

        if (block.type !== 'bullet') {
            currentList = null;
        }

        contentElement.appendChild(blockElement);

        if (index < blocks.length - 1) {
            contentElement.appendChild(document.createElement('br'));
        }
    });

    element.appendChild(contentElement);
    console.log('Final rendered content:', element.innerHTML);

    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([element])
            .catch((err) => console.error('MathJax error:', err));
    } else {
        console.warn('MathJax not available');
    }
}

function formatInlineElements(text) {
    // Gestion du gras
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Gestion de l'italique
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Gestion des expressions mathématiques inline
    text = text.replace(/\$(.*?)\$/g, '\\($1\\)');
    return text;
}

function parseContent(content) {
    const lines = content.split('\n');
    const blocks = [];
    let currentBlock = null;

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('### ')) {
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = { type: 'title', content: line.slice(4) };
        } else if (line.startsWith('## ')) {
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = { type: 'subtitle', content: line.slice(3) };
        } else if (line.startsWith('• ') || line.startsWith('- ')) {
            if (currentBlock && currentBlock.type !== 'bullet') {
                blocks.push(currentBlock);
            }
            blocks.push({ type: 'bullet', content: line.slice(2) });
            currentBlock = null;
        } else if (line.startsWith('$') && line.endsWith('$') && line.length > 2) {
            if (currentBlock) blocks.push(currentBlock);
            blocks.push({ type: 'math', content: line.slice(1, -1) });
            currentBlock = null;
        } else if (line !== '') {
            if (!currentBlock || currentBlock.type !== 'text') {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = { type: 'text', content: line };
            } else {
                currentBlock.content += ' ' + line;
            }
        } else if (currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
        }
    });

    if (currentBlock) blocks.push(currentBlock);
    return blocks;
}


function finalizeAIMessageInUI(content, source, blocks) {
    const aiMessageElement = document.querySelector('.chat-message.ai:last-child');
    if (!aiMessageElement) return;

    renderFormattedContent(aiMessageElement, blocks);

    if (false) {
        const sourceElement = document.createElement('p');
        sourceElement.className = 'source';
        sourceElement.innerHTML = `<a href="#" data-note-id="${source}">Source (Note)</a>`;
        aiMessageElement.appendChild(sourceElement);

        const sourceLink = sourceElement.querySelector('a');
        sourceLink.addEventListener('click', function(e) {
            e.preventDefault();
            selectNoteById(source);
        });
    }

    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([aiMessageElement])
            .catch((err) => console.error('MathJax error:', err));
    }

    scrollChatToBottom();
}
    
    function renderMathExpression(expression) {
        expression = expression
            .replace(/∀/g, '\\forall ')
            .replace(/∃/g, '\\exists ')
            .replace(/ℝ/g, '\\mathbb{R}')
            .replace(/ℂ/g, '\\mathbb{C}')
            .replace(/∈/g, '\\in ')
            .replace(/≥/g, '\\geq ');
    
        return expression;
    }
    

    function addMessageToHistory(role, content, source = null) {
        chatHistory.push({ role, content, source });
    }

    function renderChatHistory() {
    const chatMessagesContainer = document.getElementById('chatMessages');
    chatMessagesContainer.innerHTML = '';
    chatHistory.forEach(message => {
        if (message.role === 'user') {
            renderUserMessage(message.content);
        } else {
            renderAIMessage(message.content, message.source);
        }
    });
    scrollChatToBottom();
}

function renderUserMessage(content) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message user';
    messageElement.innerHTML = `<div class="message-content"><p>${content}</p></div>`;
    document.getElementById('chatMessages').appendChild(messageElement);
}

function renderAIMessage(content, source) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message ai';
    
    const blocks = parseContent(content);
    renderFormattedContent(messageElement, blocks);
    
    if (false) {
        const sourceElement = document.createElement('p');
        sourceElement.className = 'source';
        sourceElement.innerHTML = `<a href="#" data-note-id="${source}">Source (Note)</a>`;
        messageElement.appendChild(sourceElement);
        
        const sourceLink = sourceElement.querySelector('a');
        sourceLink.addEventListener('click', function(e) {
            e.preventDefault();
            selectNoteById(source);
        });
    }
    
    document.getElementById('chatMessages').appendChild(messageElement);
    
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([messageElement])
            .catch((err) => console.error('MathJax error:', err));
    } else {
        console.warn('MathJax not fully loaded yet');
    }
}

    function scrollChatToBottom() {
        const chatMessagesContainer = document.getElementById('chatMessages');
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    async function selectNoteById(noteId) {
    noteId = parseInt(noteId, 10);
    if (isNaN(noteId)) {
        console.error('Invalid note ID');
        return;
    }

    let foundCourse;
    let foundNote;

    // Cherchez la note dans tous les cours mis en cache
    for (const courseId in dataCache.courseNotes) {
        foundNote = dataCache.courseNotes[courseId].find(n => n.id === noteId);
        if (foundNote) {
            foundCourse = dataCache.courses.find(c => c.id === parseInt(courseId, 10));
            break;
        }
    }

    // Si la note n'est pas trouvée dans le cache, essayez de la récupérer du serveur
    if (!foundNote) {
        try {
            const response = await fetch(`/api/notes/${noteId}/`);
            if (!response.ok) throw new Error('Note not found');
            foundNote = await response.json();
            // Trouvez le cours correspondant
            foundCourse = dataCache.courses.find(c => c.id === foundNote.course);
        } catch (error) {
            console.error('Error fetching note:', error);
            alert('Impossible de trouver la note demandée.');
            return;
        }
    }

    if (foundCourse && foundNote) {
        // Chargez les notes du cours si elles ne sont pas déjà en cache
        if (!dataCache.courseNotes[foundCourse.id]) {
            await fetchCourseNotes(foundCourse.id, foundCourse.subject_name);
        }

        // Mettez à jour currentCourseId avant de sélectionner la note
        currentCourseId = foundCourse.id;

        // Sélectionnez la note
        await selectNote(foundNote);
        // Mettez à jour l'interface utilisateur si nécessaire
        updateCurrentCourseTitle(foundCourse.subject_name);
        toggleView('editor');
    } else {
        console.error('Course or note not found');
        alert('Impossible de trouver le cours ou la note demandée.');
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

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';

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
            updateNoteInCache(selectedNote);
            alert('Fichier uploadé avec succès!');
        } else if (data.error) {
            throw new Error(data.error);
        } else {
            throw new Error('Réponse inattendue du serveur');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        alert(`Erreur lors de l'upload du fichier : ${error.message}`);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

    function updateNoteInCache(updatedNote) {
        const courseNotes = dataCache.courseNotes[currentCourseId];
        const noteIndex = courseNotes.findIndex(note => note.id === updatedNote.id);
        if (noteIndex !== -1) {
            courseNotes[noteIndex] = updatedNote;
            renderNotes(currentCourseId);
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

    function updateNavigationButtons() {
        const prevButton = document.getElementById('prevAttachment');
        const nextButton = document.getElementById('nextAttachment');

        prevButton.style.display = currentAttachmentIndex > 0 ? 'block' : 'none';
        nextButton.style.display = currentAttachmentIndex < currentAttachments.length - 1 ? 'block' : 'none';
    }

    function navigateAttachment(direction) {
        if (direction === 'prev' && currentAttachmentIndex > 0) {
            currentAttachmentIndex--;
        } else if (direction === 'next' && currentAttachmentIndex < currentAttachments.length - 1) {
            currentAttachmentIndex++;
        }
        renderAttachment(currentAttachments[currentAttachmentIndex]);
        updateNavigationButtons();
    }

    function closeMediaOverlay() {
        document.getElementById('mediaOverlay').style.display = 'none';
    }

    async function handleSearch() {
        const query = document.getElementById('searchInput').value;
        if (query.length < 4) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/notes/search/?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            renderSearchResults(results);
        } catch (error) {
            console.error('Error searching:', error);
        }
    }

    function renderSearchResults(results) {
    const searchResultsContainer = document.getElementById('searchResults');
    searchResultsContainer.innerHTML = '';
    results.forEach(result => {
        const li = document.createElement('li');
        li.innerHTML = `
            <h4>${result.title}</h4>
            <p>${result.content_preview}</p>
        `;
        li.addEventListener('click', () => {
            selectNoteById(result.id);
            toggleSearch(); // Ferme l'overlay de recherche
        });
        searchResultsContainer.appendChild(li);
    });
}

    function getCsrfToken() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            .split('=')[1];
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async function handleAddHomeworkSubmit(event) {
        event.preventDefault();
        const title = document.getElementById('homeworkTitle').value;
        const description = document.getElementById('homeworkDescription').value;
        const dueDate = document.getElementById('homeworkDueDate').value;
        const courseId = document.getElementById('homeworkCourse').value;

        try {
            const response = await fetch('/api/homeworks/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({
                    title,
                    description,
                    due_date: dueDate,
                    course: courseId
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de l\'ajout du devoir');
            }

            event.target.reset();
            switchView('homework');
            await fetchHomework(courseId);
        } catch (error) {
            console.error('Erreur lors de l\'ajout du devoir:', error);
            alert('Une erreur est survenue lors de l\'ajout du devoir');
        }
    }

    function showAddHomeworkForm() {
        switchView('addHomework');
    }

    function backToHomeworkView() {
        switchView('homework');
    }

    function renderHomework() {
    const upcomingHomework = document.getElementById('upcomingHomework');
    const pastHomework = document.getElementById('pastHomework');
    upcomingHomework.innerHTML = '';
    pastHomework.innerHTML = '';

    const now = new Date();

    dataCache.homework[currentCourseId].forEach(hw => {
        const li = document.createElement('li');
        const dueDate = new Date(hw.due_date);
        const isPast = dueDate < now;

        li.innerHTML = `
            <h4>${hw.title}</h4>
            <p>Date limite: ${dueDate.toLocaleDateString()}</p>
            <p>${hw.description || ''}</p>
            ${isPast ? `
                <div class="attachment-section">
                    ${hw.is_corrected ? `
                        <div class="homework-analyzed">
                            <span class="checkmark">✓</span>
                            Partagé avec votre enseignant
                        </div>
                    ` : `
                        <input type="file" id="attachment-${hw.id}" class="attachment-input" multiple accept="image/*">
                        <button class="analyze-attachment" data-homework-id="${hw.id}">Analyser les images</button>
                    `}
                </div>
            ` : ''}
        `;

        if (isPast) {
            pastHomework.appendChild(li);
        } else {
            upcomingHomework.appendChild(li);
        }
    });

    document.querySelectorAll('.analyze-attachment').forEach(button => {
        button.addEventListener('click', (e) => {
            const homeworkId = e.target.getAttribute('data-homework-id');
            uploadAttachment(homeworkId);
        });
    });
}

    async function uploadAttachment(homeworkId) {
    const fileInput = document.getElementById(`attachment-${homeworkId}`);
    const files = fileInput.files;

    if (files.length === 0) {
        alert('Veuillez sélectionner au moins un fichier à analyser.');
        return;
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('attachments', files[i]);
    }

    try {
        const response = await fetch(`/api/homeworks/${homeworkId}/analyze_attachments/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCsrfToken(),
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erreur lors de l\'analyse des images');
        }

        const result = await response.json();
        alert('Images analysées avec succès. L\'enseignant a été notifié des résultats de l\'analyse.');
        

        // Mise à jour de l'interface utilisateur
        updateHomeworkStatus(homeworkId);
    } catch (error) {
        console.error('Erreur lors de l\'analyse des images:', error);
        alert('Une erreur est survenue lors de l\'analyse des images : ' + error.message);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

function updateHomeworkStatus(homeworkId) {
    const attachmentSection = document.querySelector(`#attachment-${homeworkId}`).closest('.attachment-section');
    if (attachmentSection) {
        attachmentSection.innerHTML = `
            <div class="homework-analyzed">
                <span class="checkmark">✓</span>
                partagé avec votre enseignant
            </div>
        `;
    }

    // Mise à jour du cache
    const homework = dataCache.homework[currentCourseId].find(hw => hw.id === parseInt(homeworkId));
    if (homework) {
        homework.is_corrected = true;
    }
}

    async function fetchHomework(courseId, status = 'all') {
        try {
            let url = `/api/homeworks/?course_id=${courseId}&include_attachments=true`;
            if (status !== 'all') {
                url += `&status=${status}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des devoirs');
            }
            dataCache.homework[courseId] = await response.json();
            renderHomework();
        } catch (error) {
            console.error('Erreur lors de la récupération des devoirs:', error);
            dataCache.homework[courseId] = [];
        }
    }

    // Fonction pour charger les tâches d'un cours spécifique
async function fetchTodos(courseId) {
    if (!dataCache.todos[courseId]) {
        try {
            const response = await fetch(`/api/todo-items/?course_id=${courseId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des todos');
            }
            dataCache.todos[courseId] = await response.json();
        } catch (error) {
            console.error('Erreur lors de la récupération des todos:', error);
            dataCache.todos[courseId] = [];
        }
    }
    renderTodos(courseId);
    return dataCache.todos[courseId];
}

    // Fonction pour rendre les tâches dans l'interface
function renderTodos(courseId) {
    const todoList = document.getElementById('todoList');
    todoList.innerHTML = '';
    if (!dataCache.todos[courseId] || !Array.isArray(dataCache.todos[courseId])) {
        todoList.innerHTML = '<li>Chargement des tâches...</li>';
        return;
    }
    dataCache.todos[courseId].forEach(todo => {
        const li = document.createElement('li');
        li.innerHTML = `
            <input type="checkbox" ${todo.completed ? 'checked' : ''} disabled>
            <span>${todo.content}</span>
            <button class="start-task-btn" data-todo-id="${todo.id}">Commencer la tâche</button>
        `;
        todoList.appendChild(li);
    });

    // Ajouter des écouteurs d'événements pour les boutons "Commencer la tâche"
    document.querySelectorAll('.start-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const todoId = parseInt(e.target.getAttribute('data-todo-id'), 10);
            openChatWithTodo(todoId);
        });
    });
}

    // Fonction pour ouvrir le chat avec les tâches sélectionnées
    async function openChatWithTodo(todoId) {
        const todo = dataCache.todos[currentCourseId].find(t => t.id === todoId);
        currentTodoId = todoId;
        if (!todo) {
            console.error('Tâche non trouvée');
            return;
        }

        try {
            const response = await fetch('/api/chat/start_session/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({ 
                    is_task_session: true,
                    task_id: todoId
                }),
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors du démarrage de la session');
            }
            
            const data = await response.json();
            currentSessionId = data.session_id;

            const initialMessage = `
            Nous allons travailler sur la tâche suivante :
            ${todo.content}

            Instructions pour l'IA :
            1. Guide l'élève à travers cette tâche.
            2. Pose des questions pour vérifier la compréhension de l'élève.
            3. Fournis des explications si nécessaire, mais encourage l'élève à trouver les réponses par lui-même.
            4. À la fin de la tâche, demande à l'élève s'il a compris et terminé la tâche.

            Commençons : Comment puis-je t'aider avec cette tâche ?
                    `;
            
            toggleTodo();
            toggleChat();
            handleChatSubmit(initialMessage);

            // Rendre le bouton "Finir la tâche" visible
            const finishTaskBtn = document.getElementById('finishTaskBtn');
            if (finishTaskBtn) {
                finishTaskBtn.style.display = 'inline-block';
            }
        } catch (error) {
            console.error('Erreur lors de l ouverture du chat:', error);
            alert('Une erreur est survenue lors de l ouverture du chat pour cette tâche.');
        }
}

    async function endChatSession() {
        if (currentSessionId) {
            try {
                await fetch('/api/chat/end_session/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    body: JSON.stringify({ session_id: currentSessionId }),
                });
                currentSessionId = null;
                document.getElementById('chatMessages').innerHTML = '';
            } catch (error) {
                console.error('Error ending chat session:', error);
            }
        }
    }

    function renderErrorMessage(errorMessage) {
        const errorElement = document.createElement('div');
        errorElement.className = 'chat-message error';
        errorElement.textContent = errorMessage;
        document.getElementById('chatMessages').appendChild(errorElement);
        scrollChatToBottom();
    }

    

    function createOptions(container, options, type, isMatiere = false) {
        container.innerHTML = '';
        options.forEach(option => {
            const label = document.createElement('label');
            label.className = 'option-button';
            if (isMatiere) {
                label.innerHTML = `
                    <input type="radio" name="subject_id" value="${option.id}">
                    ${getSubjectIcon(option.name)}
                    <span>${option.name}</span>
                `;
            } else {
                label.innerHTML = `
                    <input type="checkbox" name="course_types" value="${option.name}"> 
                    <span>${option.name}</span>  
                `;
            }
            container.appendChild(label);
        });
    }

    async function fetchSubjects() {
        try {
            const response = await fetch('/monespace/espacenote/subjects/');
            const subjects = await response.json();
            return subjects;
        } catch (error) {
            console.error('Erreur lors de la récupération des matières:', error);
            return [];
        }
    }
     
    function getSubjectIcon(subjectName) {
        const icons = {
        'Mathématiques': '🧮',
        'Français': '📚',
        'Anglais': '🇬🇧',
        'Physique': '⚛️',
        'Chimie': '🧪',
        'Aide aux devoirs': '📝',
        'Allemand': '🇩🇪',
        'Comptabilité': '💼',
        'Droit': '⚖️',
        'Économie': '📊',
        'Histoire': '🏛️',
        'Coaching': '🏆',
        'Orientation': '🧭',
        'Espagnol': '🇪🇸',
        'SVT/Biologie': '🧬',
        'SVT': '🧬',
        'Cours de musique': '🎵',
        'Cours de dessin': '🎨',
        'Cours de théâtre': '🎭',
        'Informatique': '💻',
        'Méthodologie': '📝',
    };
        return `<div class="subject-icon">${icons[subjectName] || '📚'}</div>`;
    }

    addCourseBtn.addEventListener('click', async () => {
        const subjects = await fetchSubjects();
        createOptions(document.getElementById('matiereOptions'), subjects, 'radio', true);
        createOptions(document.getElementById('typeCoursOptions'), typesCours, 'checkbox');
        addCourseOverlay.style.display = 'flex';
    });

    closeOverlayBtn.addEventListener('click', () => {
        addCourseOverlay.style.display = 'none';
        step1.style.display = 'block';
        step2.style.display = 'none';
    });

    step1.querySelector('.next-button1').addEventListener('click', () => {
        step1.style.display = 'none';
        step2.style.display = 'block';
    });

    step2.querySelector('.prev-button1').addEventListener('click', () => {
        step2.style.display = 'none';
        step1.style.display = 'block';
    });

    addCourseForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        
        try {
            const response = await fetch('add-course/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                },
            });
            const data = await response.json();
            if (data.success) {
                console.log('Cours ajouté avec succès');
                dataCache.courses.push(data.course);
                window.location.reload();
                addCourseOverlay.style.display = 'none';
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout du cours:', error);
            alert('Erreur lors de l\'ajout du cours: ' + error.message);
        } finally {
            this.reset();
            step1.style.display = 'block';
            step2.style.display = 'none';
        }
    });

    function initSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        const toggleBtn = document.getElementById('toggleSidebarBtn');

        if (window.innerWidth <= 768) {
            sidebar.classList.add('hidden');
            sidebar.style.left = '-250px';
            mainContent.style.marginLeft = '0';
            toggleBtn.style.left = '10px';
            sidebarVisible = false;
        } else {
            sidebar.classList.remove('hidden');
            sidebar.style.left = '0';
            mainContent.style.marginLeft = '250px';
            toggleBtn.style.left = '260px';
            sidebarVisible = true;
        }
    }

    // Adapter la mise en page lors du redimensionnement de la fenêtre
    window.addEventListener('resize', function() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        const toggleBtn = document.getElementById('toggleSidebarBtn');
    
        if (window.innerWidth > 768) {
            if (sidebarVisible) {
                mainContent.style.marginLeft = '250px';
                toggleBtn.style.left = '260px';
            }
        } else {
            mainContent.style.marginLeft = '0';
            if (sidebarVisible) {
                toggleBtn.style.left = '260px';
            }
        }
    });

    // Ajouter un gestionnaire d'événements pour la fermeture de la fenêtre
    window.addEventListener('beforeunload', endChatSession);
});
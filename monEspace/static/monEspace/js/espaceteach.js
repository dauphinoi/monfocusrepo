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
    let sidebarVisible = true;
    let currentAttachmentIndex = 0;
    let currentAttachments = [];
    let currentView = 'tasks';

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
        
        toggleSidebarBtn.addEventListener('click', toggleSidebar);
        document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
        document.getElementById('todoBtn').addEventListener('click', toggleTodo);
        document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
        document.getElementById('addImageBtn').addEventListener('click', () => triggerFileInput('image'));
        document.getElementById('addVideoBtn').addEventListener('click', () => triggerFileInput('video'));
        document.getElementById('addAudioBtn').addEventListener('click', () => triggerFileInput('audio'));
        document.getElementById('closeMediaBtn').addEventListener('click', closeMediaOverlay);
        document.getElementById('fileInput').addEventListener('change', handleFileUpload);
        document.getElementById('courseViewBtn').addEventListener('click', showCourseView);

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
                fetchHomeworks(currentCourseId);
            }
        } else {
            todoSidebar.style.display = 'none';
            todoSidebar.classList.remove('open');
            toggleOverlayBackground(false);
        }
    }

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
            dataCache.homework[courseId] = { upcoming: [], past: [] };
            renderHomeworks();
            return;
        }

        try {
            const upcomingResponse = await fetch(`/api/homeworks/?course=${courseId}&status=upcoming`);
            const pastResponse = await fetch(`/api/homeworks/?course=${courseId}&status=past`);

            if (!upcomingResponse.ok || !pastResponse.ok) {
                throw new Error('Erreur lors de la récupération des devoirs');
            }

            dataCache.homework[courseId] = {
                upcoming: await upcomingResponse.json(),
                past: await pastResponse.json()
            };
            
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
        
        if (dataCache.homework[currentCourseId]) {
            dataCache.homework[currentCourseId].upcoming.forEach(homework => {
                upcomingList.appendChild(createHomeworkItem(homework));
            });
            
            dataCache.homework[currentCourseId].past.forEach(homework => {
                pastList.appendChild(createHomeworkItem(homework));
            });
        }

        showHomeworkList();
    }

    function showHomeworkDetails(homework) {
        const detailsDiv = document.getElementById('homeworkDetails');
        const listDiv = document.getElementById('homeworkList');

        document.getElementById('homeworkTitle').textContent = homework.title;
        document.getElementById('homeworkDescription').textContent = homework.description || 'Aucune description disponible';
        document.getElementById('homeworkDueDate').textContent = `Date limite : ${new Date(homework.due_date).toLocaleDateString()}`;
        document.getElementById('homeworkStatus').textContent = `Statut : ${homework.is_corrected ? 'Corrigé' : 'Non corrigé'}`;

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

    async function fetchTodos(courseId) {
        if (!courseId) {
            dataCache.todos[courseId] = [];
            renderTodos();
            return;
        }

        if (dataCache.todos[courseId]) {
            renderTodos();
            return;
        }

        try {
            const response = await fetch(`/api/todo-items/?course=${courseId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des todos');
            }
            dataCache.todos[courseId] = await response.json();
            
            renderTodos();
        } catch (error) {
            console.error('Erreur lors de la récupération des todos:', error);
        }
    }

    function renderTodos() {
        const todoList = document.getElementById('todoList');
        todoList.innerHTML = '';
        if (dataCache.todos[currentCourseId]) {
            dataCache.todos[currentCourseId].forEach(todo => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <input type="checkbox" ${todo.completed ? 'checked' : ''}>
                    <span>${todo.content}</span>
                `;
                li.querySelector('input').addEventListener('change', () => toggleTodoCompletion(todo.id));
                todoList.appendChild(li);
            });
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
                throw new Error('Erreur lors de la suppression du todo');
            }
            dataCache.todos[currentCourseId] = dataCache.todos[currentCourseId].filter(todo => todo.id !== todoId);
            renderTodos();
        } catch (error) {
            console.error('Erreur lors de la suppression du todo:', error);
        }
    }

    function getCsrfToken() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            .split('=')[1];
    }

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
});
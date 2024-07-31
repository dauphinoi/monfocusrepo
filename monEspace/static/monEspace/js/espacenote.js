document.addEventListener('DOMContentLoaded', function() {
    let allNotes = [];
    let courseNotes = [];
    let recentNotes = [];
    let selectedNote = null;
    let currentCourseId = null;
    let chatHistory = [];
    let currentTodos = [];
    let currentSessionId = null;
    let todoPromptShown = false;
    let sidebarVisible = true;
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const cancelResetBtn = document.getElementById('cancelReset');
    const resetPasswordForm = document.getElementById('resetPasswordForm');

    // Initialisation
    initTinyMCE();
    fetchAllNotes();
    setupEventListeners();
    checkPendingTodos();

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
        // Ajoutez ces nouveaux écouteurs
    resetPasswordBtn.addEventListener('click', function() {
        resetPasswordModal.style.display = 'block';
    });

    cancelResetBtn.addEventListener('click', function() {
        resetPasswordModal.style.display = 'none';
    });

    resetPasswordForm.addEventListener('submit', handleResetPasswordSubmit);

    // Fermer le modal si on clique en dehors
    window.addEventListener('click', function(event) {
        if (event.target === resetPasswordModal) {
            resetPasswordModal.style.display = 'none';
        }
    });
        toggleSidebarBtn.addEventListener('click', toggleSidebar);
        document.getElementById('deleteNoteBtn').addEventListener('click', confirmDeleteNote);
        document.getElementById('courseViewBtn').addEventListener('click', showCourseView);
        document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
        document.getElementById('searchBtn').addEventListener('click', toggleSearch);
        document.getElementById('chatBtn').addEventListener('click', toggleChat);
        document.getElementById('todoBtn').addEventListener('click', toggleTodo);
        document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
        document.getElementById('addImageBtn').addEventListener('click', () => triggerFileInput('image'));
        document.getElementById('addVideoBtn').addEventListener('click', () => triggerFileInput('video'));
        document.getElementById('addAudioBtn').addEventListener('click', () => triggerFileInput('audio'));
        document.getElementById('closeChatBtn').addEventListener('click', toggleChat);
        document.getElementById('sendChatBtn').addEventListener('click', function(e) {
            e.preventDefault();
            handleChatSubmit();
        });
        document.getElementById('closeMediaBtn').addEventListener('click', closeMediaOverlay);
        document.getElementById('fileInput').addEventListener('change', handleFileUpload);
        document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
        document.getElementById('chatInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleChatSubmit();
            }
        });

        document.querySelectorAll('.course-item').forEach(item => {
            item.addEventListener('click', () => {
                const courseId = item.getAttribute('data-course-id');
                if (courseId && courseId !== 'null') {
                    const courseName = item.querySelector('h3').textContent;
                    fetchCourseNotes(courseId, courseName);
                } else {
                    console.error('Invalid course ID');
                }
            });
        });
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
            if (data.success) {
                alert('Un email de réinitialisation a été envoyé à ' + email);
            } else {
                alert('Erreur : ' + data.message);
            }
        } catch (error) {
            console.error('Erreur lors de la demande de réinitialisation:', error);
            alert('Une erreur est survenue lors de la demande de réinitialisation.');
        }
    
        resetPasswordModal.style.display = 'none';
    }

    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        const toggleBtn = document.getElementById('toggleSidebarBtn');
        
        sidebarVisible = !sidebarVisible;
        
        if (sidebarVisible) {
            sidebar.classList.remove('hidden');
            sidebar.style.left = '0';
            if (window.innerWidth > 768) {
                mainContent.style.marginLeft = '250px';
            }
            toggleBtn.style.left = '260px';
        } else {
            sidebar.classList.add('hidden');
            sidebar.style.left = '-250px';
            mainContent.style.marginLeft = '0';
            toggleBtn.style.left = '10px';
        }
    
        // Ne modifiez pas directement la visibilité des éléments internes de la sidebar ici
    }
    
    function hideSidebarOnSmallScreen() {
        // if (window.innerWidth <= 768) {
        //     const sidebar = document.querySelector('.sidebar');
        //     sidebar.classList.remove('show');
        // }
    }
    

    function showCourseView() {
        toggleView('courses');
        recentNotes = [];
        selectedNote = null;
        currentCourseId = null;
        document.getElementById('currentCourseTitle').textContent = '';
    }

    // Nouvelle fonction pour confirmer la suppression
function confirmDeleteNote() {
    if (selectedNote) {
        if (confirm("Voulez-vous vraiment supprimer cette note ?")) {
            deleteNote(selectedNote.id);
        }
    } else {
        alert("Veuillez d'abord sélectionner une note à supprimer.");
    }
}

// Nouvelle fonction pour supprimer la note
async function deleteNote(noteId) {
    try {
        const response = await fetch(`/api/notes/${noteId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCsrfToken(),
            },
        });

        if (response.ok) {
            // Supprimer la note de la liste des notes du cours
            courseNotes = courseNotes.filter(note => note.id !== noteId);
            
            // Mettre à jour les notes récentes
            updateRecentNotes();
            
            // Sélectionner la note suivante s'il y en a une
            if (recentNotes.length > 0) {
                selectNote(recentNotes[0]);
            } else {
                // S'il n'y a plus de notes, réinitialiser l'éditeur
                selectedNote = null;
                document.getElementById('noteTitle').textContent = '';
                tinymce.get('editor').setContent('');
                document.getElementById('attachments').innerHTML = '';
            }
            
            // Mettre à jour l'affichage
            renderNotes();
            alert('Note supprimée avec succès');
        } else {
            throw new Error('Erreur lors de la suppression de la note');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de la note:', error);
        alert('Erreur lors de la suppression de la note');
    }
}

    async function fetchAllNotes() {
        try {
            const response = await fetch('/api/notes/');
            allNotes = await response.json();
        } catch (error) {
            console.error('Error fetching all notes:', error);
        }
    }

    async function fetchCourseNotes(courseId, courseName) {
        try {
            currentCourseId = courseId;
            const response = await fetch(`/api/notes/course_notes/?course_id=${courseId}`);
            courseNotes = await response.json();
            updateRecentNotes();
            renderNotes();
            updateCurrentCourseTitle(courseName);
            toggleView('notes');
            fetchTodos(courseId);
            checkPendingTodos();
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
            const noteElement = createNoteElement(note);
            allNotesList.appendChild(noteElement);
        });
    }

    function renderRecentNotes() {
        const recentNotesList = document.getElementById('recentNotesList');
        recentNotesList.innerHTML = '';
        recentNotes.forEach(note => {
            const noteElement = createNoteElement(note);
            recentNotesList.appendChild(noteElement);
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
        hideSidebarOnSmallScreen();
    }

    function renderAttachments(attachments) {
        console.log(' renderinAttachments:', attachments);
        const attachmentsContainer = document.getElementById('attachments');
        attachmentsContainer.innerHTML = '';
        if (attachments && attachments.length > 0) {
            attachments.forEach(attachment => {
                const button = document.createElement('button');
                button.innerHTML = `
                    <span class="icon">
                        ${attachment.file_type === 'image' ? '🖼️' : 
                        attachment.file_type === 'video' ? '🎥' : 
                        attachment.file_type === 'audio' ? '🎵' : 
                        '📎'}
                    </span>
                    ${attachment.file.split('/').pop()}
                `;
                button.addEventListener('click', () => handleAttachmentClick(attachment));
                attachmentsContainer.appendChild(button);
            });
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
        const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
        const courseGrid = document.getElementById('courseGrid');
        const noteContent = document.getElementById('noteContent');
        const allNotesList = document.getElementById('allNotesList');
        const todoSidebar = document.getElementById('todoSidebar');
        const notetitle = document.getElementById('noteTitle');
        const recentNotesList = document.getElementById('recentNotesList');
        
        switch(view) {
            case 'courses':
                toggleSidebarBtn.style.display = 'block';
                courseGrid.style.display = 'grid';
                noteContent.style.display = 'none';
                allNotesList.style.display = 'none';
                todoSidebar.style.display = 'none';
                notetitle.style.display = 'none';
                recentNotesList.style.display = 'none';
                break;
            case 'notes':
                toggleSidebarBtn.style.display = 'block';
                courseGrid.style.display = 'none';
                noteContent.style.display = 'none';
                allNotesList.style.display = 'block';
                // todoSidebar.style.display = 'block';
                recentNotesList.style.display = 'block';
                break;
            case 'editor':
                toggleSidebarBtn.style.display = 'block';
                courseGrid.style.display = 'none';
                noteContent.style.display = 'block';
                allNotesList.style.display = 'block';
                todoSidebar.style.display = 'none';
                recentNotesList.style.display = 'block';
                break;
        }
    }

    function toggleSearch() {
        const searchOverlay = document.getElementById('searchOverlay');
        searchOverlay.style.display = searchOverlay.style.display === 'none' ? 'flex' : 'none';
    }

    function toggleChat() {
        const chatOverlay = document.querySelector('.chat-overlay');
        if (chatOverlay.style.display === 'none') {
            chatOverlay.style.display = 'flex';
            if (!currentSessionId) {
                console.log("Pas de session active, démarrage d'une nouvelle session");
                startNewChatSession();
            } else {
                console.log("Session active, affichage de l'historique");
                if (chatHistory && chatHistory.length > 0) {
                    renderChatHistory();
                }
            }
        } else {
            chatOverlay.style.display = 'none';
        }
    }

    function toggleTodo() {
        const todoSidebar = document.getElementById('todoSidebar');
        if (todoSidebar.style.display === 'none') {
            todoSidebar.style.display = 'block';
            if (currentCourseId) {
                renderTodos();
            }
        } else {
            todoSidebar.style.display = 'none';
        }
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
            let currentMathExpression = '';
            let isInsideMathExpression = false;
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
                            for (let i = 0; i < data.content.length; i++) {
                                if (data.content[i] === '$') {
                                    if (isInsideMathExpression) {
                                        // Fin d'une expression mathématique
                                        currentMathExpression += '$';
                                        aiResponseContent += renderMathExpression(currentMathExpression);
                                        currentMathExpression = '';
                                        isInsideMathExpression = false;
                                    } else {
                                        // Début d'une expression mathématique
                                        isInsideMathExpression = true;
                                        currentMathExpression = '$';
                                    }
                                } else if (isInsideMathExpression) {
                                    currentMathExpression += data.content[i];
                                } else {
                                    aiResponseContent += data.content[i];
                                }
                            }
    
                            if (!aiMessageElement) {
                                aiMessageElement = document.createElement('div');
                                aiMessageElement.className = 'chat-message ai';
                                aiMessageElement.innerHTML = '<div class="message-content"></div>';
                                document.getElementById('chatMessages').appendChild(aiMessageElement);
                            }
    
                            const contentElement = aiMessageElement.querySelector('.message-content');
                            contentElement.innerHTML = `<p>${aiResponseContent}</p>`;
                            
                            if (!isInsideMathExpression) {
                                // Appliquer MathJax seulement si on n'est pas au milieu d'une expression mathématique
                                if (window.MathJax && window.MathJax.typesetPromise) {
                                    window.MathJax.typesetPromise([contentElement])
                                        .catch((err) => console.error('MathJax error:', err));
                                }
                            }
                            
                            scrollChatToBottom();
                        }
                    }
                }
            }
    
            // Gérer toute expression mathématique non terminée à la fin
            if (isInsideMathExpression) {
                aiResponseContent += renderMathExpression(currentMathExpression);
            }
    
            addMessageToHistory('ai', aiResponseContent, source);
            finalizeAIMessageInUI(aiResponseContent, source);
    
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
            renderErrorMessage("Une erreur est survenue lors de l'envoi du message. Veuillez réessayer.");
        }
    }
    
    function renderMathExpression(expression) {
        // Remplacer les symboles spéciaux par leur équivalent LaTeX
        expression = expression
            .replace(/∀/g, '\\forall ')
            .replace(/∃/g, '\\exists ')
            .replace(/ℝ/g, '\\mathbb{R}')
            .replace(/ℂ/g, '\\mathbb{C}')
            .replace(/∈/g, '\\in ')
            .replace(/≥/g, '\\geq ');
    
        // Autres remplacements au besoin...
    
        return expression;
    }
    
    function finalizeAIMessageInUI(content, source) {
        const aiMessageElement = document.querySelector('.chat-message.ai:last-child');
        if (!aiMessageElement) return;
    
        // Ajouter la source si elle existe
        if (source) {
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
    
        // Appliquer MathJax une dernière fois sur tout le contenu
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([aiMessageElement])
                .catch((err) => console.error('MathJax error:', err));
        }
    
        scrollChatToBottom();
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
                console.log("source of the message:", message.source);
                renderAIMessage(message.content, message.source);
            }
        });
    }

    function renderUserMessage(content) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message user';
        messageElement.innerHTML = `<div class="message-content"><p>${content}</p></div>`;
        document.getElementById('chatMessages').appendChild(messageElement);
        scrollChatToBottom();
    }

    function renderAIMessage(content, source) {
        console.log('Rendering AI message:', content, source);
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message ai';
        let sourceHtml = '';
        
        if (source) {
            console.log('Source typ:', source);
            sourceHtml = `<p class="source"><a href="#" data-note-id="${source}">Source (Note)</a></p>`;
        }
        
        messageElement.innerHTML = `
            <div class="message-content">
                <p>${content}</p>
                ${sourceHtml}
            </div>
        `;
        
        if (source) {
            const sourceLink = messageElement.querySelector('a[data-note-id]');
            if (sourceLink) {
                sourceLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    selectNoteById(source);
                });
            }
        }
        
        document.getElementById('chatMessages').appendChild(messageElement);
        // Utilisez une approche plus sûre pour appeler MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([messageElement])
            .catch((err) => console.error('MathJax error:', err));
    } else {
        console.warn('MathJax not fully loaded yet');
    }
        scrollChatToBottom();
    }

    function updateAIMessageInUI(content, source) {
        let aiMessageElement = document.querySelector('.chat-message.ai:last-child');
        if (!aiMessageElement) {
            aiMessageElement = document.createElement('div');
            aiMessageElement.className = 'chat-message ai';
            document.getElementById('chatMessages').appendChild(aiMessageElement);
        }
        
        aiMessageElement.innerHTML = `
            <div class="message-content">
                <p>${content}</p>
                ${source ? `<p class="source"><a href="#" data-note-id="${source}">Source</a></p>` : ''}
            </div>
        `;
        
        if (source) {
            const sourceLink = aiMessageElement.querySelector('a[data-note-id]');
            sourceLink.addEventListener('click', function(e) {
                e.preventDefault();
                selectNoteById(source);
            });
        }

        scrollChatToBottom();
    }

    function scrollChatToBottom() {
        const chatMessagesContainer = document.getElementById('chatMessages');
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function selectNoteById(noteId) {
        const note = allNotes.find(n => n.id === noteId);
        if (note) {
            fetchCourseNotes(note.course, '');
            selectNote(note);
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
            } else {
                console.error('Error uploading file:', data.error);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    }

    function handleAttachmentClick(attachment) {
        const mediaOverlay = document.getElementById('mediaOverlay');
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
    
        mediaOverlay.style.display = 'flex';
    }

    function closeMediaOverlay() {
        document.getElementById('mediaOverlay').style.display = 'none';
    }

    async function handleSearch() {
        console.log('Searching...');
        const query = document.getElementById('searchInput').value;
        if (query.length < 4) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/notes/search/?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            console.log('Search results:', results);
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
                toggleSearch();
            });
            searchResultsContainer.appendChild(li);
        });
    }

    function updateCurrentCourseTitle(courseName) {
        document.getElementById('currentCourseTitle').textContent = courseName;
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

    async function fetchTodos(courseId) {
        try {
            const response = await fetch(`/api/todo-items/?course_id=${courseId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des todos');
            }
            currentTodos = await response.json();
            renderTodos();
            return currentTodos;
        } catch (error) {
            console.error('Erreur lors de la récupération des todos:', error);
            return [];
        }
    }

    function renderTodos() {
        const todoList = document.getElementById('todoList');
        todoList.innerHTML = '';
        currentTodos.forEach(todo => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" ${todo.completed ? 'checked' : ''} disabled>
                <span>${todo.content}</span>
            `;
            todoList.appendChild(li);
        });
    }

    async function checkPendingTodos() {
        if (todoPromptShown) return;
        const allTodos = await fetchTodos(currentCourseId);
        const pendingTodos = allTodos.filter(todo => !todo.completed);
        if (pendingTodos.length > 0) {
            showTodoPrompt(pendingTodos);
            todoPromptShown = true;
        }
    }

    function showTodoPrompt(todos) {
        const overlay = document.createElement('div');
        overlay.className = 'todo-prompt-overlay';
        overlay.innerHTML = `
            <div class="todo-prompt-content">
                <h2>Bonjour ${userFirstName} 👋</h2>
                <p>Vous avez ${todos.length} tâche${todos.length > 1 ? 's' : ''} en attente.</p>
                <p>Souhaitez-vous les accomplir maintenant avec l'aide de l'IA ?</p>
                <div class="todo-prompt-buttons">
                    <button id="acceptTodoPrompt" class="todo-prompt-button accept">Oui, allons-y !</button>
                    <button id="declineTodoPrompt" class="todo-prompt-button decline">Plus tard</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const style = document.createElement('style');
        style.textContent = `
            .todo-prompt-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .todo-prompt-content {
                background-color: #ffffff;
                padding: 2rem;
                border-radius: 15px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                text-align: center;
                max-width: 400px;
                width: 90%;
            }
            .todo-prompt-content h2 {
                color: #4a4a4a;
                margin-bottom: 1rem;
            }
            .todo-prompt-content p {
                color: #6a6a6a;
                margin-bottom: 1.5rem;
            }
            .todo-prompt-buttons {
                display: flex;
                justify-content: space-around;
            }
            .todo-prompt-button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 5px;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .todo-prompt-button.accept {
                background-color: #4CAF50;
                color: white;
            }
            .todo-prompt-button.decline {
                background-color: #f44336;
                color: white;
            }
            .todo-prompt-button:hover {
                opacity: 0.9;
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);

        document.getElementById('acceptTodoPrompt').addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            openChatWithTodos(todos);
        });

        document.getElementById('declineTodoPrompt').addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
        });
    }

    function openChatWithTodos(todos) {
        const todoList = todos.map(todo => `- ${todo.content}`).join('\n');
        const initialMessage = `
    Voici les tâches que nous allons accomplir ensemble :
    ${todoList}
    
    Instructions pour l'IA :
    1. Guide l'élève à travers chaque tâche une par une.
    2. Pose des questions pour vérifier la compréhension de l'élève.
    3. Fournis des explications si nécessaire, mais encourage l'élève à trouver les réponses par lui-même.
    4. À la fin de chaque tâche, demande à l'élève s'il a compris et terminé la tâche.
    
    Commençons : Par quelle tâche voulez-vous commencer ?
        `;
        
        toggleChat();
        handleChatSubmit(initialMessage);
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

    // Gestion des clics en dehors des overlays
    document.addEventListener('mousedown', function(event) {
        const searchOverlay = document.getElementById('searchOverlay');
        const chatOverlay = document.querySelector('.chat-overlay');
        const todoSidebar = document.getElementById('todoSidebar');

        if (!searchOverlay.contains(event.target) && event.target !== document.getElementById('searchBtn')) {
            searchOverlay.style.display = 'none';
        }
        if (!chatOverlay.contains(event.target) && event.target !== document.getElementById('chatBtn')) {
            chatOverlay.style.display = 'none';
        }
        if (!todoSidebar.contains(event.target) && event.target !== document.getElementById('todoBtn')) {
            todoSidebar.style.display = 'none';
        }
    });

     // Gestion de l'ajout de cours
     const addCourseBtn = document.getElementById('addCourseBtn');
     const addCourseOverlay = document.getElementById('addCourseOverlay');
     const closeOverlayBtn = document.getElementById('closeOverlayBtn');
     const addCourseForm = document.getElementById('addCourseForm');
     const step1 = document.getElementById('step1');
     const step2 = document.getElementById('step2');
 
     // Liste complète des matières
     const toutesLesMatières = [
         {id: 1, name: 'Mathématiques'},
         {id: 2, name: 'Français'},
         {id: 3, name: 'Anglais'},
         {id: 4, name: 'Physique'},
         {id: 5, name: 'Chimie'},
         {id: 6, name: 'Aide aux devoirs'},
         {id: 7, name: 'Allemand'},
         {id: 8, name: 'Comptabilité'},
         {id: 9, name: 'Droit'},
         {id: 10, name: 'Économie'},
         {id: 11, name: 'Histoire'},
         {id: 12, name: 'Coaching'},
         {id: 13, name: 'Orientation'},
         {id: 14, name: 'Espagnol'},
         {id: 15, name: 'SVT/Biologie'},
         {id: 16, name: 'Cours de musique'}
     ];
 
     const typesCours = [
         {name: 'Cours à domicile'},
         {name: 'Cours hebdomadaire en centre (près de chez vous)'},
         {name: 'Stage de vacances'},
         {name: 'Cours en ligne (avec un prof en visio)'},
         {name: 'Je ne sais pas et souhaite être conseillé(e)'}
     ];
 
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
             'Cours de musique': '🎵'
         };
         return `<div class="subject-icon">${icons[subjectName] || '📚'}</div>`;
     }
 
     function filtrerMatieres(coursInscrits) {
         return toutesLesMatières.filter(matiere => 
             !coursInscrits.some(cours => cours.subject.name === matiere.name)
         );
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
 
     step1.querySelector('.next-button').addEventListener('click', () => {
         step1.style.display = 'none';
         step2.style.display = 'block';
     });
 
     step2.querySelector('.prev-button').addEventListener('click', () => {
         step2.style.display = 'none';
         step1.style.display = 'block';
     });
 
     addCourseForm.addEventListener('submit', function(e) {
         e.preventDefault();
         const formData = new FormData(this);
         
         fetch('add-course/', {
             method: 'POST',
             body: formData,
             headers: {
                 'X-CSRFToken': getCsrfToken(),
             },
         })
         .then(response => response.json())
         .then(data => {
             if (data.success) {
                 console.log('Cours ajouté avec succès');
                 window.location.reload();
             } else {
                 console.error('Erreur lors de l\'ajout du cours:', data.message);
                 alert('Erreur lors de l\'ajout du cours: ' + data.message);
             }
         })
         .catch(error => {
             console.error('Erreur lors de la requête:', error);
             alert('Une erreur est survenue lors de l\'ajout du cours');
         })
         .finally(() => {
             addCourseOverlay.style.display = 'none';
             this.reset();
             step1.style.display = 'block';
             step2.style.display = 'none';
         });
     });


    // Initialisation de l'état de la sidebar
    sidebarVisible = false; // Commencez avec la sidebar cachée
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const toggleBtn = document.getElementById('toggleSidebarBtn');

    if (window.innerWidth <= 768) {
        // Pour les petits écrans
        sidebar.classList.add('hidden');
        sidebar.style.left = '-250px';
        mainContent.style.marginLeft = '0';
        toggleBtn.style.left = '10px';
    } else {
        // Pour les grands écrans
        sidebarVisible = true;
        sidebar.classList.remove('hidden');
        sidebar.style.left = '0';
        mainContent.style.marginLeft = '250px';
        toggleBtn.style.left = '260px';
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

    // Initialisation
    toggleView('courses');

    // Ajouter un gestionnaire d'événements pour la fermeture de la fenêtre
    window.addEventListener('beforeunload', endChatSession);
});
document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Firebase Configuration ---
    const firebaseConfig = {
  apiKey: "AIzaSyBdAhFRyJ0BX3a45A-998vRbFU4yd0gg8U",
  authDomain: "web-quiz-9b-2026.firebaseapp.com",
  projectId: "web-quiz-9b-2026",
  storageBucket: "web-quiz-9b-2026.firebasestorage.app",
  messagingSenderId: "317165822224",
  appId: "1:317165822224:web:fdad312e717a075c390595",
  measurementId: "G-785XVL731J"
};
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // --- 2. Global State & Prompt ថ្មី (បង្ខំអោយ Random និងមាន Title) ---
    const AVATAR_LIST = ['download.jpg', 'spider.jpg', 'gojo.jpg', 'tungtungsahur.jpg', 'giyu.jpg', 'tanjiro.jpg', 'shinobu.jpg', 'shinobou.jpg'];
    const app = {
        users: [], quizzes: [], rooms: [], currentUser: null, currentRoomId: null,
        currentQuiz: null, gameState: {}, questionTimer: null,
        ownerEmail: "lychayzooba@gmail.com", 
        // វាយខ្នោះ AI: បង្ខំអោយ Random លេខ Index ចម្លើយត្រូវ (0,1,2,3) និងត្រូវតែមានចំណងជើង (title)
        aiConversationHistory: "System: You are an expert Quiz Creator. OUTPUT STRICTLY IN JSON. Rules:\n1. 'correct_answer_index' MUST BE RANDOMIZED (0, 1, 2, or 3) for each question.\n2. Must include a 'title' for the quiz.\n3. Exact Format: {\"title\": \"[Khmer Title]\", \"questions\": [{\"question\": \"...\", \"options\": [\"...\", \"...\", \"...\", \"...\"], \"correct_answer_index\": <random 0-3>}]}" 
    };
    let dataLoaded = false;
    window.latestAIQuizQuestions = null; 
    window.latestAIQuizTitle = "";

    // --- 3. DOM Selectors ---
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);
    const views = { login: $('#login-view'), signup: $('#signup-view'), home: $('#home-view'), admin: $('#admin-view'), lobby: $('#quiz-lobby-view'), game: $('#quiz-game-view'), leaderboard: $('#leaderboard-view'), testResult: $('#test-result-view') };
    
    const showView = (viewName) => { 
        Object.values(views).forEach(v => { if (v) v.style.display = 'none'; }); 
        if (views[viewName]) { views[viewName].style.display = ['login', 'signup', 'leaderboard', 'lobby', 'game', 'testResult'].includes(viewName) ? 'flex' : 'block'; } 
    };
    
    const encodeEmail = (email) => email ? email.replace(/\./g, ',') : '';
    const decodeEmail = (encodedEmail) => encodedEmail ? encodedEmail.replace(/,/g, '.') : '';
    
    const showModal = (title, bodyHtml, onOk) => { 
        const titleEl = $('#modal-title'); const bodyEl = $('#modal-body'); const overlay = $('#modal-overlay');
        if(titleEl && bodyEl && overlay) {
            titleEl.textContent = title; bodyEl.innerHTML = bodyHtml; overlay.style.display = 'flex'; 
            const okButton = $('#modal-ok-btn'); 
            if (okButton) { okButton.onclick = () => { overlay.style.display = 'none'; if (onOk) onOk(); }; } 
        }
    };
    
    const showNotification = (message, duration = 3000) => { 
        const notif = $('#global-notification'); 
        if(notif) { notif.innerHTML = message; notif.style.display = 'block'; setTimeout(() => { if (notif.innerHTML === message) notif.style.display = 'none'; }, duration); }
    };

    // --- 4. Main Initialization ---
    const init = () => {
        addEventListeners();
        try { 
            const storedUser = localStorage.getItem('quiz9b_currentUser');
            app.currentUser = storedUser ? JSON.parse(storedUser) : null; 
        } catch(e) { app.currentUser = null; }
        
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');

        if (!app.currentUser) {
            if (roomId) handleGuestLogin(roomId); else showView('login');
        } else {
            showView('home'); updateHomeUI();
        }
        
        db.ref('users').on('value', s => { 
            app.users = s.val() ? Object.values(s.val()) : []; 
            const encodedOwner = encodeEmail(app.ownerEmail);
            if (!app.users.find(u => u.email === app.ownerEmail)) {
                db.ref('users/' + encodedOwner).set({ username: 'Owner', email: app.ownerEmail, password: '123', isAdmin: true, isOwner: true, banned: false }); 
            }
            dataLoaded = true; updateUIbasedOnState(); 
        });

        db.ref('quizzes').on('value', s => { app.quizzes = s.val() ? Object.values(s.val()) : []; updateUIbasedOnState(); });
        db.ref('rooms').on('value', s => { 
            app.rooms = s.val() ? Object.values(s.val()) : []; 
            if (app.currentRoomId && !app.rooms.find(r => r.id === app.currentRoomId) && ($('#quiz-game-view')?.style.display !== 'none' || $('#quiz-lobby-view')?.style.display !== 'none')) { 
                forceGoHome("បន្ទប់ត្រូវបានបិទដោយ Admin។"); 
            } 
            updateUIbasedOnState(); 
        });
    };

    function updateUIbasedOnState() {
        if (!dataLoaded) return;
        if ($('#home-view')?.style.display !== 'none') updateHomeUI();
        if ($('#admin-view')?.style.display !== 'none') updateAdminUI();

        if (app.currentRoomId) {
            const room = app.rooms.find(r => r.id === app.currentRoomId);
            if (room) {
                if ($('#quiz-lobby-view')?.style.display !== 'none') {
                    updateLobbyUI(room);
                    if (!room.isTest && room.status === 'active' && $('#quiz-game-view')?.style.display === 'none') {
                        app.currentQuiz = app.quizzes.find(q => q.id === room.quizId);
                        if (app.currentQuiz) startGame();
                    }
                }
                if ($('#quiz-game-view')?.style.display !== 'none' && !room.isTest) updateLiveRank();
                if ($('#leaderboard-view')?.style.display !== 'none' && !room.isTest) displayLeaderboard(room);
            }
        }
    }

    const forceGoHome = (message) => { showModal("System Notice", `<p>${message}</p><button id='modal-ok-btn' class='magic-btn mt-20'>យល់ព្រម</button>`, goHome); };
    const goHome = () => { app.currentRoomId = null; app.currentQuiz = null; localStorage.removeItem('quiz9b_gameState'); if (window.location.search) window.history.pushState({}, '', window.location.pathname); showView('home'); updateHomeUI(); };

    // --- 5. Auth & Guest Login (Username Only) ---
    const handleLogout = () => { app.currentUser = null; app.currentRoomId = null; localStorage.clear(); showView('login'); };
    const handleLogin = () => { 
        const e = $('#login-email').value.trim(); const p = $('#login-password').value; 
        const user = app.users.find(u => u.email === e && u.password === p); 
        if (user) { 
            if (user.banned) return alert('គណនីនេះត្រូវបានបិទ។'); 
            app.currentUser = { email: user.email, username: user.username, isAdmin: user.isAdmin, isOwner: user.isOwner }; 
            localStorage.setItem('quiz9b_currentUser', JSON.stringify(app.currentUser)); goHome(); 
        } else { alert('អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។'); }
    };
    const handleSignup = () => { 
        const u = $('#signup-username').value.trim(); const e = $('#signup-email').value.trim(); const p = $('#signup-password').value; 
        if (!u || !e || !p) return alert('សូមបំពេញចន្លោះទាំងអស់។'); 
        if (app.users.find(user => user.email === e)) return alert('អ៊ីមែលនេះមានរួចហើយ។ សូមចូលគណនី។');
        const isOwner = (e === app.ownerEmail);
        const newUser = { username: u, email: e, password: p, isAdmin: isOwner, isOwner: isOwner, banned: false }; 
        const encodedEmail = encodeEmail(e);
        db.ref('users/' + encodedEmail).set(newUser).then(() => { app.currentUser = { email: e, username: u, isAdmin: newUser.isAdmin, isOwner: newUser.isOwner }; localStorage.setItem('quiz9b_currentUser', JSON.stringify(app.currentUser)); goHome(); });
    };

    const handleGuestLogin = (roomId) => { 
        const guestName = prompt("សូមបញ្ចូលឈ្មោះរបស់អ្នកដើម្បីចូលលេង:");
        if (guestName && guestName.trim() !== "") {
            app.currentUser = { 
                username: guestName.trim(), 
                email: `guest_${Date.now()}@guest.com`, 
                isGuest: true, isAdmin: false, isOwner: false 
            };
            localStorage.setItem('quiz9b_currentUser', JSON.stringify(app.currentUser));
            if (roomId) joinRoom(roomId); else { showView('home'); updateHomeUI(); }
        } else if(guestName !== null) {
            alert("សូមបញ្ចូលឈ្មោះជាមុនសិន!");
        }
    };

    // --- 6. Home & Admin UI ---
    const updateHomeUI = () => { 
        const c = $('#user-actions'); 
        if (c) {
            if (app.currentUser && !app.currentUser.isGuest) { 
                c.innerHTML = `<span style="color:white; margin-right:15px;">សួស្តី, <b>${app.currentUser.username}</b></span><button id="logout-btn" class="secondary-btn small-btn">ចាកចេញ</button>${app.currentUser.isAdmin || app.currentUser.isOwner ? '<button id="admin-panel-btn" class="magic-btn small-btn" style="margin-left: 10px; padding:10px 15px !important;">ផ្ទាំង Admin</button>' : ''}`; 
            } else { 
                c.innerHTML = `<button id="show-login-btn" class="magic-btn small-btn" style="padding:10px 15px !important;">ចូលគណនី</button>`; 
            }
        }
        renderRooms(); 
    };
    
    const renderRooms = (searchTerm = "") => { 
        const list = $('#rooms-list');
        if(!list) return;
        list.innerHTML = ''; 
        let available = app.rooms.filter(r => r.status === 'waiting' || (r.isTest && r.status === 'active')); 
        
        if (searchTerm) {
            available = available.filter(room => {
                const quiz = app.quizzes.find(q => q.id === room.quizId);
                const host = app.users.find(u => u.email === room.host);
                return (quiz && quiz.title.toLowerCase().includes(searchTerm.toLowerCase())) || (host && host.username.toLowerCase().includes(searchTerm.toLowerCase()));
            });
        }
        
        if (available.length === 0) { list.innerHTML = '<p style="color:#aaa;">មិនមានបន្ទប់កំពុងរង់ចាំទេ។</p>'; return; } 
        available.forEach(room => { 
            const quiz = app.quizzes.find(q => q.id === room.quizId); 
            const host = app.users.find(u => u.email === room.host); 
            if (quiz) { 
                const card = document.createElement('div'); card.className = 'room-card'; card.addEventListener('click', () => { if (app.currentUser) { joinRoom(room.id); } else { handleGuestLogin(room.id); } }); 
                card.innerHTML = `<h3 style="color:#cf30aa;">${quiz.title}</h3><p style="margin-bottom:10px; color:#c0b9c0;">បង្កើតដោយ៖ ${host ? host.username : 'N/A'}</p>${room.isTest ? '<span style="background:#cf30aa; color:#fff; padding:4px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">📝 ការប្រឡង (Test)</span>' : '<span style="background:#402fb5; color:#fff; padding:4px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">🎮 Live Game</span>'}`; 
                list.appendChild(card); 
            } 
        }); 
    };

    $('#room-search-input')?.addEventListener('input', (e) => { renderRooms(e.target.value.trim()); });

    const updateAdminUI = () => { 
        if (!app.currentUser || (!app.currentUser.isAdmin && !app.currentUser.isOwner)) return;
        
        if (app.currentUser.isOwner) {
            const ownerPanel = $('#owner-panel');
            if(ownerPanel) {
                ownerPanel.style.display = 'block';
                const adminList = $('#owner-manage-admins-list');
                if(adminList){
                    adminList.innerHTML = '';
                    app.users.filter(u => !u.isGuest && !u.isOwner).forEach(user => {
                        const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.marginBottom = '10px'; li.style.padding = '10px'; li.style.background = 'rgba(0,0,0,0.3)'; li.style.borderRadius = '8px';
                        li.innerHTML = `<span>${user.username} <small>(${user.email})</small></span> <button class="toggle-admin-btn ${user.isAdmin ? 'secondary-btn' : 'magic-btn'}" data-email="${user.email}" style="width:auto; padding:5px 15px !important; margin:0;">${user.isAdmin ? 'ដក Admin' : 'ធ្វើជា Admin'}</button>`;
                        adminList.appendChild(li);
                    });
                }
            }
        }

        const quizList = $('#manage-quizzes-list');
        if(quizList){
            quizList.innerHTML = ''; 
            (app.quizzes || []).forEach(q => { const li = document.createElement('li'); li.innerHTML = `<span>${q.title}</span><div style="display:flex;gap:5px;"><button class="host-quiz-btn magic-btn small-btn" data-quiz-id="${q.id}" style="padding:8px !important;">Live 🎮</button><button class="host-test-btn magic-btn small-btn" data-quiz-id="${q.id}" style="padding:8px !important; background:#cf30aa !important;">ប្រឡង 📝</button><button class="delete-quiz-btn secondary-btn small-btn" data-quiz-id="${q.id}" style="color:#dc3545; border-color:#dc3545;">លុប</button></div>`; quizList.appendChild(li); }); 
        }

        const userList = $('#manage-users-list');
        if(userList){
            userList.innerHTML = ''; 
            app.users.filter(u => !u.isOwner).forEach(user => { const li = document.createElement('li'); li.innerHTML = `<span>${user.username} ${user.isAdmin ? '<b style="color:#cf30aa;">(Admin)</b>' : ''} ${user.banned ? '<b style="color:red;">(BANNED)</b>' : ''}</span><button class="ban-user-btn secondary-btn small-btn" data-user-email="${user.email}">${user.banned ? 'Unban' : 'Ban'}</button>`; userList.appendChild(li);}); 
        }
    };

    // --- 7. ✨ AI CHAT, AUTO-TITLE, & AUTO-TICK SYSTEM ✨ ---
    const appendToChat = (role, text) => {
        const chatBox = $('#admin-chat-history');
        if(!chatBox) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
        msgDiv.textContent = typeof text === 'object' ? JSON.stringify(text, null, 2) : text;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    // មុខងារនេះបញ្ចូលសំណួរចូល Form ទាំងអស់ និងដាក់ចំណងជើងអូតូ
    window.applyChatQuiz = () => {
        if (!window.latestAIQuizQuestions) return alert('គ្មានសំណួរថ្មីទេ!');
        
        // Auto Fill Title
        const titleInput = $('#quiz-title');
        if (titleInput && window.latestAIQuizTitle && titleInput.value.trim() === '') {
            titleInput.value = window.latestAIQuizTitle;
        }

        $('#questions-container').innerHTML = ''; 
        window.latestAIQuizQuestions.forEach(q => populateQuestionFromData(q)); 
        showNotification("ទាញយកសំណួរបានជោគជ័យ! ✅ ចំណងជើង និងចម្លើយត្រូវបញ្ចូលរួចរាល់។"); 
    };

    const processAIResponseForChat = (aiResultText, promptContext) => {
        if (promptContext) app.aiConversationHistory += `\nSystem/User: ${promptContext}`;
        
        let actualText = typeof aiResultText === 'object' ? 
            (aiResultText?.message?.content || aiResultText?.text || JSON.stringify(aiResultText)) : aiResultText;

        app.aiConversationHistory += `\nAssistant: ${actualText}`;
        const jsonMatch = actualText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            try {
                let cleanJson = jsonMatch[0].replace(/```json|```/g, "").trim();
                const aiResult = JSON.parse(cleanJson);
                
                if (aiResult && (aiResult.questions || aiResult.quiz)) {
                    window.latestAIQuizQuestions = aiResult.questions || aiResult.quiz; 
                    window.latestAIQuizTitle = aiResult.title || "កម្រងសំណួរ AI"; // ចាប់យក Title
                    
                    const chatBox = $('#admin-chat-history');
                    if(chatBox) {
                        const msgDiv = document.createElement('div');
                        msgDiv.className = `chat-msg bot-msg`;
                        msgDiv.innerHTML = `
                            <div style="margin-bottom:10px; color:#fff;">✅ ខ្ញុំបានបង្កើត <b>${window.latestAIQuizQuestions.length} សំណួរ</b> រួចរាល់ហើយ! តើអ្នកចង់យកវាទៅប្រើទេ?</div>
                            <button class="magic-btn small-btn" onclick="applyChatQuiz()" style="width:100%; padding:10px !important; background:#00b894 !important;">✅ យល់ព្រម (បញ្ចូលសំណួរ & Auto Tick)</button>
                        `;
                        chatBox.appendChild(msgDiv);
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                    return; 
                }
            } catch (e) { console.warn("JSON parse error (Chat):", e); }
        }

        let displayText = actualText.replace(/```json|```/g, "").trim();
        appendToChat('bot', displayText);
    };

    // FIX: AUTO-TICK & FILL INPUTS LOGIC
    const populateQuestionFromData = (qData) => { 
        const template = $('#question-template');
        if(!template) return;
        const node = template.content.cloneNode(true); 
        const container = $('#questions-container');
        const qIndex = container.children.length; 
        
        node.querySelector('h4').textContent = `Question ${qIndex + 1}`; 
        // ប្រាកដថាវាចាប់យកពាក្យ question ឬ text (ព្រោះ AI ច្រើនប្រើពាក្យខុសៗគ្នា)
        node.querySelector('.question-text').value = qData.question || qData.text || ''; 
        
        // ធានាថា Index ចាប់បានត្រឹមត្រូវ
        let correctIdx = qData.correct_answer_index ?? qData.correct ?? qData.answerIndex ?? qData.correctIndex ?? 0;
        correctIdx = parseInt(correctIdx);

        // ទាញយក array ចម្លើយ
        const optionsArray = qData.options || qData.answers || ["", "", "", ""];

        node.querySelectorAll('.answer-option').forEach((opt, i) => {
            const radio = opt.querySelector('input[type="radio"]');
            const textInput = opt.querySelector('.answer-text');

            radio.name = `correct_answer_${qIndex}`;
            radio.value = i;
            if (i === correctIdx) { radio.checked = true; } // Auto Tick
            
            // បំពេញចម្លើយចូល Input 
            textInput.value = optionsArray[i] || '';
        });
        
        container.appendChild(node); 
    };

    const handleTextBotCreate = async () => {
        const textInput = $('#bot-text-input').value.trim(); if (!textInput) return alert("សូមសរសេរប្រធានបទ។");
        $('#bot-text-create-btn').innerHTML = "កំពុងដំណើរការ..."; $('#bot-text-create-btn').disabled = true;
        
        let PROMPT = `Topic: "${textInput}". Generate 5 questions in Khmer. Format EXACTLY: {"title": "${textInput} Quiz", "questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correct_answer_index": <RANDOM 0-3>}]}`;
        
        appendToChat('user', `[ប្រធានបទ: ${textInput}] សូមបង្កើតសំណួរ`);
        try { 
            const response = await puter.ai.chat(app.aiConversationHistory + "\nUser: " + PROMPT, { model: 'gemini-3-flash-preview' }); 
            processAIResponseForChat(response, `Topic: ${textInput}`); 
        } catch (error) { appendToChat('bot', `Error: ${error.message}`); } 
        finally { $('#bot-text-create-btn').innerHTML = "✨ បង្កើតពីអត្ថបទ"; $('#bot-text-create-btn').disabled = false; }
    };

    $('#admin-chat-send-btn')?.addEventListener('click', async () => {
        const inputEl = $('#admin-chat-input');
        const msg = inputEl.value.trim();
        if (!msg) return;

        appendToChat('user', msg);
        inputEl.value = '';
        $('#admin-chat-send-btn').disabled = true;
        
        const PROMPT = `User says: "${msg}". Please respond and if you generate a quiz, use this JSON format: {"title": "...", "questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correct_answer_index": <RANDOM 0-3>}]}`;
        
        app.aiConversationHistory += `\nUser: ${PROMPT}\nAssistant: `;

        try {
            const response = await puter.ai.chat(app.aiConversationHistory, { model: 'gemini-3-flash-preview' });
            processAIResponseForChat(response, null);
        } catch (err) { appendToChat('bot', `Error: ${err.message}`); } 
        finally { $('#admin-chat-send-btn').disabled = false; }
    });

    // --- 8. FIX: Save System (NO STUCK) ---
    const handleSaveQuiz = async () => {
        const saveButton = $('#save-quiz-btn');
        if (!saveButton) return;
        const originalText = saveButton.innerHTML;
        
        try {
            const title = $('#quiz-title').value.trim();
            if (!title) { alert('សូមបញ្ចូលចំណងជើងកម្រងសំណួរ!'); return; }
            
            const editors = $$('#questions-container .question-editor');
            if (editors.length === 0) { alert('សូមបន្ថែមយ៉ាងហោចណាស់មួយសំណួរ!'); return; }

            saveButton.disabled = true;
            saveButton.innerHTML = "⌛ កំពុងរក្សាទុក...";

            let questions = [];
            
            for (const [i, e] of editors.entries()) {
                const text = e.querySelector('.question-text').value.trim();
                const answers = Array.from(e.querySelectorAll('.answer-text')).map(inp => inp.value.trim());
                const correctRadio = e.querySelector('input[type="radio"]:checked');

                if (!text || answers.some(a => !a) || !correctRadio) {
                    saveButton.disabled = false;
                    saveButton.innerHTML = originalText;
                    alert(`សំណួរទី ${i + 1} មិនទាន់បំពេញគ្រប់ ឬអត់ទាន់ Tick ចម្លើយ!`);
                    return; 
                }

                questions.push({
                    text: text,
                    answers: answers,
                    correct: parseInt(correctRadio.value),
                    imageUrl: null 
                });
            }

            const quizId = `quiz_${Date.now()}`;
            const newQuiz = { 
                id: quizId,
                title: title,
                questions: questions, 
                createdBy: app.currentUser ? app.currentUser.email : 'Admin',
                createdAt: Date.now()
            };

            await db.ref('quizzes/' + quizId).set(newQuiz);
            
            alert('រក្សាទុកបានជោគជ័យ! ✅');
            $('#quiz-title').value = '';
            $('#questions-container').innerHTML = '';
            $('#bot-text-input').value = '';
            $('#admin-chat-history').innerHTML = '';
            if (typeof updateAdminUI === 'function') updateAdminUI();
            
        } catch (error) {
            console.error("Save Error:", error);
            alert("រក្សាទុកបរាជ័យ: " + error.message);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = originalText;
        }
    };

    // --- 9. Game Logic (Lobby & Game Loop) ---
    const joinRoom = (roomId) => { 
        const room = app.rooms.find(r => r.id === roomId); 
        if (!room) return forceGoHome("រកបន្ទប់មិនឃើញ។"); 
        if (!room.isTest && room.status !== 'waiting') return alert('ហ្គេមនៅក្នុងបន្ទប់នេះបានចាប់ផ្តើមបាត់ទៅហើយ។'); 
        
        app.currentRoomId = roomId; 
        const encodedPlayerEmail = encodeEmail(app.currentUser.email); 
        const playerRef = db.ref(`rooms/${roomId}/players/${encodedPlayerEmail}`); 
        
        playerRef.once('value', snapshot => { 
            let playerInfo = snapshot.val(); 
            if (!playerInfo) { 
                playerInfo = { email: app.currentUser.email, username: app.currentUser.username, avatarUrl: AVATAR_LIST[Math.floor(Math.random() * AVATAR_LIST.length)] }; 
                playerRef.set(playerInfo); 
            } 
            showView('lobby'); 
            setupLobby(playerInfo); 
            updateLobbyUI(room); 
        }); 
    };

    const setupLobby = (playerInfo) => { $('#player-username-display').textContent = playerInfo.username; const avatarGrid = $('#avatar-selection'); avatarGrid.innerHTML = ''; AVATAR_LIST.forEach((url) => { const img = document.createElement('img'); img.src = url; img.className = 'avatar-option'; if (url === playerInfo.avatarUrl) { img.classList.add('selected'); $('#player-avatar-display').src = url; } img.onclick = () => { const selected = $('.avatar-option.selected'); if (selected) selected.classList.remove('selected'); img.classList.add('selected'); $('#player-avatar-display').src = img.src; db.ref(`rooms/${app.currentRoomId}/players/${encodeEmail(app.currentUser.email)}/avatarUrl`).set(img.src); }; avatarGrid.appendChild(img); }); };
    
    const updateLobbyUI = (room) => { 
        const quiz = app.quizzes.find(q => q.id === room.quizId); 
        $('#lobby-quiz-title').textContent = quiz ? quiz.title : 'Loading...'; 
        $('#lobby-join-link-input').value = `${window.location.origin}${window.location.pathname}?room=${room.id}`; 
        
        const players = room.players ? Object.values(room.players) : []; 
        $('#player-count').textContent = players.length; 
        const playerListContainer = $('#lobby-player-list-main'); playerListContainer.innerHTML = ''; 
        players.forEach(p => { playerListContainer.innerHTML += `<div class="lobby-player-item"><img src="${p.avatarUrl || AVATAR_LIST[0]}" alt="avatar"><span>${p.username}</span></div>`; }); 
        
        const isHost = app.currentUser && app.currentUser.email === room.host; 
        
        if (room.isTest) {
            $('#start-game-btn').style.display = 'none';
            $('#close-room-btn').style.display = isHost ? 'block' : 'none';
            $('#lobby-wait-message').style.display = 'none';
            $('#start-test-btn').style.display = 'block'; 
        } else {
            $('#start-test-btn').style.display = 'none';
            $('#start-game-btn').style.display = isHost ? 'block' : 'none'; 
            $('#close-room-btn').style.display = isHost ? 'block' : 'none'; 
            $('#lobby-wait-message').style.display = isHost ? 'none' : 'block'; 
        }
    };

    const handleStartGameClick = () => { db.ref('rooms/' + app.currentRoomId).once('value', snapshot => { const room = snapshot.val(); if (room && room.host === app.currentUser.email) { let initialScores = {}; if (room.players) { Object.keys(room.players).forEach(playerKey => { initialScores[playerKey] = 0; }); } db.ref('rooms/' + app.currentRoomId).update({ status: 'active', scores: initialScores }); } }); };
    
    const startGame = () => { 
        localStorage.removeItem('quiz9b_gameState'); 
        app.currentQuiz = app.quizzes.find(q => q.id === app.rooms.find(r=>r.id===app.currentRoomId).quizId);
        const room = app.rooms.find(r => r.id === app.currentRoomId);
        
        showView('game'); 
        
        if (room && room.isTest) {
            $('#game-powerup-footer').style.display = 'none';
            $('#time-bar-container').style.display = 'none';
            app.gameState = { score: 0, streak: 0, powerUps: { glitch: 0, shield: 0 }, playerAnswers: [], isOvertime: false }; 
            runQuestion();
            return; 
        }

        $('#game-powerup-footer').style.display = 'flex';
        $('#time-bar-container').style.display = 'block';
        
        const countdownOverlay = $('#countdown-overlay'); 
        const countdownTimer = $('#countdown-timer'); 
        countdownOverlay.style.display = 'flex'; 
        let count = 5; 
        const countdownInterval = setInterval(() => { 
            countdownTimer.className = ''; void countdownTimer.offsetWidth; countdownTimer.className = 'pop'; 
            if (count > 0) { countdownTimer.textContent = count; } else if (count === 0) { countdownTimer.textContent = "GO!"; } 
            else { 
                clearInterval(countdownInterval); 
                countdownOverlay.style.display = 'none'; 
                app.gameState = { score: 0, streak: 0, powerUps: { glitch: 1, shield: 1 }, playerAnswers: [], isOvertime: false }; 
                runQuestion(); 
            } 
            count--; 
        }, 1000); 
    };

    const runQuestion = () => {
        const savedStateJSON = localStorage.getItem('quiz9b_gameState'); if (savedStateJSON) { const savedState = JSON.parse(savedStateJSON); if(savedState.roomId === app.currentRoomId) { app.gameState = savedState.state; localStorage.removeItem('quiz9b_gameState'); } }
        const room = app.rooms.find(r => r.id === app.currentRoomId);
        
        if (!app.currentQuiz || !app.currentQuiz.questions || app.currentQuiz.questions.length <= app.gameState.playerAnswers.length) return endGame();
        
        app.gameState.isOvertime = false; $('#overtime-message-overlay').style.display = 'none';
        const qIndex = app.gameState.playerAnswers.length; app.currentQuestionIndex = qIndex; const q = app.currentQuiz.questions[qIndex];
        const answerContainer = $('#answer-options-container'); answerContainer.innerHTML = '';
        (q.answers || []).forEach((ans, i) => { answerContainer.innerHTML += `<button class="answer-btn" data-index="${i}"><span>${ans || ''}</span></button>`; });
        
        const qImage = $('#game-question-image'); if (q.imageUrl) { qImage.src = q.imageUrl; qImage.style.display = 'block'; } else { qImage.style.display = 'none'; }
        $('#question-number').textContent = qIndex + 1; $('#total-questions').textContent = app.currentQuiz.questions.length; $('#player-score').textContent = app.gameState.score; $('#streak-count').textContent = app.gameState.streak; $('#game-question-text').textContent = q.text;
        
        if (!room.isTest) {
            $('#powerup-glitch-count').textContent = app.gameState.powerUps.glitch; $('#powerup-shield-count').textContent = app.gameState.powerUps.shield;
            $('#powerup-glitch-btn').disabled = app.gameState.powerUps.glitch <= 0; $('#powerup-shield-btn').disabled = app.gameState.powerUps.shield <= 0 || app.gameState.shieldActive;
            
            if (room && room.glitchInfo && room.glitchInfo.target === app.currentUser.email && room.glitchInfo.qIndex === qIndex) {
                if (app.gameState.shieldActive) { showNotification('Shield ការពារអ្នកពី Glitch Attack បានសម្រេច!'); app.gameState.shieldActive = false; db.ref(`rooms/${app.currentRoomId}/glitchInfo`).remove(); document.body.classList.remove('shield-active-body'); } 
                else { $('.question-content').classList.add('glitched'); $('#glitch-overlay').style.display = 'block'; showNotification(`អ្នកត្រូវបានគេវាយប្រហារដោយ Glitch!`); db.ref(`rooms/${app.currentRoomId}/glitchInfo`).remove(); setTimeout(() => { $('.question-content').classList.remove('glitched'); $('#glitch-overlay').style.display = 'none'; }, 3000); }
            }
            
            $('#time-bar').style.transition = 'none'; $('#time-bar').style.width = '100%'; setTimeout(() => { $('#time-bar').style.transition = 'width 10s linear'; $('#time-bar').style.width = '0%'; }, 100);
            
            clearTimeout(app.questionTimer);
            app.questionTimer = setTimeout(() => { app.gameState.isOvertime = true; $('#overtime-message-overlay').style.display = 'block'; $('#powerup-glitch-btn').disabled = true; $('#powerup-shield-btn').disabled = true; }, 10000);
        }
    };

    const handleAnswer = (e) => {
        clearTimeout(app.questionTimer); 
        const selIdx = parseInt(e.currentTarget.dataset.index); const q = app.currentQuiz.questions[app.currentQuestionIndex]; if (!q) return;
        const room = app.rooms.find(r => r.id === app.currentRoomId);
        
        $$('#answer-options-container .answer-btn').forEach(b => {b.disabled = true; b.classList.add('disabled');}); $('#overtime-message-overlay').style.display = 'none';
        let pts = 0; const isCorrect = selIdx === q.correct;
        
        if (room.isTest) {
            if (isCorrect) { pts = 1000; app.gameState.score += pts; showFeedback(true, pts); } else { showFeedback(false, 0); }
        } else {
            if (app.gameState.isOvertime) { if (isCorrect) { pts = 50; app.gameState.score += pts; showFeedback(true, pts); } else { showFeedback(false, 0); } app.gameState.streak = 0; }
            else {
                if (isCorrect) { app.gameState.streak++; const timeBonus = Math.floor(parseFloat(getComputedStyle($('#time-bar')).width) / $('#time-bar').parentElement.offsetWidth * 500); const streakBonus = 10 * (app.gameState.streak * app.gameState.streak); pts = 1000 + timeBonus + streakBonus; app.gameState.score += pts; showFeedback(true, pts); $('.streak-counter').classList.add('flash'); } 
                else { app.gameState.streak = 0; showFeedback(false, 0); }
            }
        }
        
        e.currentTarget.classList.add(isCorrect ? 'correct' : 'incorrect'); if(!isCorrect && q.correct >= 0 && $$('#answer-options-container .answer-btn')[q.correct]) { $$('#answer-options-container .answer-btn')[q.correct].classList.add('correct'); }
        app.gameState.playerAnswers.push({ qText: q.text, sel: q.answers[selIdx], cor: q.answers[q.correct], isCor: isCorrect });
        localStorage.setItem('quiz9b_gameState', JSON.stringify({ roomId: app.currentRoomId, state: app.gameState }));
        db.ref(`rooms/${app.currentRoomId}/scores/${encodeEmail(app.currentUser.email)}`).set(app.gameState.score);
        
        setTimeout(() => { $('.streak-counter').classList.remove('flash'); runQuestion(); }, room.isTest ? 1500 : 2500);
    };

    const usePowerUp = (type) => { 
        const room = app.rooms.find(r => r.id === app.currentRoomId); if (!room) return; 
        if (type === 'glitch' && app.gameState.powerUps.glitch > 0) { 
            const otherPlayers = room.players ? Object.values(room.players).filter(p => p.email !== app.currentUser.email) : []; 
            if (otherPlayers.length === 0) return showNotification("គ្មានអ្នកលេងផ្សេងទៀតសម្រាប់វាយប្រហារទេ!"); 
            let playerListHtml = '<h4 style="margin-bottom:15px; color:#cf30aa;">ជ្រើសរើសអ្នកលេងដើម្បីវាយប្រហារ (Glitch):</h4>'; 
            otherPlayers.forEach(p => { playerListHtml += `<label class="player-select-label" style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;"><input type="radio" name="glitch-target" value="${p.email}"><img src="${p.avatarUrl}" class="player-select-avatar" style="width:40px; border-radius:50%;"><span style="color:white;">${p.username}</span></label>`; }); playerListHtml += `<button id="confirm-glitch-btn" class="magic-btn mt-20" style="background:#dc3545 !important;">វាយប្រហារ 👾!</button>`; 
            showModal('ប្រើ Glitch Attack', playerListHtml); 
            $('#confirm-glitch-btn').onclick = () => { 
                const selectedTarget = $('input[name="glitch-target"]:checked'); if (!selectedTarget) return alert("សូមជ្រើសរើសគោលដៅ។"); 
                app.gameState.powerUps.glitch--; $('#powerup-glitch-btn').disabled = true; $('#powerup-glitch-count').textContent = app.gameState.powerUps.glitch; 
                db.ref(`rooms/${app.currentRoomId}/glitchInfo`).set({ activator: app.currentUser.email, target: selectedTarget.value, qIndex: app.currentQuestionIndex }); 
                showNotification(`អ្នកបានប្រើ Glitch ទៅលើគោលដៅហើយ!`); $('#modal-overlay').style.display = 'none'; 
            }; 
        } 
        if (type === 'shield' && app.gameState.powerUps.shield > 0) { 
            app.gameState.powerUps.shield--; $('#powerup-shield-btn').disabled = true; $('#powerup-shield-count').textContent = app.gameState.powerUps.shield; 
            app.gameState.shieldActive = true; document.body.classList.add('shield-active-body');
            showNotification('Shield បានបើកដំណើរការ! 🛡️ ការពារការវាយប្រហារបន្ទាប់។'); 
        } 
    };

    const showFeedback = (correct, points) => { const fb = $('#game-feedback-overlay'); fb.style.animation = 'none'; fb.offsetHeight; fb.style.animation = null; fb.style.display = 'flex'; if (correct === true) { $('#feedback-text').textContent = 'ត្រឹមត្រូវ!'; $('#feedback-text').style.color = 'var(--correct-green)'; $('#feedback-points').textContent = `+${points}`; } else if (correct === false) { $('#feedback-text').textContent = 'ខុសហើយ!'; $('#feedback-text').style.color = 'var(--incorrect-red)'; $('#feedback-points').textContent = ''; } else { $('#feedback-text').textContent = "អស់ម៉ោង!"; $('#feedback-text').style.color = 'var(--answer-orange)'; $('#feedback-points').textContent = `+${points}`; } };
    const updateLiveRank = () => { if (!app.currentUser) return; const room = app.rooms.find(r => r.id === app.currentRoomId); if (!room || !room.scores) return; const sortedScores = Object.entries(room.scores).sort((a, b) => b[1] - a[1]); const myRank = sortedScores.findIndex(entry => entry[0] === encodeEmail(app.currentUser.email)) + 1; $('#live-rank-display').textContent = `Rank: ${myRank > 0 ? myRank : '--'}`; $('#player-score').textContent = app.gameState.score || 0; };
    
    // --- 11. End Game Routing ---
    const endGame = () => { 
        localStorage.removeItem('quiz9b_gameState'); 
        const room = app.rooms.find(r => r.id === app.currentRoomId);
        
        if (room && room.isTest) {
            showView('testResult');
            $('#test-final-score').textContent = app.gameState.score;
            if ($('#test-answer-review-container').innerHTML === '') { 
                (app.gameState.playerAnswers || []).forEach(ans => { 
                    $('#test-answer-review-container').innerHTML += `<div class="review-item ${ans.isCor ? 'correct' : 'incorrect'}"><p><strong>${ans.qText}</strong></p><p>ចម្លើយរបស់អ្នក៖ ${ans.sel}</p>${!ans.isCor ? `<p>ចម្លើយត្រឹមត្រូវ៖ ${ans.cor}</p>` : ''}</div>`; 
                }); 
            }
        } else {
            showView('leaderboard'); 
            db.ref(`rooms/${app.currentRoomId}`).once('value', s => { if (s.val() && s.val().host === app.currentUser.email) { db.ref(`rooms/${s.val().id}/status`).set('finished'); } }); 
        }
    };

    const displayLeaderboard = (room) => {
        if (!room || !room.scores) return; const players = room.players ? Object.values(room.players) : [];
        const sorted = Object.entries(room.scores).map(([encodedEmail, score]) => { const p = players.find(player => player && player.email === decodeEmail(encodedEmail)); return { ...p, score }; }).filter(p => p && p.email).sort((a, b) => b.score - a.score);
        const podiumTargets = { 0: $('.place-1'), 1: $('.place-2'), 2: $('.place-3') }; Object.values(podiumTargets).forEach(el => el.style.visibility = 'hidden');
        sorted.slice(0, 3).forEach((p, i) => { const podiumEl = podiumTargets[i]; if (podiumEl) { podiumEl.style.visibility = 'visible'; podiumEl.querySelector('.podium-name').textContent = p.username; podiumEl.querySelector('.podium-score').textContent = `${p.score} ពិន្ទុ`; podiumEl.querySelector('.podium-avatar').src = p.avatarUrl; } });
        $('#leaderboard-list').innerHTML = ''; sorted.slice(3).forEach((p, i) => { if (p) $('#leaderboard-list').innerHTML += `<li><img src="${p.avatarUrl}" class="leaderboard-list-avatar"><span>#${i + 4} ${p.username}</span><span class="leaderboard-score">${p.score} ពិន្ទុ</span></li>`; });
        if ($('#answer-review-container').innerHTML === '') { (app.gameState.playerAnswers || []).forEach(ans => { $('#answer-review-container').innerHTML += `<div class="review-item ${ans.isCor ? 'correct' : 'incorrect'}"><p><strong>${ans.qText}</strong></p><p>ចម្លើយរបស់អ្នក៖ ${ans.sel}</p>${!ans.isCor ? `<p>ចម្លើយត្រឹមត្រូវ៖ ${ans.cor}</p>` : ''}</div>`; }); }
    };
    
    // --- 12. Event Registration ---
    function addEventListeners() {
        document.body.addEventListener('click', e => {
            const target = e.target;
            if (target.matches('#show-login-btn') || target.matches('#back-to-login-link')) { e.preventDefault(); showView('login'); }
            if (target.matches('#go-to-signup-btn')) { e.preventDefault(); showView('signup'); }
            if (target.matches('.back-to-home-link')) { e.preventDefault(); handleGuestLogin(); }
            
            if (target.matches('#logout-btn')) handleLogout();
            if (target.matches('#admin-panel-btn')) { showView('admin'); updateAdminUI(); }
            if (target.matches('#login-btn')) handleLogin();
            if (target.matches('#back-to-home-admin-btn') || target.matches('#back-to-home-from-leaderboard-btn') || target.matches('#back-to-home-from-test-btn')) goHome();
            if (target.matches('#signup-btn')) handleSignup();
            
            if (target.matches('#add-question-btn')) {
                const container = $('#questions-container');
                const template = $('#question-template').content.cloneNode(true);
                const idx = container.children.length;
                template.querySelectorAll('input[type="radio"]').forEach(r => r.name = `correct_answer_${idx}`);
                container.appendChild(template);
            }
            if (target.matches('#save-quiz-btn')) handleSaveQuiz();
            if (target.matches('#bot-text-create-btn')) handleTextBotCreate();
            
            if (target.closest('.toggle-admin-btn')) {
                const userEmail = target.closest('.toggle-admin-btn').dataset.email;
                const user = app.users.find(u => u.email === userEmail);
                if(user) { db.ref('users/' + encodeEmail(userEmail) + '/isAdmin').set(!user.isAdmin); }
            }

            if (target.closest('.ban-user-btn')) { const userEmail = target.closest('.ban-user-btn').dataset.userEmail; const user = app.users.find(u => u.email === userEmail); if(user) { db.ref('users/' + encodeEmail(userEmail) + '/banned').set(!user.banned); } }
            
            if (target.closest('.host-quiz-btn')) { 
                const quizId = target.closest('.host-quiz-btn').dataset.quizId; 
                const room = { id: `room_${Date.now()}`, quizId, host: app.currentUser.email, status: 'waiting', isTest: false, players: {}, scores: {} }; 
                db.ref('rooms/' + room.id).set(room); 
                const joinLink = `${window.location.origin}${window.location.pathname}?room=${room.id}`; 
                showModal("បន្ទប់ត្រូវបានបង្កើត!", `<div class="link-container" style="display:flex;gap:10px;"><input id="room-link-input" class="input" type="text" value="${joinLink}" style="flex:1;" readonly><button id="copy-link-btn" class="magic-btn" style="width:auto;margin:0;padding:0 20px !important;">ចម្លង</button></div><button id='modal-ok-btn' class="magic-btn mt-20">ចូលរួមបន្ទប់ឥឡូវនេះ</button>`, () => joinRoom(room.id)); 
            }
            
            if (target.closest('.host-test-btn')) { 
                const quizId = target.closest('.host-test-btn').dataset.quizId; 
                const room = { id: `test_${Date.now()}`, quizId, host: app.currentUser.email, status: 'active', isTest: true, players: {}, scores: {} }; 
                db.ref('rooms/' + room.id).set(room); 
                const joinLink = `${window.location.origin}${window.location.pathname}?room=${room.id}`; 
                showModal("ការប្រឡងបានដាក់ឲ្យដំណើរការ!", `<p style="margin-bottom:10px; color:#cf30aa;">ផ្ញើ Link នេះឲ្យសិស្សដើម្បីប្រឡង (បើក 24 ម៉ោង):</p><div class="link-container" style="display:flex;gap:10px;"><input id="room-link-input" class="input" type="text" value="${joinLink}" style="flex:1;" readonly><button id="copy-link-btn" class="magic-btn" style="width:auto;margin:0;padding:0 20px !important;">ចម្លង</button></div><button id='modal-ok-btn' class="magic-btn mt-20">ចូលរួមប្រឡង</button>`, () => joinRoom(room.id)); 
            }

            if (target.closest('.delete-quiz-btn')) { if (confirm('តើអ្នកពិតជាចង់លុបកម្រងសំណួរនេះមែនទេ?')) { const quizId = target.closest('.delete-quiz-btn').dataset.quizId; db.ref('quizzes/' + quizId).remove(); } }
            if (target.closest('.remove-question-btn')) target.closest('.question-editor').remove();
            if (target.matches('#lobby-copy-link-btn')) { const linkInput = $('#lobby-join-link-input'); linkInput.select(); document.execCommand('copy'); showNotification('បានចម្លង Link!'); }
            if (target.matches('#copy-link-btn')) { const linkInput = $('#room-link-input'); linkInput.select(); document.execCommand('copy'); showNotification('បានចម្លង Link!'); }
            
            if (target.matches('#start-game-btn')) handleStartGameClick();
            if (target.matches('#start-test-btn')) startGame();
            
            if (target.matches('#close-room-btn')) { if (confirm('តើអ្នកពិតជាចង់បិទបន្ទប់?')) { db.ref('rooms/' + app.currentRoomId).remove(); goHome(); } }
            if (target.matches('#powerup-glitch-btn') || target.closest('#powerup-glitch-btn')) usePowerUp('glitch');
            if (target.matches('#powerup-shield-btn') || target.closest('#powerup-shield-btn')) usePowerUp('shield');
            const answerBtn = target.closest('.answer-btn'); if (answerBtn && !answerBtn.disabled) handleAnswer({ currentTarget: answerBtn });
        });
    }

    init();
});

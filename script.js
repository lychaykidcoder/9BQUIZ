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

    // --- 2. Global State ---
    const AVATAR_LIST = ['download.jpg', 'spider.jpg', 'gojo.jpg', 'tungtungsahur.jpg', 'giyu.jpg', 'tanjiro.jpg', 'shinobu.jpg', 'shinobou.jpg'];
    const app = {
        users: [], quizzes: [], rooms: [], currentUser: null, currentRoomId: null,
        currentQuiz: null, gameState: {}, currentZoom: 16,
        ownerEmail: "lychayzooba@gmail.com", 
        aiConversationHistory: "System: You are an expert Quiz Creator. OUTPUT EXACT JSON. Format:\n{\"title\": \"...\", \"questions\": [{\"question\": \"...\", \"options\": [\"...\", \"...\"], \"correct_answer_index\": 0}]}" 
    };
    let dataLoaded = false;
    window.latestAIQuizQuestions = null; 
    window.latestAIQuizTitle = "";

    // --- 3. Base Utilities ---
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    const views = { login: $('#login-view'), signup: $('#signup-view'), home: $('#home-view'), admin: $('#admin-view'), lobby: $('#quiz-lobby-view'), game: $('#quiz-game-view'), leaderboard: $('#leaderboard-view'), testResult: $('#test-result-view') };
    
    // 💥 FIX BUG 1: បិទពន្លត់ View ឱ្យដាច់ស្រឡះ ការពារការលោតជាន់គ្នា (No More Layout Glitch)
    const showView = (name) => { 
        Object.keys(views).forEach(key => { 
            if (views[key]) {
                views[key].style.setProperty('display', 'none', 'important');
                views[key].style.visibility = 'hidden';
            }
        }); 
        if (views[name]) {
            views[name].style.setProperty('display', ['login', 'signup', 'leaderboard', 'lobby', 'game', 'testResult'].includes(name) ? 'flex' : 'block', 'important'); 
            views[name].style.visibility = 'visible';
        }
    };
    
    const encodeEmail = (e) => e ? e.replace(/\./g, ',') : '';
    const decodeEmail = (e) => e ? e.replace(/,/g, '.') : '';
    const showModal = (title, bodyHtml, onOk) => { const t = $('#modal-title'); const b = $('#modal-body'); const o = $('#modal-overlay'); if(t && b && o) { t.textContent = title; b.innerHTML = bodyHtml; o.style.display = 'flex'; const ok = $('#modal-ok-btn'); if (ok) { ok.onclick = () => { o.style.display = 'none'; if (onOk) onOk(); }; } } };
    const showNotification = (msg, dur = 3000) => { const n = $('#global-notification'); if(n) { n.innerHTML = msg; n.style.display = 'block'; setTimeout(() => { if (n.innerHTML === msg) n.style.display = 'none'; }, dur); } };

    // --- 4. Main Init ---
    const init = () => {
        addEventListeners();
        try { const storedUser = localStorage.getItem('quiz9b_currentUser'); app.currentUser = storedUser ? JSON.parse(storedUser) : null; } catch(e) { app.currentUser = null; }
        
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');

        if (roomId) {
            if (!app.currentUser) handleGuestLogin(roomId); 
            else joinRoom(roomId);
        } else {
            if (!app.currentUser) showView('login');
            else { showView('home'); updateHomeUI(); }
        }
        
        db.ref('users').on('value', s => { 
            app.users = s.val() ? Object.values(s.val()) : []; 
            if (!app.users.find(u => u.email === app.ownerEmail)) db.ref('users/' + encodeEmail(app.ownerEmail)).set({ username: 'Owner', email: app.ownerEmail, password: '123', isAdmin: true, isOwner: true, banned: false }); 
            dataLoaded = true; updateUIbasedOnState(); 
        });

        db.ref('quizzes').on('value', s => { app.quizzes = s.val() ? Object.values(s.val()) : []; updateUIbasedOnState(); });
        db.ref('rooms').on('value', s => { 
            app.rooms = s.val() ? Object.values(s.val()) : []; 
            if (app.currentRoomId && !app.rooms.find(r => r.id === app.currentRoomId) && ($('#quiz-game-view')?.style.display !== 'none' || $('#quiz-lobby-view')?.style.display !== 'none')) forceGoHome("បន្ទប់ត្រូវបានបិទដោយ Admin។"); 
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
                if ($('#quiz-lobby-view')?.style.display !== 'none') updateLobbyUI(room);
            }
        }
    }

    const forceGoHome = (msg) => { showModal("System Notice", `<p>${msg}</p><button id='modal-ok-btn' class='magic-btn mt-20'>យល់ព្រម</button>`, goHome); };
    const goHome = () => { app.currentRoomId = null; app.currentQuiz = null; localStorage.removeItem('quiz9b_gameState'); if (window.location.search) window.history.pushState({}, '', window.location.pathname); showView('home'); updateHomeUI(); };

    // --- 5. Auth ---
    const handleLogout = () => { app.currentUser = null; app.currentRoomId = null; localStorage.clear(); showView('login'); };
    const handleLogin = () => { const e = $('#login-email').value.trim(); const p = $('#login-password').value; const user = app.users.find(u => u.email === e && u.password === p); if (user) { if (user.banned) return alert('គណនីត្រូវបានបិទ។'); app.currentUser = { email: user.email, username: user.username, isAdmin: user.isAdmin, isOwner: user.isOwner }; localStorage.setItem('quiz9b_currentUser', JSON.stringify(app.currentUser)); goHome(); } else alert('អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។'); };
    const handleSignup = () => { const u = $('#signup-username').value.trim(); const e = $('#signup-email').value.trim(); const p = $('#signup-password').value; if (!u || !e || !p) return alert('សូមបំពេញចន្លោះទាំងអស់។'); if (app.users.find(user => user.email === e)) return alert('អ៊ីមែលនេះមានរួចហើយ។'); const isOwner = (e === app.ownerEmail); const newUser = { username: u, email: e, password: p, isAdmin: isOwner, isOwner: isOwner, banned: false }; db.ref('users/' + encodeEmail(e)).set(newUser).then(() => { app.currentUser = { email: e, username: u, isAdmin: newUser.isAdmin, isOwner: newUser.isOwner }; localStorage.setItem('quiz9b_currentUser', JSON.stringify(app.currentUser)); goHome(); }); };
    const handleGuestLogin = (roomId) => { const guestName = prompt("សូមបញ្ចូលឈ្មោះរបស់អ្នកដើម្បីចូលលេង:"); if (guestName && guestName.trim() !== "") { app.currentUser = { username: guestName.trim(), email: `guest_${Date.now()}@guest.com`, isGuest: true, isAdmin: false, isOwner: false }; localStorage.setItem('quiz9b_currentUser', JSON.stringify(app.currentUser)); if (roomId) joinRoom(roomId); else { showView('home'); updateHomeUI(); } } else if(guestName !== null) { alert("សូមបញ្ចូលឈ្មោះជាមុនសិន!"); } };

    // --- 6. UI Renderers ---
    const updateHomeUI = () => { const c = $('#user-actions'); if (c) { if (app.currentUser && !app.currentUser.isGuest) { c.innerHTML = `<span style="color:white; margin-right:15px;">សួស្តី, <b>${app.currentUser.username}</b></span><button id="logout-btn" class="secondary-btn small-btn">ចាកចេញ</button>${app.currentUser.isAdmin || app.currentUser.isOwner ? '<button id="admin-panel-btn" class="magic-btn small-btn" style="margin-left: 10px; padding:10px 15px !important;">ផ្ទាំង Admin</button>' : ''}`; } else { c.innerHTML = `<button id="show-login-btn" class="magic-btn small-btn" style="padding:10px 15px !important;">ចូលគណនី</button>`; } } renderRooms(); };
    const renderRooms = (term = "") => { const list = $('#rooms-list'); if(!list) return; list.innerHTML = ''; let available = app.rooms.filter(r => r.status === 'waiting' || (r.isTest && r.status === 'active')); if (term) available = available.filter(room => { const q = app.quizzes.find(q => q.id === room.quizId); const h = app.users.find(u => u.email === room.host); return (q && q.title.toLowerCase().includes(term.toLowerCase())) || (h && h.username.toLowerCase().includes(term.toLowerCase())); }); if (available.length === 0) { list.innerHTML = '<p style="color:#aaa;">មិនមានបន្ទប់កំពុងរង់ចាំទេ។</p>'; return; } available.forEach(room => { const quiz = app.quizzes.find(q => q.id === room.quizId); const host = app.users.find(u => u.email === room.host); if (quiz) { const card = document.createElement('div'); card.className = 'room-card'; card.addEventListener('click', () => { if (app.currentUser) joinRoom(room.id); else handleGuestLogin(room.id); }); card.innerHTML = `<h3 style="color:#cf30aa;">${quiz.title}</h3><p style="margin-bottom:10px; color:#c0b9c0;">បង្កើតដោយ៖ ${host ? host.username : 'N/A'}</p>${room.isTest ? '<span style="background:#cf30aa; color:#fff; padding:4px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">📝 ការប្រឡង (Test)</span>' : '<span style="background:#402fb5; color:#fff; padding:4px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">🎮 Live Game</span>'}`; list.appendChild(card); } }); };
    $('#room-search-input')?.addEventListener('input', (e) => renderRooms(e.target.value.trim()));
    const updateAdminUI = () => { if (!app.currentUser || (!app.currentUser.isAdmin && !app.currentUser.isOwner)) return; const quizList = $('#manage-quizzes-list'); if(quizList) { quizList.innerHTML = ''; (app.quizzes || []).forEach(q => { const li = document.createElement('li'); li.innerHTML = `<span>${q.title}</span><div style="display:flex;gap:5px;"><button class="host-quiz-btn magic-btn small-btn" data-quiz-id="${q.id}" style="padding:8px !important;">Live 🎮</button><button class="host-test-btn magic-btn small-btn" data-quiz-id="${q.id}" style="padding:8px !important; background:#cf30aa !important;">ប្រឡង 📝</button><button class="delete-quiz-btn secondary-btn small-btn" data-quiz-id="${q.id}" style="color:#dc3545; border-color:#dc3545;">លុប</button></div>`; quizList.appendChild(li); }); } };

    // --- 7. Save Quiz ---
    const handleSaveQuiz = async () => {
        const btn = $('#save-quiz-btn'); if (!btn) return; const orig = btn.innerHTML;
        try {
            const title = $('#quiz-title').value.trim(); if (!title) return alert('សូមបញ្ចូលចំណងជើង!');
            const editors = $$('#questions-container .question-editor'); if (editors.length === 0) return alert('សូមបន្ថែមសំណួរ!');
            btn.disabled = true; btn.innerHTML = "⌛ កំពុងរក្សាទុក...";
            let questions = [];
            for (const [i, e] of editors.entries()) {
                const text = e.querySelector('.question-text').value.trim();
                const answers = Array.from(e.querySelectorAll('.answer-text')).map(inp => inp.value.trim());
                const correctRadio = e.querySelector('input[type="radio"]:checked');
                if (!text || answers.some(a => !a) || !correctRadio) { btn.disabled = false; btn.innerHTML = orig; return alert(`សំណួរទី ${i + 1} មិនទាន់បំពេញគ្រប់ ឬអត់ទាន់ Tick ចម្លើយ!`); }
                questions.push({ text: text, answers: answers, correct: parseInt(correctRadio.value) });
            }
            const quizId = `quiz_${Date.now()}`;
            await db.ref('quizzes/' + quizId).set({ id: quizId, title: title, questions: questions, createdBy: app.currentUser.email, createdAt: Date.now() });
            alert('រក្សាទុកបានជោគជ័យ! ✅'); $('#quiz-title').value = ''; $('#questions-container').innerHTML = ''; updateAdminUI();
        } catch (err) { alert("Error: " + err.message); } finally { btn.disabled = false; btn.innerHTML = orig; }
    };

    // --- 8. Lobby System ---
    const joinRoom = (roomId) => { 
        db.ref('rooms/' + roomId).once('value', snapshot => {
            const room = snapshot.val();
            if (!room) return forceGoHome("បន្ទប់នេះមិនមានទេ ឬត្រូវបានបិទ។");
            app.currentRoomId = roomId; 
            const playerRef = db.ref(`rooms/${roomId}/players/${encodeEmail(app.currentUser.email)}`); 
            playerRef.once('value', pSnap => { 
                let pInfo = pSnap.val(); 
                if (!pInfo) { pInfo = { email: app.currentUser.email, username: app.currentUser.username, avatarUrl: AVATAR_LIST[Math.floor(Math.random() * AVATAR_LIST.length)] }; playerRef.set(pInfo); } 
                showView('lobby'); updateLobbyUI(room); 
            }); 
        });
    };
    const updateLobbyUI = (room) => { 
        const quiz = app.quizzes.find(q => q.id === room.quizId); 
        $('#lobby-quiz-title').textContent = quiz ? quiz.title : 'Loading...'; 
        $('#lobby-join-link-input').value = `${window.location.origin}${window.location.pathname}?room=${room.id}`; 
        const players = room.players ? Object.values(room.players) : []; 
        $('#player-count').textContent = players.length; 
        const list = $('#lobby-player-list-main'); list.innerHTML = ''; 
        players.forEach(p => { list.innerHTML += `<div class="lobby-player-item"><img src="${p.avatarUrl || AVATAR_LIST[0]}" alt="avatar"><span>${p.username}</span></div>`; }); 
        const isHost = app.currentUser && app.currentUser.email === room.host; 
        $('#start-game-btn').style.display = 'block'; 
        $('#start-game-btn').innerHTML = "📝 ចាប់ផ្តើមធ្វើវិញ្ញាសា"; 
        $('#close-room-btn').style.display = isHost ? 'block' : 'none'; 
        $('#lobby-wait-message').style.display = 'none'; 
    };

    // --- 9. 📝 DIGITAL EXAM PAPER (100% Pure CSS A4 Sheet) ---
    const startDigitalExam = () => { 
        app.currentQuiz = app.quizzes.find(q => q.id === app.rooms.find(r=>r.id===app.currentRoomId).quizId);
        showView('game'); 
        
        const gameView = $('#quiz-game-view');
        app.gameState = { score: 0, playerAnswers: new Array(app.currentQuiz.questions.length).fill(null), isSubmitted: false };
        app.currentZoom = 16; 

        let styleStr = `
            <style>
                .paper-wrapper {
                    padding: 40px 20px;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    width: 100%;
                }
                .real-a4-paper { 
                    background: #ffffff; color: #000000; 
                    width: 100%; max-width: 21cm; 
                    height: auto; min-height: 29.7cm; 
                    padding: 2.5cm 2cm; 
                    box-shadow: 0 15px 35px rgba(0,0,0,0.5); 
                    font-family: 'Khmer OS Battambang', 'Khmer OS', serif; line-height: 1.6;
                    box-sizing: border-box;
                }
                .exam-header-a4 { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; position: relative; }
                .school-title { font-size: 1.1em; font-weight: bold; margin: 0; }
                .quiz-title { font-size: 1.3em; font-weight: bold; margin: 15px 0 10px 0; text-align: center; }
                .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 30px; font-size: 0.9em; }
                .dotted-line { border-bottom: 1.5px dotted #000; display: inline-block; width: 150px; margin-left: 5px; }
                .q-container { margin-bottom: 35px; text-align: left; }
                .q-text { font-weight: bold; margin-bottom: 15px; line-height: 1.8; color: #000; }
                
                /* Matching Table Layout ZIN */
                .matching-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                .matching-table th, .matching-table td { border: 1px solid #333; padding: 10px; text-align: left; vertical-align: middle; }
                .matching-table th { background: #f0f0f0; text-align: center; color: #000; }
                
                /* 💥 FIX: ប្រអប់បញ្ចូលអក្សរ ថ្លា មិនងងឹតប្រផេះ */
                .match-input { 
                    width: 50px !important; text-align: center; 
                    border: none !important; border-bottom: 2px dashed #000 !important; 
                    outline: none !important; font-weight: bold; color: blue !important; 
                    font-size: 1.1em; background: transparent !important; box-shadow: none !important; padding: 0 !important;
                }
                .actual-fill-input { 
                    border: none !important; border-bottom: 2px dotted #000 !important; 
                    outline: none !important; background: transparent !important; 
                    font-size: 1em; color: blue !important; 
                    padding: 0 5px !important; min-width: 150px; text-align: center; font-weight: bold; box-shadow: none !important;
                }
                
                .mcq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding-left: 10px; }
                .mcq-item { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; color: black !important; }
                .paper-checkbox { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; border: 1.5px solid #000; border-radius: 2px; position: relative; cursor: pointer; background: #fff; margin-top: 4px; flex-shrink: 0;}
                .paper-checkbox:checked::after { content: "✔"; position: absolute; top: -6px; left: 2px; color: #000; font-size: 18px; font-weight: bold; }
                
                .zoom-panel { position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: flex; gap: 10px; }
                .zoom-btn { background: #2c3e50; color: #fff; border: 1px solid #fff; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-shadow: none; font-size: 16px;}
                .btn-submit-a4 { display: block; width: 100%; background: #000; color: #fff; border: none; padding: 15px; font-size: 1.2em; cursor: pointer; margin-top: 40px; border-radius: 5px;}
                .btn-submit-a4:hover { background: #333; }
                .btn-goto-leaderboard { background: #cf30aa; display: none; margin-top: 15px; }
            </style>
        `;

        let html = styleStr + `
            <div class="zoom-panel">
                <button class="zoom-btn" id="zoom-in-btn">🔍+</button>
                <button class="zoom-btn" id="zoom-out-btn">🔍-</button>
            </div>
            <div class="paper-wrapper">
                <div class="real-a4-paper" id="exam-paper-content" style="font-size: ${app.currentZoom}px;">
                    <div class="exam-header-a4">
                        <p class="school-title">វិទ្យាល័យព្រះអង្គឌួង សាលារៀនជំនាន់ថ្មី</p>
                        <div style="position: absolute; right: 0; top: 0; border: 1.5px solid #000; border-radius: 50%; width: 50px; height: 50px; text-align: center; line-height: 50px; font-weight: bold;">៥០</div>
                        <div class="quiz-title">${app.currentQuiz.title}</div>
                    </div>
                    <div class="student-info">
                        <div>នាមត្រកូល និងនាមខ្លួន៖ <b style="color:blue;">${app.currentUser.username}</b> <span class="dotted-line" style="width: 50px;"></span></div>
                        <div>លេខតុ៖ <span class="dotted-line"></span></div>
                        <div>ថ្នាក់ទី៖ <span class="dotted-line"></span></div>
                        <div>ថ្ងៃខែឆ្នាំកំណើត៖ <span class="dotted-line"></span></div>
                    </div>
                    <div style="font-style: italic; margin-bottom: 25px; font-size: 0.9em; text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 15px;">* ចូរជ្រើសរើសចម្លើយដែលត្រឹមត្រូវដោយគូសសញ្ញា ✔ ក្នុងប្រអប់ ឬបំពេញចន្លោះ។</div>
        `;

        app.currentQuiz.questions.forEach((q, i) => {
            const opts = q.answers || [];
            
            // Bulletproof Type Detectors
            let colA = [], colB = [], regularOpts = [];
            opts.forEach(o => {
                if (o.match(/^(A|ក)\s*:/)) colA = o.replace(/^(A|ក)\s*:/, '').split('|').map(s=>s.trim());
                else if (o.match(/^(B|ខ)\s*:/)) colB = o.replace(/^(B|ខ)\s*:/, '').split('|').map(s=>s.trim());
                else regularOpts.push(o);
            });

            if (colA.length === 0 && colB.length === 0) {
                let matchA = q.text.match(/(?:ផ្នែក|ជួរ|ក្រុម)?\s*A\s*\((.*?)\)/i) || q.text.match(/A\s*:\s*(.*?)(?=(?:ផ្នែក|ជួរ|ក្រុម)?\s*B|B\s*:|$)/i);
                let matchB = q.text.match(/(?:ផ្នែក|ជួរ|ក្រុម)?\s*B\s*\((.*?)\)/i) || q.text.match(/B\s*:\s*(.*?)$/i);
                if(matchA) colA = matchA[1].split('|').map(s=>s.trim());
                if(matchB) colB = matchB[1].split('|').map(s=>s.trim());
                regularOpts = opts;
            }

            let isMatching = colA.length > 0 && colB.length > 0;
            let isFillBlank = !isMatching && (q.text.includes('........') || q.text.includes('..........'));

            html += `<div class="q-container" data-qindex="${i}" data-type="${isMatching ? 'match' : (isFillBlank ? 'fill' : 'mcq')}">`;

            if (isMatching) {
                html += `<div class="q-text">${q.text}</div>`;
                html += `<table class="matching-table"><tr><th style="width: 42%">ជួរ A</th><th style="width: 43%">ជួរ B</th><th style="width: 15%">(C) ចម្លើយ</th></tr>`;
                let maxRows = Math.max(colA.length, colB.length);
                for(let r=0; r<maxRows; r++) {
                    html += `<tr>
                                <td>${colA[r] || ''}</td>
                                <td>${colB[r] || ''}</td>
                                <td style="text-align:center;">${colA[r] ? `${r+1} ➔ <input type="text" class="match-input" data-row="${r+1}" autocomplete="off">` : ''}</td>
                             </tr>`;
                }
                html += `</table>`;
                
                html += `<div style="margin-top: 10px; font-style: italic; font-size: 0.9em;">សូមជ្រើសរើសចម្លើយរួមបញ្ចូលគ្នា៖</div>`;
                html += `<div class="mcq-grid" style="margin-top: 5px;">`;
                regularOpts.forEach(ans => {
                    let actualJ = opts.indexOf(ans);
                    html += `<label class="mcq-item"><input type="radio" name="q_${i}" value="${actualJ}" class="paper-checkbox"><span>${ans}</span></label>`;
                });
                html += `</div>`;

            } else if (isFillBlank) {
                let parts = q.text.split(/\.{4,}/);
                let formattedQ = '';
                for(let p=0; p<parts.length; p++) {
                    formattedQ += parts[p];
                    if(p < parts.length - 1) formattedQ += `<input type="text" class="actual-fill-input" name="fill_${i}" autocomplete="off">`;
                }
                html += `<div class="q-text">${formattedQ}</div>`;
            } else {
                html += `<div class="q-text">${q.text}</div><div class="mcq-grid">`;
                opts.forEach((ans, j) => {
                    html += `<label class="mcq-item"><input type="radio" name="q_${i}" value="${j}" class="paper-checkbox"><span>${ans}</span></label>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        });

        html += `<button id="submit-exam-btn" class="btn-submit-a4">ប្រគល់សន្លឹកកិច្ចការ</button>`;
        html += `<button id="goto-leaderboard-btn" class="btn-submit-a4 btn-goto-leaderboard">🏆 ទៅកាន់តារាងចំណាត់ថ្នាក់</button>`;
        html += `</div></div>`; 
        
        gameView.innerHTML = html;
        document.body.style.backgroundColor = '#525659';
    };

    // --- 10. 💥 THE ANTI-DUMP GRADER (Super Khmer Parser) ---
    const superKhmerParser = (userAns, correctAns) => {
        if (!userAns) return false;
        
        // កាត់ក្បាលអក្សរ ក, ខ, គ, ឃ, 1. ចេញពីចម្លើយពិតប្រាកដ
        let cleanC = (correctAns || "").replace(/^([ក-អ]|[a-zA-Z]|\d+)\s*[,.)៖-]\s*/, '').trim();
        
        const cleanStr = (s) => {
            if(!s) return "";
            // លុបដកឃ្លា និងសញ្ញាខណ្ឌចោលឱ្យអស់
            let t = s.replace(/[\s\.\,\?\!។ៗ៖៘៙\-\_\➔]/g, '').toLowerCase();
            // តម្រង់ជើងអក្សរ ដ និង ត ឱ្យរត់ចូលកូដតែមួយ (Fix Unicode Subscripts Shift)
            t = t.replace(/ណ្ត/g, 'ណ្ដ');
            return t;
        };

        let cu = cleanStr(userAns);
        let cc = cleanStr(cleanC);

        if (cu === cc) return true;
        if (cc.includes(cu) && cu.length >= 3) return true; // បើត្រូវពាក្យគន្លឹះស្នូល
        if (cu.includes(cc) && cc.length >= 3) return true;
        
        return false;
    };

    // --- 11. IN-PLACE EVALUATION ENGINE ---
    const submitDigitalExam = () => {
        if (app.gameState.isSubmitted) return;
        if (!confirm("តើអ្នកពិតជាចង់ប្រគល់សន្លឹកកិច្ចការមែនទេ?")) return;

        app.gameState.isSubmitted = true;
        $('#submit-exam-btn').style.display = 'none'; 
        let score = 0;
        
        app.currentQuiz.questions.forEach((q, i) => {
            const container = $(`div.q-container[data-qindex="${i}"]`);
            const qType = container.dataset.type;
            const opts = q.answers || [];
            
            let isCorrect = false;
            let userSel = "មិនបានឆ្លើយ";
            let correctStr = opts[q.correct] || "";

            if (qType === 'match') {
                // កែទម្រង់ផ្គូផ្គង
                let correctMapping = {};
                let matches = correctStr.match(/(\d+)\s*[-_➔:]\s*([ក-អ])/g);
                if (matches) {
                    matches.forEach(m => {
                        let p = m.match(/(\d+)\s*[-_➔:]\s*([ក-អ])/);
                        if(p) correctMapping[p[1]] = p[2];
                    });
                }
                
                let allMatchCorrect = true;
                let userSelStr = "";
                const inputs = container.querySelectorAll('.match-input');
                
                inputs.forEach(inp => {
                    let rNum = inp.dataset.row;
                    let uVal = inp.value.trim();
                    let cVal = correctMapping[rNum] ? correctMapping[rNum] : "";
                    
                    userSelStr += `${rNum}➔${uVal || '?'} `;
                    inp.disabled = true;
                    
                    if (uVal && cVal && uVal.toLowerCase() === cVal.toLowerCase()) {
                        inp.style.color = '#1b5e20';
                        inp.style.borderBottomColor = '#1b5e20';
                    } else {
                        allMatchCorrect = false;
                        inp.style.color = '#b71c1c';
                        inp.style.borderBottomColor = '#b71c1c';
                        inp.style.textDecoration = 'line-through';
                        
                        let corrSpan = document.createElement('span');
                        corrSpan.innerHTML = ` <b style="color:#1b5e20; background:#e8f5e9; border-radius:3px; padding:0 4px; font-size:0.9em;">(${cVal})</b>`;
                        inp.parentNode.appendChild(corrSpan);
                    }
                });

                const selectedRadio = container.querySelector(`input[type="radio"]:checked`);
                if(selectedRadio) userSelStr += `| រើស៖ ${opts[selectedRadio.value]}`;

                isCorrect = allMatchCorrect && inputs.length > 0;
                if(isCorrect) score += 1000;
                userSel = userSelStr.trim();

                // ផាត់ពណ៌ Radio ខាងក្រោមតារាងឱ្យស្អាត
                const labels = container.querySelectorAll('.mcq-item');
                labels.forEach((label) => {
                    const cb = label.querySelector('input');
                    if(cb) {
                        cb.disabled = true;
                        if (parseInt(cb.value) === q.correct) {
                            label.style.backgroundColor = 'rgba(76, 175, 80, 0.15)'; label.style.border = '1px solid #4CAF50';
                        }
                    }
                });

            } else if (qType === 'fill') {
                const inputs = container.querySelectorAll('.actual-fill-input');
                let combinedUserText = "";
                inputs.forEach(inp => { combinedUserText += inp.value.trim() + " "; inp.disabled = true; });
                userSel = combinedUserText.trim();
                
                isCorrect = superKhmerParser(userSel, correctStr);
                
                inputs.forEach(inp => {
                    if(isCorrect) { 
                        inp.style.color = '#1b5e20'; 
                        inp.style.borderBottomColor = '#1b5e20'; 
                    } else { 
                        inp.style.color = '#b71c1c'; 
                        inp.style.borderBottomColor = '#b71c1c'; 
                        inp.style.textDecoration = 'line-through';
                    }
                });
                
                if(isCorrect) score += 1000;
                else {
                    let lastInput = inputs[inputs.length-1];
                    if (lastInput) {
                        let corrSpan = document.createElement('span');
                        corrSpan.innerHTML = ` ➔ <b style="color:#1b5e20; background:#e8f5e9; padding:2px 6px; border-radius:3px; font-size:0.95em;">${correctStr}</b>`;
                        lastInput.parentNode.insertBefore(corrSpan, lastInput.nextSibling);
                    }
                }
            } else {
                // MCQ ធម្មតា
                const selectedRadio = container.querySelector(`input[type="radio"]:checked`);
                const selIdx = selectedRadio ? parseInt(selectedRadio.value) : -1;
                isCorrect = selIdx === q.correct;
                if(selIdx >= 0) userSel = opts[selIdx];
                if (isCorrect) score += 1000; 

                const labels = container.querySelectorAll('.mcq-item');
                labels.forEach((label) => {
                    const checkbox = label.querySelector('input');
                    if(checkbox) {
                        checkbox.disabled = true;
                        const optIdx = parseInt(checkbox.value);
                        if (optIdx === q.correct) {
                            label.style.backgroundColor = 'rgba(76, 175, 80, 0.15)'; label.style.border = '1px solid #4CAF50'; label.style.padding = '2px 8px'; label.style.borderRadius = '4px';
                        } else if (optIdx === selIdx && !isCorrect) {
                            label.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'; label.style.border = '1px dashed #F44336'; label.style.padding = '2px 8px'; label.style.borderRadius = '4px';
                        }
                    }
                });
            }
            app.gameState.playerAnswers[i] = { qText: q.text, sel: userSel, cor: correctStr, isCor: isCorrect };
        });

        app.gameState.score = score;
        db.ref(`rooms/${app.currentRoomId}/scores/${encodeEmail(app.currentUser.email)}`).set(score);
        
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
        showNotification("សន្លឹកកិច្ចការត្រូវបានកែរួចរាល់! 💯", 3000);
        
        const btnGo = $('#goto-leaderboard-btn');
        if (btnGo) btnGo.style.display = 'block';
    };

    // --- 12. 📋 FIX BUG 2: ពិនិត្យចម្លើយឡើងវិញ នៅផ្ទាំង Ranking (Leaderboard View) ---
    const displayLeaderboard = (room) => {
        if (!room || !room.scores) return; const players = room.players ? Object.values(room.players) : [];
        const sorted = Object.entries(room.scores).map(([encodedEmail, score]) => { const p = players.find(player => player && player.email === decodeEmail(encodedEmail)); return { ...p, score }; }).filter(p => p && p.email).sort((a, b) => b.score - a.score);
        
        const pT = { 0: $('.place-1'), 1: $('.place-2'), 2: $('.place-3') }; 
        Object.values(pT).forEach(el => { if(el) el.style.visibility = 'hidden'; });
        sorted.slice(0, 3).forEach((p, i) => { const el = pT[i]; if (el) { el.style.visibility = 'visible'; el.querySelector('.podium-name').textContent = p.username; el.querySelector('.podium-score').textContent = `${p.score} ពិន្ទុ`; if(el.querySelector('.podium-avatar')) el.querySelector('.podium-avatar').src = p.avatarUrl; } });
        
        const listEl = $('#leaderboard-list'); 
        if(listEl) { 
            listEl.innerHTML = ''; 
            sorted.slice(3).forEach((p, i) => { listEl.innerHTML += `<li><img src="${p.avatarUrl}" class="leaderboard-list-avatar"><span>#${i + 4} ${p.username}</span><span class="leaderboard-score">${p.score} ពិន្ទុ</span></li>`; }); 
        }
        
        // គូរប្រអប់លទ្ធផលពិនិត្យចម្លើយឡើងវិញក្នុងទំព័រ Ranking ឱ្យស្អាតបំផុត
        const reviewContainer = $('#answer-review-container');
        if (reviewContainer) {
            reviewContainer.innerHTML = '<h3 style="margin-top:30px; margin-bottom:20px; color:#cf30aa; text-align:center; width:100%;">📋 ពិនិត្យលទ្ធផលចម្លើយឡើងវិញ</h3>';
            (app.gameState.playerAnswers || []).forEach((ans, index) => {
                if(!ans) return; 
                const isCor = ans.isCor;
                // សំអាតកូដអត្ថបទវែងៗកុំឱ្យជែករញ៉េរញ៉ៃភ្នែក
                let shortQText = ans.qText.split('|')[0].substring(0, 120);
                if(ans.qText.length > 120) shortQText += "...";

                reviewContainer.innerHTML += `
                    <div class="review-item" style="background: ${isCor ? '#e8f5e9' : '#ffebee'}; border: 1px solid ${isCor ? '#c8e6c9' : '#ffcdd2'}; padding: 18px; margin-bottom: 12px; border-radius: 8px; width:100%; text-align:left; box-sizing:border-box;">
                        <p style="margin: 0 0 10px 0; font-weight: bold; color: #000; line-height:1.5;">សំណួរទី ${index + 1}. ${shortQText}</p>
                        <p style="margin: 0; color: ${isCor ? '#2e7d32' : '#c62828'}; font-size:0.95em;">
                            ចម្លើយរបស់អ្នក៖ <b style="background:${isCor?'#c8e6c9':'#ffcdd2'}; padding:2px 6px; border-radius:4px;">${ans.sel}</b> ${isCor ? '✅' : '❌'}
                        </p>
                        ${!isCor ? `<p style="margin: 8px 0 0 0; color: #2e7d32; font-size:0.95em;">ចម្លើយត្រឹមត្រូវ៖ <b style="background:#c8e6c9; padding:2px 6px; border-radius:4px;">${ans.cor}</b></p>` : ''}
                    </div>
                `;
            });
        }
    };
    
    // --- 13. Event Listeners ---
    function addEventListeners() {
        document.body.addEventListener('click', e => {
            const t = e.target;
            if (t.matches('#show-login-btn') || t.matches('#back-to-login-link')) { e.preventDefault(); showView('login'); }
            if (t.matches('#go-to-signup-btn')) { e.preventDefault(); showView('signup'); }
            if (t.matches('.back-to-home-link')) { e.preventDefault(); handleGuestLogin(); }
            if (t.matches('#logout-btn')) handleLogout();
            if (t.matches('#admin-panel-btn')) { showView('admin'); updateAdminUI(); }
            if (t.matches('#login-btn')) handleLogin();
            if (t.matches('#back-to-home-admin-btn') || t.matches('#back-to-home-from-leaderboard-btn') || t.matches('#back-to-home-from-test-btn')) { document.body.style.backgroundColor = ''; goHome(); }
            if (t.matches('#signup-btn')) handleSignup();
            
            if (t.closest('.host-quiz-btn') || t.closest('.host-test-btn')) { 
                const quizId = (t.closest('.host-quiz-btn') || t.closest('.host-test-btn')).dataset.quizId; 
                const room = { id: `room_${Date.now()}`, quizId, host: app.currentUser.email, status: 'waiting', isTest: false, players: {}, scores: {} }; 
                db.ref('rooms/' + room.id).set(room); 
                const joinLink = `${window.location.origin}${window.location.pathname}?room=${room.id}`; 
                showModal("បន្ទប់ប្រឡងត្រូវបានបង្កើត!", `<div class="link-container" style="display:flex;gap:10px;"><input id="room-link-input" class="input" type="text" value="${joinLink}" style="flex:1;" readonly><button id="copy-link-btn" class="magic-btn" style="width:auto;margin:0;padding:0 20px !important;">ចម្លង</button></div><button id='modal-ok-btn' class="magic-btn mt-20">ចូលបន្ទប់គ្រប់គ្រង</button>`, () => joinRoom(room.id)); 
            }
            
            if (t.matches('#start-game-btn')) {
                app.currentQuiz = app.quizzes.find(q => q.id === app.rooms.find(r=>r.id===app.currentRoomId).quizId);
                startDigitalExam(); 
            }
            
            if (t.matches('#close-room-btn')) { if (confirm('តើអ្នកពិតជាចង់បិទបន្ទប់?')) { db.ref('rooms/' + app.currentRoomId).remove(); goHome(); } }
            if (t.matches('#submit-exam-btn')) submitDigitalExam();
            
            // 💥 FIX BUG 1: ចុចប៊ូតុងនេះ ទើបបិទក្រដាសសចោល រួចបើកផ្ទាំង Ranking ស្អាតបាត ១០០%
            if (t.matches('#goto-leaderboard-btn')) {
                document.body.style.backgroundColor = ''; // Reset BG Gray
                showView('leaderboard'); 
                displayLeaderboard(app.rooms.find(r => r.id === app.currentRoomId));
            }

            if (t.matches('#zoom-in-btn')) { app.currentZoom += 2; $('#exam-paper-content').style.fontSize = app.currentZoom + 'px'; }
            if (t.matches('#zoom-out-btn')) { app.currentZoom = Math.max(12, app.currentZoom - 2); $('#exam-paper-content').style.fontSize = app.currentZoom + 'px'; }
            if (t.matches('#save-quiz-btn')) handleSaveQuiz();
        });
    }
    init();
});

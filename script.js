document.addEventListener('DOMContentLoaded', () => {
    // --- 💥 THE ABSOLUTE CSS FIXER (Force Break-Word & Clean Layout) ---
    if (!document.getElementById('ultimate-zin-fixes')) {
        const style = document.createElement('style');
        style.id = 'ultimate-zin-fixes';
        style.innerHTML = `
            #leaderboard-view {
                flex-direction: column !important;
                justify-content: flex-start !important;
                align-items: center !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding-bottom: 50px !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            #answer-review-container {
                width: 100% !important;
                max-width: 800px !important;
                box-sizing: border-box !important;
                padding: 15px !important;
                margin: 20px auto !important;
                overflow: hidden !important;
            }
            .review-item {
                width: 100% !important;
                box-sizing: border-box !important;
                word-wrap: break-word !important;
                overflow-wrap: anywhere !important; /* 💥 FORCES LONG DOTS/TEXT TO BREAK */
                word-break: break-word !important;
                white-space: normal !important;
                display: block !important;
                overflow: hidden !important;
            }
            .review-item p {
                word-wrap: break-word !important;
                overflow-wrap: anywhere !important;
                white-space: pre-wrap !important;
                max-width: 100% !important;
            }
        `;
        document.head.appendChild(style);
    }

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
        currentQuiz: null, gameState: {}, currentZoom: window.innerWidth <= 768 ? 12 : 14,
        ownerEmail: "lychayzooba@gmail.com", 
        // 💥 UPGRADE: Strictly enforced JSON and chemical formula formatting
        aiConversationHistory: `System: You are an expert Cambodian Teacher. CRITICAL RULES: 
        1. OUTPUT ONLY VALID JSON. No markdown formatting, no conversational text before or after the JSON. 
        2. Automatically format all math and chemical equations perfectly using standard Unicode characters (e.g., use correct subscripts and arrows). For example, convert raw text like "na + o2 /rightarrrow na2o" into "Na + O₂ ➔ Na₂O".`
    };
    let dataLoaded = false;
    window.latestAIQuizData = null; 

    // --- 3. Base Utilities ---
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    const views = { 
        login: $('#login-view'), signup: $('#signup-view'), home: $('#home-view'), 
        admin: $('#admin-view'), lobby: $('#quiz-lobby-view'), game: $('#quiz-game-view'), 
        leaderboard: $('#leaderboard-view'), testResult: $('#test-result-view') 
    };
    
    const showView = (name) => { 
        Object.keys(views).forEach(key => { 
            if (views[key]) {
                views[key].style.setProperty('display', 'none', 'important');
                views[key].style.visibility = 'hidden';
            }
        }); 
        if (views[name]) {
            const displayType = ['login', 'signup', 'leaderboard', 'lobby', 'game', 'testResult'].includes(name) ? 'flex' : 'block';
            views[name].style.setProperty('display', displayType, 'important'); 
            views[name].style.visibility = 'visible';
        }
    };
    
    const encodeEmail = (e) => e ? e.replace(/\./g, ',') : '';
    const decodeEmail = (e) => e ? e.replace(/,/g, '.') : '';
    const showModal = (title, bodyHtml, onOk) => { const t = $('#modal-title'); const b = $('#modal-body'); const o = $('#modal-overlay'); if(t && b && o) { t.textContent = title; b.innerHTML = bodyHtml; o.style.display = 'flex'; const ok = $('#modal-ok-btn'); if (ok) { ok.onclick = () => { o.style.display = 'none'; if (onOk) onOk(); }; } } };
    const showNotification = (msg, dur = 3000) => { const n = $('#global-notification'); if(n) { n.innerHTML = msg; n.style.display = 'block'; setTimeout(() => { if (n.innerHTML === msg) n.style.display = 'none'; }, dur); } };

    const getKhmerDate = () => {
        const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
        const khmerNumbers = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
        const toKhmerNum = (num) => String(num).split('').map(n => khmerNumbers[parseInt(n)] || n).join('');
        const d = new Date();
        const day = toKhmerNum(d.getDate().toString().padStart(2, '0'));
        const month = months[d.getMonth()];
        const year = toKhmerNum(d.getFullYear());
        return `${day} ${month} ${year}`;
    };
    
    const toKhmerNumGlobal = (num) => {
        const khmerNumbers = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
        return String(num).split('').map(n => khmerNumbers[parseInt(n)] || n).join('');
    };

    const getKhmerChar = (index) => {
        const chars = ['ក','ខ','គ','ឃ','ង','ច','ឆ','ជ','ឈ','ញ','ដ','ឋ','ឌ','ឍ','ណ','ត','ថ','ទ','ធ','ន','ប','ផ','ព','ភ','ម','យ','រ','ល','វ','ស','ហ','ឡ','អ'];
        return chars[index] || String.fromCharCode(65+index);
    };

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
            if (app.currentRoomId && !app.rooms.find(r => r.id === app.currentRoomId) && ($('#quiz-game-view')?.style.display !== 'none')) forceGoHome("បន្ទប់ត្រូវបានបិទដោយ Admin។"); 
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
    
    const renderRooms = (term = "") => { 
        const list = $('#rooms-list'); 
        if(!list) return; 
        list.innerHTML = ''; 
        let available = app.rooms.filter(r => r.status === 'waiting' || (r.isTest && r.status === 'active')); 
        if (term) available = available.filter(room => { 
            const q = app.quizzes.find(q => q.id === room.quizId); 
            const h = app.users.find(u => u.email === room.host); 
            return (q && (q.title || q.quiz_title || '').toLowerCase().includes(term.toLowerCase())) || (h && h.username.toLowerCase().includes(term.toLowerCase())); 
        }); 
        if (available.length === 0) { list.innerHTML = '<p style="color:#aaa;">មិនមានបន្ទប់កំពុងរង់ចាំទេ។</p>'; return; } 
        available.forEach(room => { 
            const quiz = app.quizzes.find(q => q.id === room.quizId); 
            const host = app.users.find(u => u.email === room.host); 
            if (quiz) { 
                const card = document.createElement('div'); card.className = 'room-card'; card.addEventListener('click', () => { if (app.currentUser) joinRoom(room.id); else handleGuestLogin(room.id); }); 
                card.innerHTML = `<h3 style="color:#cf30aa;">${quiz.title || quiz.quiz_title || 'វិញ្ញាសាប្រឡង'}</h3><p style="margin-bottom:10px; color:#c0b9c0;">បង្កើតដោយ៖ ${host ? host.username : 'N/A'}</p>${room.isTest ? '<span style="background:#cf30aa; color:#fff; padding:4px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">📝 ការប្រឡង (Test)</span>' : '<span style="background:#402fb5; color:#fff; padding:4px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">🎮 Live Game</span>'}`; 
                list.appendChild(card); 
            } 
        }); 
    };
    
    $('#room-search-input')?.addEventListener('input', (e) => renderRooms(e.target.value.trim()));
    
    const updateAdminUI = () => { 
        if (!app.currentUser || (!app.currentUser.isAdmin && !app.currentUser.isOwner)) return; 
        const quizList = $('#manage-quizzes-list'); 
        if(quizList) { 
            quizList.innerHTML = ''; 
            (app.quizzes || []).forEach(q => { 
                const li = document.createElement('li'); 
                li.innerHTML = `<span>${q.title || q.quiz_title || 'វិញ្ញាសាប្រឡង'}</span><div style="display:flex;gap:5px;"><button class="host-quiz-btn magic-btn small-btn" data-quiz-id="${q.id}" style="padding:8px !important;">Live 🎮</button><button class="host-test-btn magic-btn small-btn" data-quiz-id="${q.id}" style="padding:8px !important; background:#cf30aa !important;">ប្រឡង 📝</button><button class="delete-quiz-btn secondary-btn small-btn" data-quiz-id="${q.id}" style="color:#dc3545; border-color:#dc3545;">លុប</button></div>`; 
                quizList.appendChild(li); 
            }); 
        } 
    };

    // --- 7. AI BOT Logic (THE ULTIMATE PARSER) ---
    const appendToChat = (role, text) => { 
        const chatBox = $('#admin-chat-history'); 
        if(!chatBox) return; 
        const msgDiv = document.createElement('div'); 
        msgDiv.className = `chat-msg ${role === 'user' ? 'user-msg' : 'bot-msg'}`; 
        msgDiv.textContent = typeof text === 'object' ? JSON.stringify(text, null, 2) : text; 
        chatBox.appendChild(msgDiv); 
        chatBox.scrollTop = chatBox.scrollHeight; 
    };
    
    window.applyChatQuiz = async () => {
        if (!window.latestAIQuizData) return alert('គ្មានសំណួរថ្មីទេ!');
        const quizId = `quiz_${Date.now()}`;
        const newQuiz = { id: quizId, ...window.latestAIQuizData, createdBy: app.currentUser.email, createdAt: Date.now() };
        try {
            await db.ref('quizzes/' + quizId).set(newQuiz);
            alert('រក្សាទុកចូល Database បានជោគជ័យ! ✅');
            $('#admin-chat-history').innerHTML = ''; updateAdminUI();
        } catch (err) { alert('បរាជ័យក្នុងការរក្សាទុក: ' + err.message); }
    };

    // 💥 1. PARSER ដ៏រឹងមាំ (FIXED MATCHING LOGIC)
    const processAIResponseForChat = (aiResultText) => {
        try {
            let rawString = typeof aiResultText === 'object' ? (aiResultText?.message?.content || aiResultText?.text || JSON.stringify(aiResultText)) : String(aiResultText);
            
            let jsonString = rawString;
            const firstBrace = rawString.indexOf('{');
            const lastBrace = rawString.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonString = rawString.substring(firstBrace, lastBrace + 1);
            }

            let cleanJson = jsonString.trim();
            let aiResult = JSON.parse(cleanJson);

            let finalSections = [];
            let secCounter = 1;
            const toRoman = (num) => ["I", "II", "III", "IV", "V"][num-1] || String(num);

            if (aiResult.sections && Array.isArray(aiResult.sections)) {
                finalSections = aiResult.sections;
            } else {
                const findKey = (obj, keyName) => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj[keyName]) return obj[keyName];
                    for (let k in obj) {
                        let res = findKey(obj[k], keyName);
                        if (res) return res;
                    }
                    return null;
                };

                let mcq = findKey(aiResult, 'multiple_choice_section') || findKey(aiResult, 'multiple_choice') || findKey(aiResult, 'questions');
                let fib = findKey(aiResult, 'fill_in_the_blanks_section') || findKey(aiResult, 'fill_in_the_blank');
                let matching = findKey(aiResult, 'matching_section') || findKey(aiResult, 'matching');

                if (mcq && Array.isArray(mcq)) {
                    finalSections.push({
                        section_id: toRoman(secCounter++),
                        section_title: "សំណួរជ្រើសរើស",
                        question_type: "multiple_choice",
                        questions: mcq.map((q, idx) => ({
                            question_number: q.question_number || q.id || (idx + 1),
                            question_text: q.question_text || q.question || q.text || `សំណួរ ${idx+1}`,
                            options: q.options ? (Array.isArray(q.options) ? q.options : Object.entries(q.options).map(([k,v]) => ({key:k, text:v}))) : [],
                            correct_answer: q.correct_answer || ""
                        }))
                    });
                }

                if (fib && Array.isArray(fib)) {
                    finalSections.push({
                        section_id: toRoman(secCounter++),
                        section_title: "សំណួរបំពេញចន្លោះ",
                        question_type: "fill_in_the_blank",
                        questions: fib.map((q, idx) => ({
                            question_number: q.paragraph_id || q.id || (idx + 1),
                            question_text: q.text || q.question_text || "",
                            correct_answer: q.answers ? (typeof q.answers === 'object' ? Object.values(q.answers).join(",") : q.answers) : ""
                        }))
                    });
                }

                if (matching) {
                    let colA = matching.left_side || matching.column_A || matching.left || [];
                    let colB = matching.right_side || matching.column_B || matching.right || [];
                    let cMatch = matching.correct_matches || matching.matches || [];

                    finalSections.push({
                        section_id: toRoman(secCounter++),
                        section_title: "សំណួរផ្គូផ្គង",
                        question_type: "matching",
                        // 💥 ចាប់យក Key និង Text បានយ៉ាងសុក្រិត ១០០% ទោះជា AI ចេញទម្រង់ណាក៏ដោយ
                        column_A: Array.isArray(colA) ? colA.map((item, idx) => {
                            if (typeof item === 'object' && item.key && item.text) {
                                return { key: toKhmerNumGlobal(item.key), text: item.text };
                            }
                            let text = typeof item === 'string' ? item : (item.text || JSON.stringify(item));
                            let match = text.match(/^([០-៩0-9]+)[\.\)\s]+(.*)/);
                            return match ? { key: toKhmerNumGlobal(match[1]), text: match[2].trim() } : { key: toKhmerNumGlobal(idx+1), text: text.trim() };
                        }) : [],
                        column_B: Array.isArray(colB) ? colB.map((item, idx) => {
                            if (typeof item === 'object' && item.key && item.text) {
                                return { key: item.key, text: item.text };
                            }
                            let text = typeof item === 'string' ? item : (item.text || JSON.stringify(item));
                            let match = text.match(/^([ក-អA-Za-z]+)[\.\)\s]+(.*)/);
                            return match ? { key: match[1], text: match[2].trim() } : { key: getKhmerChar(idx), text: text.trim() };
                        }) : [],
                        correct_matches: Array.isArray(cMatch) ? cMatch.map(m => {
                            let kA = m.left_index || m.left || m.column_A_key || m.id;
                            let kB = m.right_letter || m.right || m.column_B_key || m.key;
                            return {
                                column_A_key: kA ? toKhmerNumGlobal(String(kA)) : "", 
                                column_B_key: kB ? String(kB) : ""
                            };
                        }).filter(m => m.column_A_key && m.column_B_key) : []
                    });
                }
            }

            if (finalSections.length > 0) {
                window.latestAIQuizData = { sections: finalSections };
                const chatBox = $('#admin-chat-history');
                if(chatBox) {
                    const msgDiv = document.createElement('div'); msgDiv.className = `chat-msg bot-msg`;
                    msgDiv.innerHTML = `<div style="margin-bottom:10px; color:#fff;">✅ ខ្ញុំបានបំប្លែងវិញ្ញាសាពី AI រួចរាល់ហើយ!</div><button class="magic-btn small-btn" onclick="applyChatQuiz()" style="width:100%; padding:10px !important; background:#00b894 !important;">✅ រក្សាទុកវិញ្ញាសា</button>`;
                    chatBox.appendChild(msgDiv); chatBox.scrollTop = chatBox.scrollHeight;
                }
            } else {
                throw new Error("រកមិនឃើញទម្រង់សំណួរក្នុង JSON ទេ។");
            }
        } catch (e) {
            console.error("🚨 JSON Parsing Failed:", e.message);
            let fallbackText = typeof aiResultText === 'string' ? aiResultText : JSON.stringify(aiResultText);
            appendToChat('bot', `[កំហុសអានទិន្នន័យ: ${e.message}]\n\n` + fallbackText.trim());
        }
    };

    // 💥 2. PROMPT ដ៏តឹងរ៉ឹង 
    const handleTextBotCreate = async () => {
        const textInput = $('#bot-text-input').value.trim(); if (!textInput) return alert("សូមសរសេរប្រធានបទ។");
        $('#bot-text-create-btn').innerHTML = "កំពុងដំណើរការ..."; $('#bot-text-create-btn').disabled = true;
        
        let PROMPT = `Topic: "${textInput}". Generate a full exam in Khmer. 
CRITICAL: You MUST output ONLY valid JSON matching EXACTLY this structure below. Do not invent new fields.
{
  "sections": [
    {
      "section_id": "I",
      "section_title": "សំណួរជ្រើសរើស",
      "question_type": "multiple_choice",
      "questions": [
        {
          "question_number": 1,
          "question_text": "សំណួរ...",
          "options": [ {"key": "ក", "text": "ចម្លើយ១"}, {"key": "ខ", "text": "ចម្លើយ២"} ],
          "correct_answer": "ក"
        }
      ]
    },
    {
      "section_id": "II",
      "section_title": "សំណួរបំពេញចន្លោះ",
      "question_type": "fill_in_the_blank",
      "questions": [
        {
          "question_number": 1,
          "question_text": "ខ្មែរយើងប្រើ [blank_1] សម្រាប់សំពះ ហើយបរទេសប្រើ [blank_2]។",
          "correct_answer": "ដៃ,ការចាប់ដៃ"
        }
      ]
    },
    {
      "section_id": "III",
      "section_title": "សំណួរផ្គូផ្គង",
      "question_type": "matching",
      "column_A": [ {"key": "១", "text": "ឆ្កែ"} ],
      "column_B": [ {"key": "ក", "text": "សត្វចិញ្ចើម"} ],
      "correct_matches": [ {"column_A_key": "១", "column_B_key": "ក"} ]
    }
  ]
}
OUTPUT ONLY JSON. NO MARKDOWN. NO CONVERSATION.`;
        
        appendToChat('user', `[ប្រធានបទ: ${textInput}] សូមបង្កើតវិញ្ញាសាពេញលេញ`);
        try { 
            // 💥 UPGRADE: model changed to 'gemini-3.1-pro-preview'
            const response = await puter.ai.chat(app.aiConversationHistory + "\nUser: " + PROMPT, { model: 'gemini-3.1-pro-preview' }); 
            processAIResponseForChat(typeof response === 'object' ? (response?.message?.content || response?.text) : response); 
        } 
        catch (error) { appendToChat('bot', `Error: ${error.message}`); } 
        finally { $('#bot-text-create-btn').innerHTML = "✨ បង្កើតពីអត្ថបទ"; $('#bot-text-create-btn').disabled = false; }
    };

    const handleAdminChatSend = async () => {
        const inputEl = $('#admin-chat-input'); if (!inputEl) return;
        const msg = inputEl.value.trim(); if (!msg) return;
        appendToChat('user', msg); inputEl.value = '';
        const sendBtn = $('#admin-chat-send-btn'); if (sendBtn) sendBtn.disabled = true;
        try {
            // 💥 UPGRADE: model changed to 'gemini-3.1-pro-preview'
            const response = await puter.ai.chat(app.aiConversationHistory + `\nUser: ${msg}\nAssistant: `, { model: 'gemini-3.1-pro-preview' });
            processAIResponseForChat(typeof response === 'object' ? (response?.message?.content || response?.text) : response);
        } catch (err) { appendToChat('bot', `Error: ${err.message}`); } 
        finally { if (sendBtn) sendBtn.disabled = false; }
    };

    // --- 8. Save Quiz (Manual Editor Logic) ---
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
            const newQuiz = { 
                id: quizId, title: title, 
                sections: [{
                    section_id: "I", section_title: "វិញ្ញាសាជ្រើសរើស", question_type: "multiple_choice",
                    questions: questions.map((q, idx) => ({
                        question_number: idx + 1, question_text: q.text,
                        options: q.answers.map((ans, aIdx) => ({ key: String.fromCharCode(65+aIdx), text: ans })),
                        correct_answer: String.fromCharCode(65+q.correct)
                    }))
                }],
                createdBy: app.currentUser.email, createdAt: Date.now() 
            };
            await db.ref('quizzes/' + quizId).set(newQuiz);
            alert('រក្សាទុកបានជោគជ័យ! ✅'); $('#quiz-title').value = ''; $('#questions-container').innerHTML = ''; updateAdminUI();
        } catch (err) { alert("Error: " + err.message); } finally { btn.disabled = false; btn.innerHTML = orig; }
    };

    // --- 9. Lobby System ---
    const joinRoom = (roomId) => { 
        db.ref('rooms/' + roomId).once('value', snapshot => { 
            const room = snapshot.val(); 
            if (!room) return forceGoHome("បន្ទប់នេះមិនមានទេ។"); 
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
        $('#lobby-quiz-title').textContent = quiz ? (quiz.title || quiz.quiz_title) : 'Loading...'; 
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

    // --- 10. 📝 THE ULTIMATE ZIN A4 PAPER LAYOUT ---
    const startDigitalExam = () => { 
        app.currentQuiz = app.quizzes.find(q => q.id === app.rooms.find(r=>r.id===app.currentRoomId).quizId);
        showView('game'); 
        const gameView = $('#quiz-game-view');
        app.gameState = { score: 0, playerAnswers: {}, isSubmitted: false };
        app.currentZoom = window.innerWidth <= 768 ? 12 : 14; 

        let styleStr = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Moul&family=Moulpali&display=swap');
                
                #quiz-game-view { background: #525659; position: absolute; top: 0; left: 0; right: 0; min-height: 100vh; z-index: 100; overflow-y: auto; overflow-x: hidden; }
                .paper-wrapper { padding: 20px; display: flex; justify-content: center; align-items: flex-start; min-height: 100%; }
                
                .real-a4-paper { 
                    background: #ffffff; color: #000000; width: 100%; max-width: 21cm; min-height: 29.7cm; height: auto; 
                    padding: 1.5cm 1.5cm; 
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5); 
                    font-family: 'Khmer OS Battambang', 'Khmer OS', serif; line-height: 1.5;
                    box-sizing: border-box; margin-bottom: 80px; overflow: visible;
                }
                
                .exam-header-a4 { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; position: relative; text-align: center;}
                
                .school-title { font-family: 'Khmer OS Moul Light', 'Moul', 'Moulpali', 'Khmer OS Battambang', serif; font-size: 1.2em; margin: 0; }
                .quiz-title { font-family: 'Khmer OS Moul Light', 'Moul', 'Moulpali', 'Khmer OS Battambang', serif; font-size: 1.1em; margin: 10px 0 5px 0; }
                
                .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 20px; font-size: 0.9em; }
                .dotted-line { border-bottom: 1.5px dotted #000; display: inline-block; width: 120px; margin-left: 5px; }
                
                .section-title { font-weight: bold; margin: 20px 0 10px 0; font-size: 1.05em; text-decoration: underline;}
                .q-container { margin-bottom: 15px; }
                .q-text { font-weight: bold; margin-bottom: 5px; word-wrap: break-word; overflow-wrap: break-word; line-height: 2.2;}
                
                .mcq-options-container { display: flex; flex-wrap: wrap; gap: 15px; padding-left: 15px; }
                .mcq-item { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; color: black !important; white-space: nowrap; }
                .paper-checkbox { appearance: none; width: 16px; height: 16px; border: 1.5px solid #000; border-radius: 2px; position: relative; cursor: pointer; background: #fff; margin-top: 1px;}
                .paper-checkbox:checked::after { content: "✔"; position: absolute; top: -5px; left: 1px; color: #000; font-size: 16px; font-weight: bold; }
                
                .matching-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.9em;}
                .matching-table th, .matching-table td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: middle; word-wrap: break-word;}
                .matching-table th { background: #f0f0f0; text-align: center; font-weight: bold;}
                
                .match-input { 
                    width: 30px !important; text-align: center; 
                    border: none !important; border-bottom: 2px dotted #000 !important; 
                    outline: none !important; font-weight: bold; color: blue !important; 
                    font-size: 1.1em; background: transparent !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; margin-left: 2px;
                }
                .actual-fill-input { 
                    border: none !important; border-bottom: 2px dotted #000 !important; 
                    outline: none !important; background: transparent !important; 
                    font-size: 1em; color: blue !important; 
                    padding: 0 5px !important; min-width: 60px; width: auto; text-align: center; font-weight: bold; box-shadow: none !important; border-radius: 0 !important; margin: 0 5px;
                }
                
                .zoom-panel { position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: flex; gap: 10px; }
                .zoom-btn { background: #2c3e50; color: #fff; border: 1px solid #fff; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 14px;}
                .btn-submit-a4 { display: block; width: 100%; background: #000; color: #fff; border: none; padding: 12px; font-size: 1.1em; font-family: inherit; cursor: pointer; margin-top: 30px; border-radius: 5px; transition: 0.3s;}
                .btn-goto-leaderboard { background: #cf30aa; display: none; margin-top: 15px; position: sticky; bottom: 20px; z-index: 99;}
                
                @media (max-width: 768px) {
                    .paper-wrapper { padding: 10px 5px; }
                    .real-a4-paper { padding: 15px 10px; }
                    .student-info { grid-template-columns: 1fr; }
                    .mcq-options-container { flex-direction: column; gap: 8px; } 
                }
            </style>
        `;

        const currentDateKhmer = getKhmerDate(); 

        let html = styleStr + `
            <div class="zoom-panel"><button class="zoom-btn" id="zoom-in-btn">🔍+</button><button class="zoom-btn" id="zoom-out-btn">🔍-</button></div>
            <div class="paper-wrapper">
                <div class="real-a4-paper" id="exam-paper-content" style="font-size: ${app.currentZoom}px;">
                    <div class="exam-header-a4">
                        <div style="position: absolute; right: 0; top: 0; border: 1.5px solid #000; border-radius: 50%; width: 40px; height: 40px; text-align: center; line-height: 40px; font-weight: bold; font-size:0.9em; font-family: 'Khmer OS Battambang';">៥០</div>
                        <p class="school-title">វិទ្យាល័យព្រះអង្គឌួង សាលារៀនជំនាន់ថ្មី</p>
                        <div class="quiz-title">${app.currentQuiz.quiz_title || app.currentQuiz.title || "វិញ្ញាសាប្រឡង"}</div>
                        <div style="font-size:0.85em; font-family: 'Khmer OS Battambang'; margin-top: 5px;">កាលបរិច្ឆេទ៖ ${currentDateKhmer} | រយៈពេល៖ ${app.currentQuiz.duration_minutes || 45}នាទី</div>
                    </div>
                    <div class="student-info">
                        <div>នាមត្រកូល និងនាមខ្លួន៖ <b style="color:blue;">${app.currentUser.username}</b> <span class="dotted-line" style="width: 50px;"></span></div>
                        <div>លេខតុ៖ <span class="dotted-line"></span></div>
                        <div>ថ្នាក់ទី៖ <span class="dotted-line"></span></div>
                        <div>ថ្ងៃខែឆ្នាំកំណើត៖ <span class="dotted-line"></span></div>
                    </div>
        `;

        let globalQIndex = 0;
        let sections = app.currentQuiz.sections || [{ section_id: "I", section_title: "វិញ្ញាសា", question_type: "multiple_choice", questions: app.currentQuiz.questions }];

        sections.forEach(sec => {
            html += `<div class="section-title">${sec.section_id || ''}. ${sec.section_title || ''}</div>`;
            
            if (sec.question_type === 'matching') {
                html += `<div class="q-container" data-globalq="${globalQIndex}" data-type="match">`;
                html += `<table class="matching-table"><tr><th style="width:40%">A</th><th style="width:45%">B</th><th style="width:15%">(C)<br>ចម្លើយ</th></tr>`;
                let maxRows = Math.max((sec.column_A||[]).length, (sec.column_B||[]).length);
                for(let r=0; r<maxRows; r++) {
                    let aText = sec.column_A && sec.column_A[r] ? `${sec.column_A[r].key}. ${sec.column_A[r].text}` : '';
                    let bText = sec.column_B && sec.column_B[r] ? `${sec.column_B[r].key}. ${sec.column_B[r].text}` : '';
                    let rKey = sec.column_A && sec.column_A[r] ? sec.column_A[r].key : '';
                    html += `<tr><td>${aText}</td><td>${bText}</td><td style="text-align:center; vertical-align:middle; font-weight:bold;">${rKey ? `${rKey} ➔ <input type="text" class="match-input" data-row="${rKey}" autocomplete="off">` : ''}</td></tr>`;
                }
                html += `</table>`;
                
                let correctStr = "";
                if (sec.correct_matches) { correctStr = sec.correct_matches.map(m => `${m.column_A_key}-${m.column_B_key}`).join(','); }
                
                html += `<input type="hidden" id="correct_match_${globalQIndex}" value="${correctStr}">`;
                html += `</div>`;
                globalQIndex++;
            } 
            else {
                (sec.questions || []).forEach((q) => {
                    html += `<div class="q-container" data-globalq="${globalQIndex}" data-type="${sec.question_type}">`;
                    
                    if (sec.question_type === 'fill_in_the_blank') {
                        let text = q.question_text || q.question || q.text || "";
                        let formattedQ = text.replace(/\[blank_\d+\]|\.{4,}|\_+/g, `<input type="text" class="actual-fill-input" autocomplete="off">`);
                        html += `<div class="q-text">${q.question_number ? q.question_number+'. ' : ''}${formattedQ}</div>`;
                        let correctAns = q.correct_answer || "";
                        html += `<input type="hidden" id="correct_fill_${globalQIndex}" value="${correctAns}">`;
                    } 
                    else {
                        html += `<div class="q-text">${q.question_number ? q.question_number+'. ' : ''}${q.question_text || q.question || q.text}</div>`;
                        html += `<div class="mcq-options-container">`;
                        (q.options || []).forEach((opt, j) => {
                            let optKey = opt.key || (j===0?'ក':j===1?'ខ':j===2?'គ':'ឃ');
                            let optText = opt.text || opt;
                            html += `<label class="mcq-item"><input type="radio" name="q_${globalQIndex}" value="${optKey}" class="paper-checkbox"> <span>${optKey}. ${optText}</span></label>`;
                        });
                        html += `</div>`;
                        let correctAns = q.correct_answer || ""; 
                        html += `<input type="hidden" id="correct_mcq_${globalQIndex}" value="${correctAns}">`;
                    }
                    html += `</div>`;
                    globalQIndex++;
                });
            }
        });

        html += `<button id="submit-exam-btn" class="btn-submit-a4">ប្រគល់សន្លឹកកិច្ចការ</button>`;
        html += `<button id="goto-leaderboard-btn" class="btn-submit-a4 btn-goto-leaderboard">🏆 ទៅកាន់តារាងចំណាត់ថ្នាក់</button>`;
        html += `</div></div>`; 
        gameView.innerHTML = html;
    };

    // --- 11. 💥 THE ABSOLUTE BULLETPROOF GRADER (NO ZEROS) ---
    const standardizeText = (text) => {
        if(!text) return "";
        const khmerNums = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
        let s = text.replace(/[\s\.\,\?\!។ៗ៖៘៙\-\_\➔]/g, '').toLowerCase();
        s = s.replace(/ណ្ត/g, 'ណ្ដ');
        s = s.replace(/[០-៩]/g, m => khmerNums.indexOf(m)); 
        return s;
    };

    const smartKhmerCompare = (u, c) => {
        if (!u || !c) return false;
        let cu = standardizeText(u);
        let cc = standardizeText(c);
        return cu === cc || (cc.includes(cu) && cu.length >= 3) || (cu.includes(cc) && cc.length >= 3);
    };

    const submitDigitalExam = () => {
        if (app.gameState.isSubmitted) return;
        if (!confirm("តើអ្នកពិតជាចង់ប្រគល់សន្លឹកកិច្ចការមែនទេ?")) return;

        app.gameState.isSubmitted = true;
        $('#submit-exam-btn').style.display = 'none'; 
        let score = 0;
        
        $$('.q-container').forEach((container) => {
            const i = container.dataset.globalq;
            const qType = container.dataset.type;
            let isCorrect = false; let userSel = "មិនបានឆ្លើយ"; let correctStr = "";

            if (qType === 'match') {
                correctStr = $(`#correct_match_${i}`).value;
                let correctMapping = {};
                
                if (correctStr) {
                    let mappingList = correctStr.split(',');
                    mappingList.forEach(m => {
                        let parts = m.split('-');
                        if(parts.length >= 2) correctMapping[parts[0].trim()] = parts[1].trim();
                    });
                }
                
                let allMatchCorrect = true; let userSelStr = "";
                const inputs = container.querySelectorAll('.match-input');
                inputs.forEach(inp => {
                    let rNum = inp.dataset.row;
                    let uVal = inp.value.trim();
                    let cVal = correctMapping[rNum] || "";
                    
                    userSelStr += `${rNum}➔${uVal || '?'} `;
                    inp.disabled = true;
                    
                    let cu = standardizeText(uVal);
                    let cc = standardizeText(cVal);

                    if (cu && cc && cu === cc) {
                        inp.style.color = '#1b5e20'; inp.style.borderBottomColor = '#1b5e20';
                    } else {
                        allMatchCorrect = false;
                        inp.style.color = '#b71c1c'; inp.style.borderBottomColor = '#b71c1c'; inp.style.textDecoration = 'line-through';
                        
                        let safeCVal = cVal || "អត់ចម្លើយ";
                        let corrSpan = document.createElement('span'); 
                        corrSpan.innerHTML = ` <b style="color:#1b5e20; font-size:1em; text-decoration:none;">(${safeCVal})</b>`;
                        inp.parentNode.appendChild(corrSpan);
                    }
                });
                isCorrect = allMatchCorrect && inputs.length > 0;
                if(isCorrect) score += 1000; userSel = userSelStr.trim();

            } else if (qType === 'fill_in_the_blank') {
                correctStr = $(`#correct_fill_${i}`).value;
                const inputs = container.querySelectorAll('.actual-fill-input');
                let correctArr = correctStr.split(',');
                
                let allFillCorrect = true;
                let combinedUserText = "";
                
                inputs.forEach((inp, idx) => { 
                    let uVal = inp.value.trim();
                    combinedUserText += uVal + " "; 
                    inp.disabled = true; 
                    
                    let cVal = correctArr[idx] ? correctArr[idx].trim() : "";
                    let isMatch = smartKhmerCompare(uVal, cVal);
                    
                    inp.style.color = isMatch ? '#1b5e20' : '#b71c1c';
                    inp.style.borderBottomColor = isMatch ? '#1b5e20' : '#b71c1c';
                    if(!isMatch) {
                        allFillCorrect = false;
                        inp.style.textDecoration = 'line-through';
                        let corrSpan = document.createElement('span'); 
                        corrSpan.innerHTML = ` ➔<b style="color:#1b5e20; font-size:0.9em; text-decoration:none;">${cVal}</b>`;
                        inp.parentNode.insertBefore(corrSpan, inp.nextSibling);
                    }
                });
                isCorrect = allFillCorrect && inputs.length > 0;
                userSel = combinedUserText.trim();
                if(isCorrect) score += 1000;

            } else {
                correctStr = $(`#correct_mcq_${i}`).value;
                const selectedRadio = container.querySelector(`input[type="radio"]:checked`);
                userSel = selectedRadio ? selectedRadio.value : "មិនបានឆ្លើយ";
                isCorrect = standardizeText(userSel) === standardizeText(correctStr);
                if (isCorrect) score += 1000; 

                container.querySelectorAll('.mcq-item').forEach((label) => {
                    const cb = label.querySelector('input'); if(!cb) return;
                    cb.disabled = true;
                    if (standardizeText(cb.value) === standardizeText(correctStr)) { label.style.backgroundColor = 'rgba(76, 175, 80, 0.15)'; label.style.border = '1px solid #4CAF50'; label.style.borderRadius = '4px'; label.style.padding = '2px 5px';}
                    else if (cb.value === userSel && !isCorrect) { label.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'; label.style.border = '1px dashed #F44336'; label.style.borderRadius = '4px'; label.style.padding = '2px 5px';}
                });
            }
            app.gameState.playerAnswers[i] = { qText: container.querySelector('.q-text') ? container.querySelector('.q-text').innerText : `សំណួរ ${i+1}`, sel: userSel, cor: correctStr, isCor: isCorrect };
        });

        app.gameState.score = score;
        db.ref(`rooms/${app.currentRoomId}/scores/${encodeEmail(app.currentUser.email)}`).set(score);
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
        showNotification("សន្លឹកកិច្ចការត្រូវបានកែរួចរាល់! 💯", 3000);
        const btnGo = $('#goto-leaderboard-btn'); if (btnGo) btnGo.style.display = 'block';
    };

    // --- 12. Leaderboard & 💥 100% FIXED REVIEW SECTION ---
    const displayLeaderboard = (room) => {
        if (!room || !room.scores) return; const players = room.players ? Object.values(room.players) : [];
        const sorted = Object.entries(room.scores).map(([encodedEmail, score]) => { const p = players.find(player => player && player.email === decodeEmail(encodedEmail)); return { ...p, score }; }).filter(p => p && p.email).sort((a, b) => b.score - a.score);
        const pT = { 0: $('.place-1'), 1: $('.place-2'), 2: $('.place-3') }; 
        Object.values(pT).forEach(el => { if(el) el.style.visibility = 'hidden'; });
        sorted.slice(0, 3).forEach((p, i) => { const el = pT[i]; if (el) { el.style.visibility = 'visible'; el.querySelector('.podium-name').textContent = p.username; el.querySelector('.podium-score').textContent = `${p.score} ពិន្ទុ`; if(el.querySelector('.podium-avatar')) el.querySelector('.podium-avatar').src = p.avatarUrl; } });
        const listEl = $('#leaderboard-list'); if(listEl) { listEl.innerHTML = ''; sorted.slice(3).forEach((p, i) => { listEl.innerHTML += `<li><img src="${p.avatarUrl}" class="leaderboard-list-avatar"><span>#${i + 4} ${p.username}</span><span class="leaderboard-score">${p.score} ពិន្ទុ</span></li>`; }); }
        
        let reviewContainer = $('#answer-review-container');
        if (reviewContainer) reviewContainer.remove(); 
        
        reviewContainer = document.createElement('div');
        reviewContainer.id = 'answer-review-container';
        const lbView = $('#leaderboard-view');
        if(lbView) lbView.appendChild(reviewContainer);

        if (reviewContainer) {
            reviewContainer.innerHTML = '<h3 style="margin-top:30px; margin-bottom:20px; color:#cf30aa; text-align:center; width:100%;">📋 ពិនិត្យលទ្ធផលចម្លើយឡើងវិញ</h3>';
            (app.gameState.playerAnswers || []).forEach((ans, index) => {
                if(!ans) return; 
                const isCor = ans.isCor;
                
                let shortQText = ans.qText;
                let formattedSel = ans.sel === "" ? "មិនបានឆ្លើយ" : ans.sel;

                reviewContainer.innerHTML += `
                    <div class="review-item" style="background: ${isCor ? '#e8f5e9' : '#ffebee'}; border: 1px solid ${isCor ? '#c8e6c9' : '#ffcdd2'}; padding: 18px; margin-bottom: 12px; border-radius: 8px;">
                        <p style="margin: 0 0 10px 0; font-weight: bold; color: #000; line-height:1.5;">${shortQText}</p>
                        <p style="margin: 0; color: ${isCor ? '#2e7d32' : '#c62828'}; font-size:0.95em;">
                            ចម្លើយរបស់អ្នក៖ <b style="background:${isCor?'#c8e6c9':'#ffcdd2'}; padding:2px 6px; border-radius:4px;">${formattedSel}</b> ${isCor ? '✅' : '❌'}
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
            if (t.matches('#back-to-home-admin-btn') || t.matches('#back-to-home-from-leaderboard-btn') || t.matches('#back-to-home-from-test-btn')) { goHome(); }
            if (t.matches('#signup-btn')) handleSignup();
            
            if (t.matches('#add-question-btn')) {
                const container = $('#questions-container');
                const template = $('#question-template').content.cloneNode(true);
                template.querySelectorAll('input[type="radio"]').forEach(r => r.name = `correct_answer_${container.children.length}`);
                container.appendChild(template);
            }
            if (t.closest('.remove-question-btn')) { t.closest('.question-editor').remove(); }
            if (t.matches('#save-quiz-btn')) handleSaveQuiz();
            if (t.closest('.delete-quiz-btn')) { 
                if (confirm('តើអ្នកពិតជាចង់លុបកម្រងសំណួរនេះមែនទេ?')) { 
                    const quizId = t.closest('.delete-quiz-btn').dataset.quizId; 
                    db.ref('quizzes/' + quizId).remove(); 
                } 
            }

            if (t.matches('#bot-text-create-btn')) handleTextBotCreate();
            if (t.matches('#admin-chat-send-btn') || t.closest('#admin-chat-send-btn')) handleAdminChatSend();

            if (t.closest('.host-quiz-btn') || t.closest('.host-test-btn')) { 
                const quizId = (t.closest('.host-quiz-btn') || t.closest('.host-test-btn')).dataset.quizId; 
                const room = { id: `room_${Date.now()}`, quizId, host: app.currentUser.email, status: 'waiting', isTest: false, players: {}, scores: {} }; 
                db.ref('rooms/' + room.id).set(room); 
                const joinLink = `${window.location.origin}${window.location.pathname}?room=${room.id}`; 
                showModal("បន្ទប់ប្រឡងត្រូវបានបង្កើត!", `<div class="link-container" style="display:flex;gap:10px;"><input id="room-link-input" class="input" type="text" value="${joinLink}" style="flex:1;" readonly><button id="copy-link-btn" class="magic-btn" style="width:auto;margin:0;padding:0 20px !important;">ចម្លង</button></div><button id='modal-ok-btn' class="magic-btn mt-20">ចូលបន្ទប់គ្រប់គ្រង</button>`, () => joinRoom(room.id)); 
            }
            
            if (t.matches('#start-game-btn')) { app.currentQuiz = app.quizzes.find(q => q.id === app.rooms.find(r=>r.id===app.currentRoomId).quizId); startDigitalExam(); }
            if (t.matches('#close-room-btn')) { if (confirm('តើអ្នកពិតជាចង់បិទបន្ទប់?')) { db.ref('rooms/' + app.currentRoomId).remove(); goHome(); } }
            if (t.matches('#submit-exam-btn')) submitDigitalExam();
            
            if (t.matches('#goto-leaderboard-btn')) { showView('leaderboard'); displayLeaderboard(app.rooms.find(r => r.id === app.currentRoomId)); }
            if (t.matches('#zoom-in-btn')) { app.currentZoom += 1; $('#exam-paper-content').style.fontSize = app.currentZoom + 'px'; }
            if (t.matches('#zoom-out-btn')) { app.currentZoom = Math.max(10, app.currentZoom - 1); $('#exam-paper-content').style.fontSize = app.currentZoom + 'px'; }
        });
    }
    init();
});
